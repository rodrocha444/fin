// src/db/repositories/scheduled.ts
// ─────────────────────────────────────────────────────────────
// Transações agendadas: CRUD e processamento automático (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { ScheduledTransaction, TransactionType } from '@/types'
import { createTransaction, createTransfer } from './transactions'
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns'

// ── Tipos de Projeção ────────────────────────────────────────

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

// ── CRUD ─────────────────────────────────────────────────────

export async function createScheduled(
  data: Omit<ScheduledTransaction, 'id' | 'createdAt'>
): Promise<string> {
  const id = createId()
  await db.scheduledTransactions.add({ ...data, id, createdAt: new Date() })
  return id
}

export async function updateScheduled(
  id: string,
  data: Partial<Omit<ScheduledTransaction, 'id' | 'createdAt'>>
): Promise<void> {
  await db.scheduledTransactions.update(id, data)
}

export async function deleteScheduled(id: string): Promise<void> {
  await db.scheduledTransactions.delete(id)
}

/**
 * Retorna todas as ocorrências projetadas de agendamentos para um mês específico
 * que ainda não se tornaram transações no banco (data > hoje).
 */
export function getProjectedScheduledForMonth(
  scheduledList: ScheduledTransaction[],
  month: string, // 'yyyy-MM'
  afterDateExclusive: Date = new Date()
): ProjectedScheduledOccurrence[] {
  return getProjectedScheduledUpToMonth(scheduledList, month, afterDateExclusive).filter(
    p => format(p.date, 'yyyy-MM') === month
  )
}

/**
 * Retorna todas as ocorrências projetadas de agendamentos até um mês específico (inclusive)
 * que ainda não se tornaram transações no banco (data > hoje).
 */
export function getProjectedScheduledUpToMonth(
  scheduledList: ScheduledTransaction[],
  upToMonth: string, // 'yyyy-MM'
  afterDateExclusive: Date = new Date()
): ProjectedScheduledOccurrence[] {
  const projected: ProjectedScheduledOccurrence[] = []
  const todayThreshold = new Date(afterDateExclusive)

  for (const s of scheduledList) {
    if (s.isActive === false || !s.id) continue
    let current = new Date(s.nextDate)
    const end = s.endDate ? new Date(s.endDate) : null

    // Avançar até o mês alvo
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

/**
 * Retorna todas as ocorrências projetadas de agendamentos para uma conta específica
 * (como pagadora ou recebedora em transferências), para os próximos meses.
 */
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

// ── Lógica de avanço de data ─────────────────────────────────

function advanceNextDate(current: Date, frequency: ScheduledTransaction['frequency']): Date {
  switch (frequency) {
    case 'once':    return current // não avança (desativado após disparo)
    case 'weekly':  return addWeeks(current, 1)
    case 'biweekly': return addWeeks(current, 2)
    case 'monthly': return addMonths(current, 1)
    case 'yearly':  return addYears(current, 1)
    default:        return addMonths(current, 1)
  }
}

/**
 * Efetiva/confirma uma ocorrência de agendamento, transformando-a em transação real
 * e avançando a próxima data do agendamento (ou desativando se for disparo único).
 */
export async function confirmScheduledOccurrence(
  scheduledId: string,
  occurrenceDate?: Date
): Promise<void> {
  const scheduled = await db.scheduledTransactions.get(scheduledId)
  if (!scheduled) return

  const txDate = occurrenceDate || new Date(scheduled.nextDate)

  // 1. Criar a transação real
  if (scheduled.type === 'transfer' && scheduled.transferAccountId) {
    await createTransfer({
      fromAccountId: scheduled.accountId,
      toAccountId: scheduled.transferAccountId,
      amount: scheduled.amount,
      date: txDate,
      notes: scheduled.notes,
      payee: scheduled.payee,
    })
  } else {
    await createTransaction({
      accountId: scheduled.accountId,
      date: txDate,
      amount: scheduled.amount,
      payee: scheduled.payee,
      categoryId: scheduled.categoryId,
      notes: scheduled.notes,
      cleared: true,
      type: scheduled.type,
    })
  }

  // 2. Atualizar ou avançar o agendamento
  if (scheduled.frequency === 'once') {
    await db.scheduledTransactions.update(scheduledId, { isActive: false })
  } else {
    const nextDate = advanceNextDate(new Date(scheduled.nextDate), scheduled.frequency)
    if (scheduled.endDate && isAfter(nextDate, new Date(scheduled.endDate))) {
      await db.scheduledTransactions.update(scheduledId, { isActive: false, nextDate })
    } else {
      await db.scheduledTransactions.update(scheduledId, { nextDate })
    }
  }
}

// ── Processamento automático ─────────────────────────────────

export async function processScheduledTransactions(): Promise<number> {
  const today = startOfDay(new Date())
  const actives = await db.scheduledTransactions
    .filter(s => s.isActive !== false)
    .toArray()

  let processed = 0

  for (const scheduled of actives) {
    if (!scheduled.id) continue
    let nextDate = new Date(scheduled.nextDate)

    // Processar todas as datas vencidas em loop (pode ter ficado muito tempo sem abrir o app)
    while (isBefore(nextDate, today) || nextDate.getTime() === today.getTime()) {
      // Criar a transação real
      if (scheduled.type === 'transfer' && scheduled.transferAccountId) {
        await createTransfer({
          fromAccountId: scheduled.accountId,
          toAccountId: scheduled.transferAccountId,
          amount: scheduled.amount,
          date: nextDate,
          notes: scheduled.notes,
          payee: scheduled.payee,
        })
      } else {
        await createTransaction({
          accountId: scheduled.accountId,
          date: nextDate,
          amount: scheduled.amount,
          payee: scheduled.payee,
          categoryId: scheduled.categoryId,
          notes: scheduled.notes,
          cleared: false,
          type: scheduled.type,
        })
      }

      processed++

      if (scheduled.frequency === 'once') {
        // Desativar após único disparo
        await db.scheduledTransactions.update(scheduled.id, { isActive: false })
        break
      }

      nextDate = advanceNextDate(nextDate, scheduled.frequency)

      // Verificar se atingiu a data de fim
      if (scheduled.endDate && isAfter(nextDate, new Date(scheduled.endDate))) {
        await db.scheduledTransactions.update(scheduled.id, { isActive: false })
        break
      }
    }

    // Atualizar nextDate no banco
    if (scheduled.frequency !== 'once' && scheduled.isActive) {
      await db.scheduledTransactions.update(scheduled.id, { nextDate })
    }
  }

  return processed
}
