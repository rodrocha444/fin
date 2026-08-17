// src/db/repositories/scheduled.ts
// ─────────────────────────────────────────────────────────────
// Transações agendadas: CRUD e processamento automático
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
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
  scheduledId: number
  accountId: number
  transferAccountId?: number
  type: TransactionType
  amount: number
  categoryId?: number
  payee: string
  notes?: string
  date: Date
  isScheduledProjection: true
}

// ── CRUD ─────────────────────────────────────────────────────

export async function createScheduled(
  data: Omit<ScheduledTransaction, 'id' | 'createdAt'>
): Promise<number> {
  return db.scheduledTransactions.add({ ...data, createdAt: new Date() }) as Promise<number>
}

export async function updateScheduled(
  id: number,
  data: Partial<Omit<ScheduledTransaction, 'id' | 'createdAt'>>
): Promise<void> {
  await db.scheduledTransactions.update(id, data)
}

export async function deleteScheduled(id: number): Promise<void> {
  await db.scheduledTransactions.delete(id)
}

export async function getAllScheduled(): Promise<ScheduledTransaction[]> {
  return db.scheduledTransactions
    .orderBy('nextDate')
    .filter(s => s.isActive !== false)
    .toArray()
}

export async function getUpcomingScheduled(daysAhead = 30): Promise<ScheduledTransaction[]> {
  const today = startOfDay(new Date())
  const future = addDays(today, daysAhead)
  return db.scheduledTransactions
    .where('nextDate')
    .between(today, future, true, true)
    .filter(s => s.isActive !== false)
    .toArray()
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
  const projected: ProjectedScheduledOccurrence[] = []
  const todayThreshold = new Date(afterDateExclusive)

  for (const s of scheduledList) {
    if (s.isActive === false) continue
    let current = new Date(s.nextDate)
    const end = s.endDate ? new Date(s.endDate) : null

    // Avançar até o mês alvo
    while (true) {
      const curMonth = format(current, 'yyyy-MM')
      if (curMonth > month) break
      if (end && current > end) break

      if (curMonth === month && current > todayThreshold) {
        projected.push({
          scheduledId: s.id!,
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

// ── Processamento automático ─────────────────────────────────
//
// Chamado na inicialização do app e ao navegar entre páginas.
// Verifica todas as transações agendadas com nextDate <= hoje
// e as converte em transações reais.

export async function processScheduledTransactions(): Promise<number> {
  const today = startOfDay(new Date())
  const actives = await db.scheduledTransactions
    .filter(s => s.isActive !== false)
    .toArray()

  let processed = 0

  for (const scheduled of actives) {
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
        await db.scheduledTransactions.update(scheduled.id!, { isActive: false })
        break
      }

      nextDate = advanceNextDate(nextDate, scheduled.frequency)

      // Verificar se atingiu a data de fim
      if (scheduled.endDate && isAfter(nextDate, new Date(scheduled.endDate))) {
        await db.scheduledTransactions.update(scheduled.id!, { isActive: false })
        break
      }
    }

    // Atualizar nextDate no banco
    if (scheduled.frequency !== 'once' && scheduled.isActive) {
      await db.scheduledTransactions.update(scheduled.id!, { nextDate })
    }
  }

  return processed
}
