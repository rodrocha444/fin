// src/services/api/transactions.ts — Operações de transações via Supabase API
import { getClient } from './client'
import {
  rowToTransaction,
  transactionToRow,
  installmentGroupToRow,
} from './types'
import { createId } from '@/utils/id'
import { addMonths } from 'date-fns'
import { notifyDataChanged } from './events'
import type { Transaction, TransactionType } from '@/types'

export async function getTransactions(): Promise<Transaction[]> {
  const client = getClient()
  const { data, error } = await client
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw new Error(`Erro ao buscar transações: ${error.message}`)
  return (data || []).map(rowToTransaction)
}

export async function getTransactionById(id: string): Promise<Transaction | undefined> {
  const client = getClient()
  const { data, error } = await client
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar transação: ${error.message}`)
  return data ? rowToTransaction(data) : undefined
}

export async function getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
  const client = getClient()
  const { data, error } = await client
    .from('transactions')
    .select('*')
    .or(`account_id.eq.${accountId},and(transfer_account_id.eq.${accountId},type.eq.transfer)`)

  if (error) throw new Error(`Erro ao buscar transações da conta: ${error.message}`)
  const txs = (data || []).map(rowToTransaction)

  return txs.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })
}

export async function getTransactionsByMonth(month: string): Promise<Transaction[]> {
  const client = getClient()
  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString()
  const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999)).toISOString()

  const { data, error } = await client
    .from('transactions')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`Erro ao buscar transações do mês: ${error.message}`)
  const txs = (data || []).map(rowToTransaction)

  return txs.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })
}

export async function getTransactionsByCategoryAndMonth(categoryId: string, month: string): Promise<Transaction[]> {
  const client = getClient()
  const [year, monthNum] = month.split('-').map(Number)
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1)).toISOString()
  const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999)).toISOString()

  const { data, error } = await client
    .from('transactions')
    .select('*')
    .eq('category_id', categoryId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`Erro ao buscar transações da categoria: ${error.message}`)
  const txs = (data || []).map(rowToTransaction)

  return txs.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })
}

export async function getMonthSummary(month: string): Promise<{
  income: number
  expense: number
  net: number
}> {
  const txs = await getTransactionsByMonth(month)
  let income = 0
  let expense = 0

  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount
    else if (tx.type === 'expense') expense += tx.amount
  }

  return {
    income,
    expense,
    net: income - expense,
  }
}

export async function createTransaction(data: {
  accountId: string
  date: Date
  amount: number
  payee: string
  categoryId?: string
  notes?: string
  cleared?: boolean
  type: TransactionType
}): Promise<string> {
  const client = getClient()
  const id = createId()
  const row = transactionToRow({
    id,
    ...data,
    cleared: data.cleared ?? false,
    createdAt: new Date(),
  })

  const { error } = await client.from('transactions').insert(row)
  if (error) throw new Error(`Erro ao criar transação: ${error.message}`)
  notifyDataChanged('transactions', 'insert', id)
  return id
}

export async function createTransfer(data: {
  fromAccountId: string
  toAccountId: string
  date: Date
  amount: number
  payee?: string
  notes?: string
  cleared?: boolean
}): Promise<string> {
  const client = getClient()
  const id = createId()
  const row = transactionToRow({
    id,
    accountId: data.fromAccountId,
    transferAccountId: data.toAccountId,
    date: data.date,
    amount: data.amount,
    payee: data.payee || 'Transferência',
    type: 'transfer',
    notes: data.notes,
    cleared: data.cleared ?? false,
    createdAt: new Date(),
  })

  const { error } = await client.from('transactions').insert(row)
  if (error) throw new Error(`Erro ao criar transferência: ${error.message}`)
  notifyDataChanged('transactions', 'insert', id)
  return id
}

export async function createInstallmentPurchase(data: {
  accountId: string
  startDate: Date
  totalAmount: number
  installmentCount: number
  description?: string
  payee?: string
  categoryId?: string
  notes?: string
}): Promise<string> {
  const client = getClient()
  const groupId = createId()
  const desc = data.description || data.payee || 'Compra Parcelada'
  const instAmount = Number((data.totalAmount / data.installmentCount).toFixed(2))

  const groupRow = installmentGroupToRow({
    id: groupId,
    description: desc,
    totalAmount: data.totalAmount,
    installmentCount: data.installmentCount,
    installmentAmount: instAmount,
    startDate: data.startDate,
    accountId: data.accountId,
    categoryId: data.categoryId,
    createdAt: new Date(),
  })

  const { error: groupErr } = await client.from('installment_groups').insert(groupRow)
  if (groupErr) throw new Error(`Erro ao criar grupo de parcelamento: ${groupErr.message}`)

  const rows: any[] = []
  for (let i = 1; i <= data.installmentCount; i++) {
    const instDate = addMonths(new Date(data.startDate), i - 1)
    const txId = createId()
    rows.push(transactionToRow({
      id: txId,
      accountId: data.accountId,
      date: instDate,
      amount: instAmount,
      payee: `${desc} (${i}/${data.installmentCount})`,
      categoryId: data.categoryId,
      notes: data.notes,
      cleared: false,
      type: 'expense',
      installmentGroupId: groupId,
      installmentNumber: i,
      installmentTotal: data.installmentCount,
      createdAt: new Date(),
    }))
  }

  const { error: txErr } = await client.from('transactions').insert(rows)
  if (txErr) throw new Error(`Erro ao criar parcelas: ${txErr.message}`)

  notifyDataChanged('installment_groups', 'insert', groupId)
  notifyDataChanged('transactions', 'insert')
  return groupId
}

export async function updateInstallmentPurchase(
  groupId: string,
  data: {
    description?: string
    payee?: string
    totalAmount?: number
    installmentCount?: number
    startDate?: Date
    accountId?: string
    categoryId?: string
    notes?: string
  }
): Promise<void> {
  const client = getClient()
  const { data: group } = await client.from('installment_groups').select('*').eq('id', groupId).maybeSingle()
  if (!group) return

  const desc = data.description || data.payee || group.description
  const count = data.installmentCount ?? group.installment_count
  const total = data.totalAmount ?? Number(group.total_amount)
  const instAmount = Number((total / count).toFixed(2))

  await client.from('installment_groups').update({
    description: desc,
    total_amount: total,
    installment_count: count,
    installment_amount: instAmount,
    ...(data.startDate ? { start_date: data.startDate.toISOString() } : {}),
    ...(data.accountId ? { account_id: data.accountId } : {}),
    ...(data.categoryId !== undefined ? { category_id: data.categoryId } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', groupId)

  const { data: txs } = await client.from('transactions').select('*').eq('installment_group_id', groupId).order('installment_number', { ascending: true })
  if (txs) {
    for (const tx of txs as any[]) {
      const num = tx.installment_number || 1
      await client.from('transactions').update({
        payee: `${desc} (${num}/${count})`,
        amount: instAmount,
        ...(data.accountId ? { account_id: data.accountId } : {}),
        ...(data.categoryId !== undefined ? { category_id: data.categoryId } : {}),
        installment_total: count,
        updated_at: new Date().toISOString(),
      }).eq('id', tx.id)
    }
  }

  notifyDataChanged('installment_groups', 'update', groupId)
  notifyDataChanged('transactions', 'update')
}

export async function updateTransaction(id: string, changes: Partial<Transaction>): Promise<void> {
  const client = getClient()
  const row = transactionToRow(changes)
  delete (row as any).id

  const { error } = await client.from('transactions').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar transação: ${error.message}`)
  notifyDataChanged('transactions', 'update', id)
}

export async function deleteTransaction(id: string): Promise<void> {
  const client = getClient()
  const { data: tx } = await client.from('transactions').select('installment_group_id').eq('id', id).maybeSingle()

  if (tx?.installment_group_id) {
    await client.from('transactions').delete().eq('id', id)
    const { count } = await client.from('transactions').select('*', { count: 'exact', head: true }).eq('installment_group_id', tx.installment_group_id)
    if (count === 0) {
      await client.from('installment_groups').delete().eq('id', tx.installment_group_id)
      notifyDataChanged('installment_groups', 'delete', tx.installment_group_id)
    }
    notifyDataChanged('transactions', 'delete', id)
    return
  }

  const { error } = await client.from('transactions').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir transação: ${error.message}`)
  notifyDataChanged('transactions', 'delete', id)
}

export async function deleteInstallmentGroup(installmentGroupId: string): Promise<void> {
  const client = getClient()
  await client.from('transactions').delete().eq('installment_group_id', installmentGroupId)
  await client.from('installment_groups').delete().eq('id', installmentGroupId)
  notifyDataChanged('installment_groups', 'delete', installmentGroupId)
  notifyDataChanged('transactions', 'delete')
}

export interface SplitItemInput {
  categoryId?: string
  amount: number
  notes?: string
}

export async function createSplitTransaction(data: {
  accountId: string
  date: Date
  payee: string
  type: TransactionType
  notes?: string
  splits: SplitItemInput[]
  cleared?: boolean
}): Promise<string> {
  const client = getClient()
  const splitGroupId = createId()
  const now = new Date()

  const validSplits = data.splits.filter(s => s.amount > 0)
  if (validSplits.length === 0) {
    throw new Error('Nenhuma divisão com valor positivo informada.')
  }

  const rows = validSplits.map(s => {
    const id = createId()
    return transactionToRow({
      id,
      accountId: data.accountId,
      date: data.date,
      amount: s.amount,
      payee: data.payee,
      categoryId: s.categoryId,
      notes: s.notes || data.notes,
      cleared: data.cleared ?? false,
      type: data.type,
      splitGroupId,
      createdAt: now,
    })
  })

  const { error } = await client.from('transactions').insert(rows)
  if (error) throw new Error(`Erro ao criar transação dividida: ${error.message}`)

  notifyDataChanged('transactions', 'insert')
  return splitGroupId
}

export async function updateSplitTransaction(
  splitGroupId: string,
  data: {
    accountId: string
    date: Date
    payee: string
    type: TransactionType
    notes?: string
    splits: SplitItemInput[]
    cleared?: boolean
  }
): Promise<void> {
  const client = getClient()
  const now = new Date()

  // Remove os registros antigos do grupo de rateio por tag em notes
  await client.from('transactions').delete().ilike('notes', `%[split:${splitGroupId}]%`)

  const validSplits = data.splits.filter(s => s.amount > 0)
  if (validSplits.length === 0) {
    throw new Error('Nenhuma divisão com valor positivo informada.')
  }

  // Insere as novas partes do rateio mantendo o mesmo splitGroupId
  const rows = validSplits.map(s => {
    const id = createId()
    return transactionToRow({
      id,
      accountId: data.accountId,
      date: data.date,
      amount: s.amount,
      payee: data.payee,
      categoryId: s.categoryId,
      notes: s.notes || data.notes,
      cleared: data.cleared ?? false,
      type: data.type,
      splitGroupId,
      createdAt: now,
    })
  })

  const { error } = await client.from('transactions').insert(rows)
  if (error) throw new Error(`Erro ao atualizar transação dividida: ${error.message}`)

  notifyDataChanged('transactions', 'update')
}

export async function deleteSplitTransaction(splitGroupId: string): Promise<void> {
  const client = getClient()
  const { error } = await client.from('transactions').delete().ilike('notes', `%[split:${splitGroupId}]%`)
  if (error) throw new Error(`Erro ao excluir transação dividida: ${error.message}`)
  notifyDataChanged('transactions', 'delete')
}

export async function clearTransaction(id: string, cleared: boolean): Promise<void> {
  const client = getClient()
  const { error } = await client.from('transactions').update({ cleared, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar status compensado: ${error.message}`)
  notifyDataChanged('transactions', 'update', id)
}
