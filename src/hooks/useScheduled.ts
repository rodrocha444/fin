// src/hooks/useScheduled.ts — Hooks reativos para transações agendadas com TanStack Query v5
import { useMemo } from 'react'
import { useScheduledTransactionsQuery } from '@/hooks/queries'
import type { ScheduledTransaction } from '@/types'

/** Todas as transações agendadas ativas */
export function useScheduledTransactions(): ScheduledTransaction[] | undefined {
  const { data: scheduledTransactions = [], isLoading } = useScheduledTransactionsQuery()

  return useMemo(() => {
    if (isLoading && scheduledTransactions.length === 0) return undefined
    return scheduledTransactions
      .filter(s => s.isActive !== false)
      .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
  }, [scheduledTransactions, isLoading])
}
