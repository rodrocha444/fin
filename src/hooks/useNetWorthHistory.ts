// src/hooks/useNetWorthHistory.ts
// ─────────────────────────────────────────────────────────────
// Histórico e projeção futura de Patrimônio Líquido
// Inclui saldo inicial, transações passadas/futuras (parcelamentos)
// e projeção de transações agendadas/recorrentes
// ─────────────────────────────────────────────────────────────

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ScheduledTransaction, TransactionType } from '@/types'

export type Granularity = 'daily' | 'weekly' | 'monthly'

export interface NetWorthPoint {
  date: Date
  dateLabel: string
  netWorth: number
  assets: number
  liabilities: number
  isFuture: boolean
}

export function useNetWorthHistory(
  startDate: Date,
  endDate: Date,
  granularity: Granularity
) {
  const startKey = startDate.toISOString().split('T')[0]
  const endKey = endDate.toISOString().split('T')[0]

  return useLiveQuery(async () => {
    const [accounts, txs, scheduled] = await Promise.all([
      db.accounts.filter(a => a.isActive !== false).toArray(),
      db.transactions.toArray(),
      db.scheduledTransactions.filter(s => s.isActive).toArray(),
    ])

    if (!accounts || accounts.length === 0) return []

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const points: NetWorthPoint[] = []

    let current = new Date(startDate)
    current.setHours(23, 59, 59, 999)

    const limit = new Date(endDate)
    limit.setHours(23, 59, 59, 999)

    let count = 0
    const maxPoints = 500

    while (current <= limit && count < maxPoints) {
      count++
      const pDate = new Date(current)
      const isFuture = pDate > today

      let totalNetWorth = 0
      let totalAssets = 0
      let totalLiabilities = 0

      // Obter ocorrências projetadas de agendamentos se a data for futura
      const projectedOccurrences = isFuture
        ? getProjectedScheduledTransactions(scheduled, today, pDate)
        : []

      for (const acc of accounts) {
        if (acc.id === undefined) continue
        let bal = acc.type === 'credit_card' ? 0 : (acc.initialBalance || 0)

        // 1. Transações reais (passadas e futuras já cadastradas como parcelas)
        for (const tx of txs) {
          const txDate = new Date(tx.date)
          if (txDate > pDate) continue

          if (tx.accountId === acc.id) {
            if (tx.type === 'income') bal += tx.amount
            else if (tx.type === 'expense') bal -= tx.amount
            else if (tx.type === 'transfer') bal -= tx.amount
          }

          if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
            bal += tx.amount
          }
        }

        // 2. Projeção de transações agendadas
        for (const proj of projectedOccurrences) {
          if (proj.accountId === acc.id) {
            if (proj.type === 'income') bal += proj.amount
            else if (proj.type === 'expense') bal -= proj.amount
            else if (proj.type === 'transfer') bal -= proj.amount
          }

          if (proj.transferAccountId === acc.id && proj.type === 'transfer') {
            bal += proj.amount
          }
        }

        totalNetWorth += bal
        if (bal >= 0) totalAssets += bal
        else totalLiabilities += Math.abs(bal)
      }

      let dateLabel = ''
      if (granularity === 'daily') {
        dateLabel = format(pDate, 'dd/MM')
      } else if (granularity === 'weekly') {
        dateLabel = format(pDate, 'dd/MM')
      } else {
        dateLabel = format(pDate, 'MMM/yy', { locale: ptBR })
      }

      points.push({
        date: pDate,
        dateLabel,
        netWorth: totalNetWorth,
        assets: totalAssets,
        liabilities: totalLiabilities,
        isFuture,
      })

      if (granularity === 'daily') {
        current = addDays(current, 1)
      } else if (granularity === 'weekly') {
        current = addWeeks(current, 1)
      } else {
        current = addMonths(current, 1)
      }
    }

    return points
  }, [startKey, endKey, granularity])
}

function getProjectedScheduledTransactions(
  scheduledList: ScheduledTransaction[],
  afterDateExclusive: Date,
  upToDateInclusive: Date
): Array<{ accountId: number; transferAccountId?: number; type: TransactionType; amount: number; date: Date }> {
  const projected: Array<{ accountId: number; transferAccountId?: number; type: TransactionType; amount: number; date: Date }> = []

  for (const s of scheduledList) {
    let next = new Date(s.nextDate)
    const end = s.endDate ? new Date(s.endDate) : null

    // Avançar até depois de afterDateExclusive se necessário
    while (next <= upToDateInclusive) {
      if (end && next > end) break
      if (next > afterDateExclusive) {
        projected.push({
          accountId: s.accountId,
          transferAccountId: s.transferAccountId,
          type: s.type,
          amount: s.amount,
          date: new Date(next),
        })
      }

      if (s.frequency === 'once') break
      else if (s.frequency === 'weekly') next = addWeeks(next, 1)
      else if (s.frequency === 'biweekly') next = addWeeks(next, 2)
      else if (s.frequency === 'monthly') next = addMonths(next, 1)
      else if (s.frequency === 'yearly') next = addMonths(next, 12)
    }
  }

  return projected
}
