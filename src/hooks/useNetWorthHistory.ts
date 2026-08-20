// src/hooks/useNetWorthHistory.ts — Histórico de Patrimônio Líquido com TanStack Query v5
import { useMemo } from 'react'
import { useAccountsQuery, useTransactionsQuery } from '@/hooks/queries'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { isDateBeforeAccountingStart, getAccountingStartDate } from '@/utils/accountingPeriod'

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
  const isLoading = l1 || l2

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    const activeAccounts = accounts.filter(a => a.isActive !== false)
    if (activeAccounts.length === 0) return []

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const points: NetWorthPoint[] = []

    const accountingStartStr = getAccountingStartDate()
    let effectiveStart = new Date(startDate)
    if (accountingStartStr) {
      const [y, m, d] = accountingStartStr.split('-').map(Number)
      const accStartDate = new Date(y, m - 1, d)
      if (accStartDate > effectiveStart) {
        effectiveStart = accStartDate
      }
    }

    let current = new Date(effectiveStart)
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

      for (const acc of activeAccounts) {
        if (!acc.id) continue
        let bal = acc.type === 'credit_card' ? 0 : (acc.initialBalance || 0)

        // Transações reais até a data do ponto (ignorando anteriores ao período contábil)
        for (const tx of transactions) {
          if (isDateBeforeAccountingStart(tx.date)) continue
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
  }, [accounts, transactions, startDate, endDate, granularity, isLoading])
}
