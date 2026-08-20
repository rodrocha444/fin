// src/services/api/debts.ts — Operações de dívidas / cobranças via Supabase API
import { getClient } from './client'
import { rowToDebtAccount, debtAccountToRow, rowToDebtItem, debtItemToRow, toIso } from './types'
import { createId } from '@/utils/id'
import { addMonths } from 'date-fns'
import type { DebtAccount, DebtItem, DebtSummary, DebtStatus, DebtType } from '@/types'

export interface CreateDebtInstallmentsInput {
  debtAccountId: string
  description: string
  type: DebtType
  totalAmount: number
  installmentCount: number
  startDate: Date
  notes?: string
}

export async function getDebtAccounts(): Promise<DebtAccount[]> {
  const client = getClient()
  const { data, error } = await client
    .from('debt_accounts')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(`Erro ao buscar contatos de cobrança: ${error.message}`)
  return (data || []).map(rowToDebtAccount)
}

export async function createDebtAccount(data: Omit<DebtAccount, 'id' | 'createdAt'>): Promise<string> {
  const client = getClient()
  const id = createId()
  const row = debtAccountToRow({
    id,
    ...data,
    name: data.name.trim(),
    color: data.color || '#6366f1',
    isActive: data.isActive ?? true,
    createdAt: new Date(),
  })

  const { error } = await client.from('debt_accounts').insert(row)
  if (error) throw new Error(`Erro ao criar contato de cobrança: ${error.message}`)
  return id
}

export async function updateDebtAccount(id: string, data: Partial<Omit<DebtAccount, 'id' | 'createdAt'>>): Promise<void> {
  const client = getClient()
  const row = debtAccountToRow(data)
  delete (row as any).id

  const { error } = await client.from('debt_accounts').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar contato de cobrança: ${error.message}`)
}

export async function deleteDebtAccount(id: string): Promise<void> {
  const client = getClient()
  await client.from('debt_items').delete().eq('debt_account_id', id)
  const { error } = await client.from('debt_accounts').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir contato de cobrança: ${error.message}`)
}

export async function getDebtItemsByAccount(debtAccountId: string): Promise<DebtItem[]> {
  const client = getClient()
  const { data, error } = await client
    .from('debt_items')
    .select('*')
    .eq('debt_account_id', debtAccountId)

  if (error) throw new Error(`Erro ao buscar itens de cobrança: ${error.message}`)
  const items = (data || []).map(rowToDebtItem)

  return items.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export async function createDebtItem(data: Omit<DebtItem, 'id' | 'createdAt'>): Promise<string> {
  const client = getClient()
  const id = createId()
  const row = debtItemToRow({
    id,
    ...data,
    description: data.description.trim(),
    status: data.status || 'pending',
    createdAt: new Date(),
  })

  const { error } = await client.from('debt_items').insert(row)
  if (error) throw new Error(`Erro ao criar item de cobrança: ${error.message}`)
  return id
}

export async function createDebtInstallments(input: CreateDebtInstallmentsInput): Promise<void> {
  const client = getClient()
  const installmentCount = Math.max(1, Math.round(input.installmentCount))
  const installmentAmount = Math.round((input.totalAmount / installmentCount) * 100) / 100
  const groupId = `debt-inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date()

  if (installmentCount === 1) {
    await createDebtItem({
      debtAccountId: input.debtAccountId,
      description: input.description,
      type: input.type,
      amount: input.totalAmount,
      dueDate: input.startDate,
      notes: input.notes,
      status: 'pending',
    })
    return
  }

  const rows: any[] = []
  let accumulated = 0

  for (let i = 1; i <= installmentCount; i++) {
    const isLast = i === installmentCount
    const amount = isLast
      ? Math.round((input.totalAmount - accumulated) * 100) / 100
      : installmentAmount
    accumulated += amount

    const dueDate = addMonths(input.startDate, i - 1)
    const itemId = createId()

    rows.push(debtItemToRow({
      id: itemId,
      debtAccountId: input.debtAccountId,
      description: input.description.trim(),
      type: input.type,
      amount,
      dueDate,
      status: 'pending',
      notes: input.notes?.trim() || undefined,
      installmentGroupId: groupId,
      installmentNumber: i,
      installmentTotal: installmentCount,
      totalAmount: input.totalAmount,
      createdAt: now,
    }))
  }

  const { error } = await client.from('debt_items').insert(rows)
  if (error) throw new Error(`Erro ao criar parcelas de cobrança: ${error.message}`)
}

export async function updateDebtItem(id: string, data: Partial<Omit<DebtItem, 'id' | 'createdAt'>>): Promise<void> {
  const client = getClient()
  const row = debtItemToRow(data)
  delete (row as any).id

  const { error } = await client.from('debt_items').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar item de cobrança: ${error.message}`)
}

export async function deleteDebtItem(id: string): Promise<void> {
  const client = getClient()
  const { error } = await client.from('debt_items').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir item de cobrança: ${error.message}`)
}

export async function setDebtItemStatus(id: string, status: DebtStatus): Promise<void> {
  const client = getClient()
  const { error } = await client
    .from('debt_items')
    .update({
      status,
      settled_date: status === 'settled' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`Erro ao atualizar status do item: ${error.message}`)
}

export async function getDebtSummary(): Promise<DebtSummary> {
  const client = getClient()
  const { data } = await client.from('debt_items').select('*').eq('status', 'pending')
  const items = (data || []).map(rowToDebtItem)

  let totalReceivable = 0
  let totalPayable = 0

  for (const item of items) {
    if (item.type === 'receivable') totalReceivable += item.amount
    else if (item.type === 'payable') totalPayable += item.amount
  }

  return {
    totalReceivable,
    totalPayable,
    netBalance: totalReceivable - totalPayable,
    pendingCount: items.length,
  }
}
