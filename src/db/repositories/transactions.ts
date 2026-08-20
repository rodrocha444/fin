// src/db/repositories/transactions.ts
// ─────────────────────────────────────────────────────────────
// CRUD de transações, parcelamento e pagamento de fatura (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { Transaction, InstallmentGroup } from '@/types'
import { addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
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
  const tx = await db.transactions.get(id)
  if (!tx) return

  // Se a transação pertencer a um parcelamento, sincroniza todas as parcelas do grupo
  if (tx.installmentGroupId) {
    const groupId = tx.installmentGroupId
    const groupTxs = await db.transactions.where('installmentGroupId').equals(groupId).toArray()

    // Se a data foi alterada, recalcula a data base do parcelamento e desloca todas as parcelas proporcionalmente
    let newBaseDate: Date | undefined
    if (data.date) {
      const currentParcelNum = tx.installmentNumber || 1
      const inputDate = new Date(data.date)
      inputDate.setHours(12, 0, 0, 0)
      newBaseDate = subMonths(inputDate, currentParcelNum - 1)
      newBaseDate.setHours(12, 0, 0, 0)
    }

    await db.transaction('rw', db.transactions, db.installmentGroups, async () => {
      for (const parcelTx of groupTxs) {
        const parcelNum = parcelTx.installmentNumber || 1
        const updates: Partial<Transaction> = {}

        if (data.accountId !== undefined) updates.accountId = data.accountId
        if (data.categoryId !== undefined) updates.categoryId = data.categoryId
        if (data.payee !== undefined) updates.payee = data.payee

        if (data.notes !== undefined) {
          const cleanNotes = data.notes.replace(/\s*\(\d+\/\d+\)$/, '').trim()
          updates.notes = cleanNotes
            ? `${cleanNotes} (${parcelNum}/${parcelTx.installmentTotal || groupTxs.length})`
            : `${data.payee || tx.payee} (${parcelNum}/${parcelTx.installmentTotal || groupTxs.length})`
        }

        if (newBaseDate) {
          const newParcelDate = addMonths(newBaseDate, parcelNum - 1)
          newParcelDate.setHours(12, 0, 0, 0)
          updates.date = newParcelDate
        }

        // Sincroniza o novo valor da parcela em TODAS as parcelas do grupo
        if (data.amount !== undefined) {
          updates.amount = data.amount
        }

        await db.transactions.update(parcelTx.id, updates)
      }

      // Atualiza o registro do grupo
      const groupUpdates: Partial<InstallmentGroup> = {}
      if (newBaseDate) groupUpdates.startDate = newBaseDate
      if (data.payee !== undefined) groupUpdates.description = data.payee
      if (data.categoryId !== undefined) groupUpdates.categoryId = data.categoryId
      if (data.accountId !== undefined) groupUpdates.accountId = data.accountId

      if (data.amount !== undefined) {
        groupUpdates.installmentAmount = data.amount
        groupUpdates.totalAmount = data.amount * (tx.installmentTotal || groupTxs.length)
      }

      if (Object.keys(groupUpdates).length > 0) {
        await db.installmentGroups.update(groupId, groupUpdates)
      }
    })
    return
  }

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

  await db.transactions.delete(id)
}

export async function deleteInstallmentGroup(installmentGroupId: string): Promise<void> {
  await db.transactions.where('installmentGroupId').equals(installmentGroupId).delete()
  await db.installmentGroups.delete(installmentGroupId)
}

export async function getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
  const [directTxs, incomingTransfers] = await Promise.all([
    db.transactions
      .where('accountId')
      .equals(accountId)
      .toArray(),
    db.transactions
      .where('transferAccountId')
      .equals(accountId)
      .filter(tx => tx.type === 'transfer')
      .toArray(),
  ])

  const txs = [...directTxs, ...incomingTransfers]

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

    // 2. Criar uma transação por parcela com horário normalizado para evitar desvio de fuso horário
    const baseDate = new Date(input.startDate)
    baseDate.setHours(12, 0, 0, 0)

    for (let i = 0; i < input.installmentCount; i++) {
      const installmentDate = addMonths(baseDate, i)
      installmentDate.setHours(12, 0, 0, 0)
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

export async function updateInstallmentPurchase(groupId: string, input: CreateInstallmentInput): Promise<void> {
  const installmentAmount = parseFloat((input.totalAmount / input.installmentCount).toFixed(2))
  const lastInstallmentAmount = parseFloat(
    (input.totalAmount - installmentAmount * (input.installmentCount - 1)).toFixed(2)
  )

  await db.transaction('rw', db.installmentGroups, db.transactions, async () => {
    // 1. Atualiza o registro do grupo
    await db.installmentGroups.update(groupId, {
      description: input.description,
      totalAmount: input.totalAmount,
      installmentCount: input.installmentCount,
      installmentAmount,
      startDate: input.startDate,
      accountId: input.accountId,
      categoryId: input.categoryId,
    })

    // 2. Busca parcelas existentes do grupo ordenadas por número da parcela
    const existingTxs = await db.transactions
      .where('installmentGroupId')
      .equals(groupId)
      .sortBy('installmentNumber')

    const baseDate = new Date(input.startDate)
    baseDate.setHours(12, 0, 0, 0)

    const cleanNotes = input.notes ? input.notes.replace(/\s*\(\d+\/\d+\)$/, '').trim() : ''

    // 3. Atualiza ou cria as parcelas para corresponder a input.installmentCount
    for (let i = 0; i < input.installmentCount; i++) {
      const installmentDate = addMonths(baseDate, i)
      installmentDate.setHours(12, 0, 0, 0)
      const amount = i === input.installmentCount - 1 ? lastInstallmentAmount : installmentAmount
      const notes = cleanNotes
        ? `${cleanNotes} (${i + 1}/${input.installmentCount})`
        : `${input.description || input.payee} (${i + 1}/${input.installmentCount})`

      if (i < existingTxs.length) {
        await db.transactions.update(existingTxs[i].id, {
          accountId: input.accountId,
          date: installmentDate,
          amount,
          payee: input.payee,
          categoryId: input.categoryId,
          notes,
          type: 'expense',
          installmentNumber: i + 1,
          installmentTotal: input.installmentCount,
        })
      } else {
        await db.transactions.add({
          id: createId(),
          accountId: input.accountId,
          date: installmentDate,
          amount,
          payee: input.payee,
          categoryId: input.categoryId,
          notes,
          cleared: false,
          type: 'expense',
          installmentGroupId: groupId,
          installmentNumber: i + 1,
          installmentTotal: input.installmentCount,
          createdAt: new Date(),
        })
      }
    }

    // 4. Se a nova quantidade for menor que a anterior, deleta as parcelas excedentes
    if (existingTxs.length > input.installmentCount) {
      const extraTxs = existingTxs.slice(input.installmentCount)
      for (const extra of extraTxs) {
        await db.transactions.delete(extra.id)
      }
    }
  })
}

// ── Transferência / Pagamento de Fatura ──────────────────────

export async function createTransfer(input: CreateTransferInput): Promise<string> {
  const id = createId()
  await db.transactions.add({
    id,
    accountId: input.fromAccountId,
    transferAccountId: input.toAccountId,
    amount: input.amount,
    date: input.date,
    payee: input.payee ?? 'Transferência',
    categoryId: undefined,
    notes: input.notes,
    cleared: false,
    type: 'transfer',
    createdAt: new Date(),
  })
  return id
}

/**
 * Limpeza preventiva de transferências legadas cadastradas em pares (versões anteriores)
 */
export async function cleanupDuplicateTransferPairs(): Promise<void> {
  try {
    const transferTxs = await db.transactions
      .filter(t => t.type === 'transfer' && !!t.transferTransactionId)
      .toArray()

    const visited = new Set<string>()

    for (const tx of transferTxs) {
      if (!tx.id || visited.has(tx.id)) continue
      const counterpartId = tx.transferTransactionId
      if (!counterpartId) continue

      const counterpart = await db.transactions.get(counterpartId)
      if (counterpart && counterpart.transferTransactionId === tx.id) {
        visited.add(tx.id)
        visited.add(counterpart.id!)
        // Mantém a transação de origem (tx), remove a duplicata de destino e limpa a referência pareada
        await db.transactions.delete(counterpart.id!)
        await db.transactions.update(tx.id, { transferTransactionId: undefined })
      }
    }
  } catch (err) {
    console.error('Erro ao limpar transferências duplicadas:', err)
  }
}

// ── Consultas especiais ──────────────────────────────────────

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
  const [txs, scheduled, accounts] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
    db.accounts.toArray(),
  ])

  const offBudgetAccountIds = new Set(accounts.filter(a => a.type === 'off_budget').map(a => a.id!))
  const projected = getProjectedScheduledForMonth(scheduled, month)
  const map = new Map<string, number>()

  for (const tx of txs) {
    if (tx.type !== 'expense' || !tx.categoryId || offBudgetAccountIds.has(tx.accountId)) continue
    const prev = map.get(tx.categoryId) ?? 0
    map.set(tx.categoryId, prev + tx.amount)
  }

  for (const p of projected) {
    if (p.type !== 'expense' || !p.categoryId || offBudgetAccountIds.has(p.accountId)) continue
    const prev = map.get(p.categoryId) ?? 0
    map.set(p.categoryId, prev + p.amount)
  }

  return map
}

// Agrupa income por categoryId para um mês (incluindo receitas reais e agendamentos futuros)
export async function getIncomeByCategory(month: string): Promise<Map<string, number>> {
  const [txs, scheduled, accounts] = await Promise.all([
    getTransactionsByMonth(month),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
    db.accounts.toArray(),
  ])

  const offBudgetAccountIds = new Set(accounts.filter(a => a.type === 'off_budget').map(a => a.id!))
  const projected = getProjectedScheduledForMonth(scheduled, month)
  const map = new Map<string, number>()

  for (const tx of txs) {
    if (tx.type !== 'income' || !tx.categoryId || offBudgetAccountIds.has(tx.accountId)) continue
    const prev = map.get(tx.categoryId) ?? 0
    map.set(tx.categoryId, prev + tx.amount)
  }

  for (const p of projected) {
    if (p.type !== 'income' || !p.categoryId || offBudgetAccountIds.has(p.accountId)) continue
    const prev = map.get(p.categoryId) ?? 0
    map.set(p.categoryId, prev + p.amount)
  }

  return map
}
