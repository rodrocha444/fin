// src/hooks/useNetWorthHistory.ts — Histórico e projeção futura de Patrimônio Líquido com TanStack Query v5
import { useMemo } from 'react'
import { useAccountsQuery, useTransactionsQuery, useScheduledTransactionsQuery } from '@/hooks/queries'
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
): NetWorthPoint[] | undefined {
  const { data: accounts = [], isLoading: l1 } = useAccountsQuery()
  const { data: transactions = [], isLoading: l2 } = useTransactionsQuery()
  const { data: scheduledTransactions = [], isLoading: l3 } = useScheduledTransactionsQuery()
  const isLoading = l1 || l2 || l3

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    const activeAccounts = accounts.filter(a => a.isActive !== false)
    if (activeAccounts.length === 0) return []

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const points: NetWorthPoint[] = []

    let current = new Date(startDate)
    current.setHours(23, 59, 59, 999)

    const limit = new Date(endDate)
    limit.setHours(23, 59, 59, 999)

    let count = 0
    const maxPoints = 500

    const activeScheduled = scheduledTransactions.filter(s => s.isActive)

    while (current <= limit && count < maxPoints) {
      count++
      const pDate = new Date(current)
      const isFuture = pDate > today

      let totalNetWorth = 0
      let totalAssets = 0
      let totalLiabilities = 0

      const projectedOccurrences = isFuture
        ? getProjectedScheduledTransactions(activeScheduled, today, pDate)
        : []

      for (const acc of activeAccounts) {
        if (!acc.id) continue
        let bal = acc.type === 'credit_card' ? 0 : (acc.initialBalance || 0)

        // 1. Transações reais
        for (const tx of transactions) {
          const txDate = new Date(tx.date)
          if (txDate > pDate) continue

          if (tx.accountId === acc.id) {
            if (tx.type === 'income') bal += tx.amount
            else if (tx.type === 'expense' || tx.type === 'transfer') bal -= tx.amount
          }

          if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
            bal += tx.amount
          }
        }

        // 2. Projeção de agendamentos
        for (const proj of projectedOccurrences) {
          if (proj.accountId === acc.id) {
            if (proj.type === 'income') bal += proj.amount
            else if (proj.type === 'expense' || proj.type === 'transfer') bal -= proj.amount
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
  }, [accounts, transactions, scheduledTransactions, startDate, endDate, granularity, isLoading])
}

function getProjectedScheduledTransactions(
  scheduledList: ScheduledTransaction[],
  afterDateExclusive: Date,
  upToDateInclusive: Date
): Array<{ accountId: string; transferAccountId?: string; type: TransactionType; amount: number; date: Date }> {
  const projected: Array<{ accountId: string; transferAccountId?: string; type: TransactionType; amount: number; date: Date }> = []

  for (const s of scheduledList) {
    let next = new Date(s.nextDate)
    const end = s.endDate ? new Date(s.endDate) : null

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
