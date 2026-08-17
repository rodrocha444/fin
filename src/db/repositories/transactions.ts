// src/db/repositories/transactions.ts
// ─────────────────────────────────────────────────────────────
// CRUD de transações, parcelamento e pagamento de fatura
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import type { Transaction, InstallmentGroup } from '@/types'
import { addMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import { getProjectedScheduledForMonth } from './scheduled'

// ── Tipos de entrada ─────────────────────────────────────────

export type CreateTransactionInput = Omit<Transaction, 'id' | 'createdAt'>

export interface CreateInstallmentInput {
  accountId: number
  categoryId?: number
  description: string
  totalAmount: number
  installmentCount: number
  startDate: Date
  payee: string
  notes?: string
}

export interface CreateTransferInput {
  fromAccountId: number
  toAccountId: number
  amount: number
  date: Date
  notes?: string
  payee?: string
}

// ── CRUD básico ──────────────────────────────────────────────

export async function createTransaction(data: CreateTransactionInput): Promise<number> {
  const id = await db.transactions.add({ ...data, createdAt: new Date() })
  return id as number
}

export async function updateTransaction(id: number, data: Partial<CreateTransactionInput>): Promise<void> {
  await db.transactions.update(id, data)
}

export async function deleteTransaction(id: number): Promise<void> {
  const tx = await db.transactions.get(id)
  if (!tx) return

  // Se fizer parte de um parcelamento, excluir apenas essa ou perguntar?
  // Por ora, excluímos apenas a transação individualmente.
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

export async function deleteInstallmentGroup(installmentGroupId: number): Promise<void> {
  await db.transactions.where('installmentGroupId').equals(installmentGroupId).delete()
  await db.installmentGroups.delete(installmentGroupId)
}

export async function getTransactionsByAccount(accountId: number): Promise<Transaction[]> {
  const txs = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray()

  return txs.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? 0) - (a.id ?? 0)
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
    return (b.id ?? 0) - (a.id ?? 0)
  })
}

// ── Parcelamento ─────────────────────────────────────────────
//
// Opção A (escolhida pelo usuário):
//   Saldo do cartão mostra o compromisso total desde o início.
//   Para isso, criamos N transações com datas em meses futuros.
//   O saldo do cartão = soma de todas as transações (incluindo futuras).
//   O ORÇAMENTO mensal só vê as transações do mês corrente.
//
// Exemplo: 3x R$100 em 12/ago:
//   - Transação 1: 12/ago - R$100 (parcela 1/3)
//   - Transação 2: 12/set - R$100 (parcela 2/3)
//   - Transação 3: 12/out - R$100 (parcela 3/3)
//   → Saldo do cartão: -R$300 imediatamente
//   → Orçamento agosto: -R$100 na categoria
//   → Orçamento setembro: -R$100 na categoria
//   → Orçamento outubro: -R$100 na categoria

export async function createInstallmentPurchase(input: CreateInstallmentInput): Promise<number> {
  const installmentAmount = parseFloat((input.totalAmount / input.installmentCount).toFixed(2))

  // Ajuste de arredondamento na última parcela
  const lastInstallmentAmount = parseFloat(
    (input.totalAmount - installmentAmount * (input.installmentCount - 1)).toFixed(2)
  )

  return db.transaction('rw', db.installmentGroups, db.transactions, async () => {
    // 1. Criar o grupo de parcelamento
    const groupId = await db.installmentGroups.add({
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

      await db.transactions.add({
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
        installmentGroupId: groupId as number,
        installmentNumber: i + 1,
        installmentTotal: input.installmentCount,
        createdAt: new Date(),
      })
    }

    return groupId as number
  })
}

// ── Transferência / Pagamento de Fatura ──────────────────────
//
// Pagamento de fatura = transferência da conta corrente → cartão.
// Não cria categoria, não impacta orçamento.
// Cria dois registros de transação espelhados (um em cada conta).

export async function createTransfer(input: CreateTransferInput): Promise<void> {
  await db.transaction('rw', db.transactions, async () => {
    const payee = input.payee ?? 'Transferência'
    const now = new Date()

    // Placeholder IDs; vamos criar e depois atualizar o par
    const outId = await db.transactions.add({
      accountId: input.fromAccountId,
      date: input.date,
      amount: input.amount,
      payee,
      categoryId: undefined,
      notes: input.notes,
      cleared: false,
      type: 'transfer',
      transferAccountId: input.toAccountId,
      createdAt: now,
    })

    const inId = await db.transactions.add({
      accountId: input.toAccountId,
      date: input.date,
      amount: input.amount,
      payee,
      categoryId: undefined,
      notes: input.notes,
      cleared: false,
      type: 'transfer',
      transferAccountId: input.fromAccountId,
      transferTransactionId: outId as number,
      createdAt: now,
    })

    // Atualizar o registro de saída com o ID do par
    await db.transactions.update(outId, { transferTransactionId: inId as number })
  })
}

// ── Consultas especiais ──────────────────────────────────────

export async function getInstallmentsByGroup(groupId: number): Promise<Transaction[]> {
  return db.transactions
    .where('installmentGroupId')
    .equals(groupId)
    .sortBy('date')
}

export async function clearTransaction(id: number): Promise<void> {
  await db.transactions.update(id, { cleared: true })
}

export async function getTransactionsByAccountAndMonth(
  accountId: number,
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
export async function getActivityByCategory(month: string): Promise<Map<number, number>> {
  const [txs, scheduled] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
  ])

  const projected = getProjectedScheduledForMonth(scheduled, month)
  const map = new Map<number, number>()

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
export async function getIncomeByCategory(month: string): Promise<Map<number, number>> {
  const [txs, scheduled] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
  ])

  const projected = getProjectedScheduledForMonth(scheduled, month)
  const map = new Map<number, number>()

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
