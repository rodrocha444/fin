// src/db/repositories/transactions.ts
// ─────────────────────────────────────────────────────────────
// CRUD de transações, parcelamento e pagamento de fatura (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { Transaction, InstallmentGroup } from '@/types'
import { addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { getProjectedScheduledForMonth } from './scheduled'

// ── Tipos de entrada ─────────────────────────────────────────

export type CreateTransactionInput = Omit<Transaction, 'id' | 'createdAt'>

export interface CreateInstallmentInput {
  accountId: string
  categoryId?: string
  description: string
  totalAmount: number
  installmentCount: number
  startDate: Date
  payee: string
  notes?: string
}

export interface CreateTransferInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  date: Date
  notes?: string
  payee?: string
}

// ── CRUD básico ──────────────────────────────────────────────

export async function createTransaction(data: CreateTransactionInput): Promise<string> {
  const id = createId()
  await db.transactions.add({ ...data, id, createdAt: new Date() })
  return id
}

export async function updateTransaction(id: string, data: Partial<CreateTransactionInput>): Promise<void> {
  await db.transactions.update(id, data)
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = await db.transactions.get(id)
  if (!tx) return

  // Se fizer parte de um parcelamento, remove apenas essa parcela
  if (tx.installmentGroupId) {
    await db.transactions.delete(id)
    // Se era a última parcela, remove o grupo
    const remaining = await db.transactions
      .where('installmentGroupId')
      .equals(tx.installmentGroupId)
      .count()
    if (remaining === 0) {
      await db.installmentGroups.delete(tx.installmentGroupId)
    }
    return
  }

  // Para transferências, remover o par também
  if (tx.type === 'transfer' && tx.transferTransactionId) {
    await db.transactions.delete(tx.transferTransactionId)
  }

  await db.transactions.delete(id)
}

export async function deleteInstallmentGroup(installmentGroupId: string): Promise<void> {
  await db.transactions.where('installmentGroupId').equals(installmentGroupId).delete()
  await db.installmentGroups.delete(installmentGroupId)
}

export async function getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
  const txs = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray()

  return txs.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })
}

export async function getTransactionsByMonth(month: string): Promise<Transaction[]> {
  // month = 'YYYY-MM'
  const [year, mon] = month.split('-').map(Number)
  const start = startOfMonth(new Date(year, mon - 1))
  const end = endOfMonth(new Date(year, mon - 1))

  const txs = await db.transactions
    .where('date')
    .between(start, end, true, true)
    .toArray()

  return txs.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })
}

// ── Parcelamento ─────────────────────────────────────────────

export async function createInstallmentPurchase(input: CreateInstallmentInput): Promise<string> {
  const installmentAmount = parseFloat((input.totalAmount / input.installmentCount).toFixed(2))

  // Ajuste de arredondamento na última parcela
  const lastInstallmentAmount = parseFloat(
    (input.totalAmount - installmentAmount * (input.installmentCount - 1)).toFixed(2)
  )

  return db.transaction('rw', db.installmentGroups, db.transactions, async () => {
    const groupId = createId()

    // 1. Criar o grupo de parcelamento
    await db.installmentGroups.add({
      id: groupId,
      description: input.description,
      totalAmount: input.totalAmount,
      installmentCount: input.installmentCount,
      installmentAmount,
      startDate: input.startDate,
      accountId: input.accountId,
      categoryId: input.categoryId,
      createdAt: new Date(),
    } as InstallmentGroup)

    // 2. Criar uma transação por parcela
    for (let i = 0; i < input.installmentCount; i++) {
      const installmentDate = addMonths(input.startDate, i)
      const amount = i === input.installmentCount - 1 ? lastInstallmentAmount : installmentAmount
      const txId = createId()

      await db.transactions.add({
        id: txId,
        accountId: input.accountId,
        date: installmentDate,
        amount,
        payee: input.payee,
        categoryId: input.categoryId,
        notes: input.notes
          ? `${input.notes} (${i + 1}/${input.installmentCount})`
          : `${input.description} (${i + 1}/${input.installmentCount})`,
        cleared: false,
        type: 'expense',
        installmentGroupId: groupId,
        installmentNumber: i + 1,
        installmentTotal: input.installmentCount,
        createdAt: new Date(),
      })
    }

    return groupId
  })
}

// ── Transferência / Pagamento de Fatura ──────────────────────

export async function createTransfer(input: CreateTransferInput): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    const payee = input.payee ?? 'Transferência'
    const now = new Date()
    const outId = createId()
    const inId = createId()

    await db.transactions.add({
      id: outId,
      accountId: input.fromAccountId,
      date: input.date,
      amount: input.amount,
      payee,
      categoryId: undefined,
      notes: input.notes,
      cleared: false,
      type: 'transfer',
      transferAccountId: input.toAccountId,
      transferTransactionId: inId,
      createdAt: now,
    })

    await db.transactions.add({
      id: inId,
      accountId: input.toAccountId,
      date: input.date,
      amount: input.amount,
      payee,
      categoryId: undefined,
      notes: input.notes,
      cleared: false,
      type: 'transfer',
      transferAccountId: input.fromAccountId,
      transferTransactionId: outId,
      createdAt: now,
    })
  })
}

// ── Consultas especiais ──────────────────────────────────────

export async function getInstallmentsByGroup(groupId: string): Promise<Transaction[]> {
  return db.transactions
    .where('installmentGroupId')
    .equals(groupId)
    .sortBy('date')
}

export async function clearTransaction(id: string): Promise<void> {
  await db.transactions.update(id, { cleared: true })
}

export async function getTransactionsByAccountAndMonth(
  accountId: string,
  month: string
): Promise<Transaction[]> {
  const [year, mon] = month.split('-').map(Number)
  const start = startOfMonth(new Date(year, mon - 1))
  const end = endOfMonth(new Date(year, mon - 1))

  return db.transactions
    .where('[accountId+date]')
    .between([accountId, start], [accountId, end], true, true)
    .toArray()
}

export async function getTransactionsByCategoryAndMonth(
  categoryId: string,
  month: string
): Promise<Transaction[]> {
  const [year, mon] = month.split('-').map(Number)
  const start = startOfMonth(new Date(year, mon - 1))
  const end = endOfMonth(new Date(year, mon - 1))

  const [allTxs, allScheduled] = await Promise.all([
    db.transactions
      .where('categoryId')
      .equals(categoryId)
      .filter(t => t.date >= start && t.date <= end)
      .toArray(),
    db.scheduledTransactions
      .filter(s => s.categoryId === categoryId && s.isActive !== false)
      .toArray(),
  ])

  const projected = getProjectedScheduledForMonth(allScheduled, month)
  const projectedTxs: Transaction[] = projected.map(p => ({
    accountId: p.accountId,
    transferAccountId: p.transferAccountId,
    date: p.date,
    amount: p.amount,
    payee: p.payee,
    categoryId: p.categoryId,
    notes: p.notes,
    cleared: false,
    type: p.type,
    isScheduledProjection: true,
    scheduledId: p.scheduledId,
    createdAt: p.date,
  }))

  const combined = [...allTxs, ...projectedTxs]
  combined.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })

  return combined
}

// Retorna transações de um mês agrupadas por tipo (para relatórios)
export async function getMonthSummary(month: string) {
  const [txs, scheduled] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
  ])

  const projected = getProjectedScheduledForMonth(scheduled, month)

  let income = 0
  let expense = 0

  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount
    else if (tx.type === 'expense') expense += tx.amount
  }

  for (const p of projected) {
    if (p.type === 'income') income += p.amount
    else if (p.type === 'expense') expense += p.amount
  }

  return { income, expense, net: income - expense }
}

// Agrupa activity por categoryId para um mês (incluindo transações reais e agendamentos futuros)
export async function getActivityByCategory(month: string): Promise<Map<string, number>> {
  const [txs, scheduled] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
  ])

  const projected = getProjectedScheduledForMonth(scheduled, month)
  const map = new Map<string, number>()

  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.categoryId) continue
    const prev = map.get(tx.categoryId) ?? 0
    map.set(tx.categoryId, prev + tx.amount)
  }

  for (const p of projected) {
    if (p.type !== 'expense' || !p.categoryId) continue
    const prev = map.get(p.categoryId) ?? 0
    map.set(p.categoryId, prev + p.amount)
  }

  return map
}

// Agrupa income por categoryId para um mês (incluindo receitas reais e agendamentos futuros)
export async function getIncomeByCategory(month: string): Promise<Map<string, number>> {
  const [txs, scheduled] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
  ])

  const projected = getProjectedScheduledForMonth(scheduled, month)
  const map = new Map<string, number>()

  for (const tx of txs) {
    if (tx.type !== 'income' || !tx.categoryId) continue
    const prev = map.get(tx.categoryId) ?? 0
    map.set(tx.categoryId, prev + tx.amount)
  }

  for (const p of projected) {
    if (p.type !== 'income' || !p.categoryId) continue
    const prev = map.get(p.categoryId) ?? 0
    map.set(p.categoryId, prev + p.amount)
  }

  return map
}
