import { getClient } from './client'
import {
  rowToScheduledTransaction,
  scheduledTransactionToRow,
  scheduledTransactionToUpdateRow,
  transactionToRow,
} from './types'
import { createId } from '@/utils/id'
import {
  format,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns'
import { notifyDataChanged } from './events'
import type { ScheduledTransaction, TransactionType } from '@/types'

export interface ProjectedScheduledOccurrence {
  scheduledId: string
  accountId: string
  transferAccountId?: string
  type: TransactionType
  amount: number
  categoryId?: string
  payee: string
  notes?: string
  date: Date
  isScheduledProjection: true
}

export async function getScheduledTransactions(): Promise<ScheduledTransaction[]> {
  const client = getClient()
  const { data, error } = await client
    .from('scheduled_transactions')
    .select('*')
    .order('next_date', { ascending: true })

  if (error) throw new Error(`Erro ao buscar agendamentos: ${error.message}`)
  return (data || []).map(rowToScheduledTransaction)
}

export async function createScheduled(data: Omit<ScheduledTransaction, 'id' | 'createdAt'>): Promise<string> {
  const client = getClient()
  const id = createId()
  const row = scheduledTransactionToRow({
    id,
    ...data,
    createdAt: new Date(),
  })

  const { error } = await client.from('scheduled_transactions').insert(row)
  if (error) throw new Error(`Erro ao criar agendamento: ${error.message}`)
  notifyDataChanged('scheduled_transactions', 'insert', id)
  return id
}

export async function updateScheduled(id: string, data: Partial<Omit<ScheduledTransaction, 'id' | 'createdAt'>>): Promise<void> {
  const client = getClient()
  const row = scheduledTransactionToUpdateRow(data)

  const { error } = await client.from('scheduled_transactions').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar agendamento: ${error.message}`)
  notifyDataChanged('scheduled_transactions', 'update', id)
}

export async function deleteScheduled(id: string): Promise<void> {
  const client = getClient()
  const { error } = await client.from('scheduled_transactions').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir agendamento: ${error.message}`)
  notifyDataChanged('scheduled_transactions', 'delete', id)
}

export async function confirmScheduledOccurrence(
  scheduledIdOrOccurrence: string | ProjectedScheduledOccurrence,
  dateParam?: Date
): Promise<string> {
  const client = getClient()

  if (typeof scheduledIdOrOccurrence === 'string') {
    const scheduledId = scheduledIdOrOccurrence
    const date = dateParam || new Date()
    const { data: s } = await client.from('scheduled_transactions').select('*').eq('id', scheduledId).maybeSingle()
    if (!s) throw new Error('Agendamento não encontrado.')

    const txId = createId()
    const txRow = transactionToRow({
      id: txId,
      accountId: s.account_id,
      transferAccountId: s.transfer_account_id,
      date,
      amount: Number(s.amount),
      payee: s.payee || (s.type === 'transfer' ? 'Transferência agendada' : 'Transação agendada'),
      categoryId: s.category_id,
      notes: s.notes,
      cleared: false,
      type: s.type,
      scheduledId,
      createdAt: new Date(),
    })

    const { error } = await client.from('transactions').insert(txRow)
    if (error) throw new Error(`Erro ao confirmar agendamento: ${error.message}`)
    notifyDataChanged('transactions', 'insert', txId)
    return txId
  }

  const occurrence = scheduledIdOrOccurrence
  const txId = createId()
  const txRow = transactionToRow({
    id: txId,
    accountId: occurrence.accountId,
    transferAccountId: occurrence.transferAccountId,
    date: occurrence.date,
    amount: occurrence.amount,
    payee: occurrence.payee,
    categoryId: occurrence.categoryId,
    notes: occurrence.notes,
    cleared: false,
    type: occurrence.type,
    scheduledId: occurrence.scheduledId,
    createdAt: new Date(),
  })
  const { error } = await client.from('transactions').insert(txRow)
  if (error) throw new Error(`Erro ao confirmar agendamento: ${error.message}`)
  notifyDataChanged('transactions', 'insert', txId)
  return txId
}

export function getProjectedScheduledUpToMonth(
  scheduledList: ScheduledTransaction[],
  upToMonth: string,
  afterDateExclusive: Date = new Date()
): ProjectedScheduledOccurrence[] {
  const projected: ProjectedScheduledOccurrence[] = []
  const todayThreshold = new Date(afterDateExclusive)

  for (const s of scheduledList) {
    if (s.isActive === false || !s.id) continue
    let current = new Date(s.nextDate)
    const end = s.endDate ? new Date(s.endDate) : null

    while (true) {
      const curMonth = format(current, 'yyyy-MM')
      if (curMonth > upToMonth) break
      if (end && current > end) break

      if (curMonth <= upToMonth && current > todayThreshold) {
        projected.push({
          scheduledId: s.id,
          accountId: s.accountId,
          transferAccountId: s.transferAccountId,
          type: s.type,
          amount: s.amount,
          categoryId: s.categoryId,
          payee: s.payee || (s.type === 'transfer' ? 'Transferência agendada' : 'Transação agendada'),
          notes: s.notes,
          date: new Date(current),
          isScheduledProjection: true,
        })
      }

      if (s.frequency === 'once') break
      else if (s.frequency === 'weekly') current = addWeeks(current, 1)
      else if (s.frequency === 'biweekly') current = addWeeks(current, 2)
      else if (s.frequency === 'monthly') current = addMonths(current, 1)
      else if (s.frequency === 'yearly') current = addYears(current, 1)
      else current = addMonths(current, 1)
    }
  }

  return projected
}

export function getProjectedScheduledForMonth(
  scheduledList: ScheduledTransaction[],
  month: string,
  afterDateExclusive: Date = new Date()
): ProjectedScheduledOccurrence[] {
  return getProjectedScheduledUpToMonth(scheduledList, month, afterDateExclusive).filter(
    p => format(p.date, 'yyyy-MM') === month
  )
}

export function getProjectedScheduledForAccount(
  accountId: string,
  scheduledList: ScheduledTransaction[],
  monthsAhead: number = 6,
  afterDateExclusive: Date = new Date()
): ProjectedScheduledOccurrence[] {
  const projected: ProjectedScheduledOccurrence[] = []
  const todayThreshold = new Date(afterDateExclusive)
  const maxLimit = addMonths(new Date(), monthsAhead)

  for (const s of scheduledList) {
    if (s.isActive === false || !s.id) continue
    if (s.accountId !== accountId && s.transferAccountId !== accountId) continue

    let current = new Date(s.nextDate)
    const end = s.endDate ? new Date(s.endDate) : null

    while (true) {
      if (current > maxLimit) break
      if (end && current > end) break

      if (current > todayThreshold) {
        projected.push({
          scheduledId: s.id,
          accountId: s.accountId,
          transferAccountId: s.transferAccountId,
          type: s.type,
          amount: s.amount,
          categoryId: s.categoryId,
          payee: s.payee || (s.type === 'transfer' ? 'Transferência agendada' : 'Transação agendada'),
          notes: s.notes,
          date: new Date(current),
          isScheduledProjection: true,
        })
      }

      if (s.frequency === 'once') break
      else if (s.frequency === 'weekly') current = addWeeks(current, 1)
      else if (s.frequency === 'biweekly') current = addWeeks(current, 2)
      else if (s.frequency === 'monthly') current = addMonths(current, 1)
      else if (s.frequency === 'yearly') current = addYears(current, 1)
      else current = addMonths(current, 1)
    }
  }

  return projected
}

export async function processScheduledTransactions(): Promise<number> {
  const client = getClient()
  const { data: scheduled } = await client.from('scheduled_transactions').select('*').eq('is_active', true)
  if (!scheduled || scheduled.length === 0) return 0

  const today = startOfDay(new Date())
  let createdCount = 0

  for (const sRow of scheduled) {
    const s = rowToScheduledTransaction(sRow)
    if (!s.id) continue

    let nextDate = new Date(s.nextDate)
    const endDate = s.endDate ? new Date(s.endDate) : null

    while (isBefore(nextDate, today) || nextDate.getTime() === today.getTime()) {
      if (endDate && isAfter(nextDate, endDate)) break

      // Cria a transação correspondente
      const txId = createId()
      const txRow = transactionToRow({
        id: txId,
        accountId: s.accountId,
        transferAccountId: s.transferAccountId,
        date: new Date(nextDate),
        amount: s.amount,
        payee: s.payee || (s.type === 'transfer' ? 'Transferência agendada' : 'Transação agendada'),
        categoryId: s.categoryId,
        notes: s.notes,
        cleared: false,
        type: s.type,
        scheduledId: s.id,
        createdAt: new Date(nextDate),
      })
      await client.from('transactions').insert(txRow)
      createdCount++

      if (s.frequency === 'once') {
        await client.from('scheduled_transactions').update({ is_active: false }).eq('id', s.id)
        break
      } else if (s.frequency === 'weekly') {
        nextDate = addWeeks(nextDate, 1)
      } else if (s.frequency === 'biweekly') {
        nextDate = addWeeks(nextDate, 2)
      } else if (s.frequency === 'monthly') {
        nextDate = addMonths(nextDate, 1)
      } else if (s.frequency === 'yearly') {
        nextDate = addYears(nextDate, 1)
      }

      if (endDate && isAfter(nextDate, endDate)) {
        await client.from('scheduled_transactions').update({ is_active: false, next_date: nextDate.toISOString() }).eq('id', s.id)
        break
      } else {
        await client.from('scheduled_transactions').update({ next_date: nextDate.toISOString() }).eq('id', s.id)
      }
    }
  }

  return createdCount
}
