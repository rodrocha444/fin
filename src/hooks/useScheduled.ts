// src/hooks/useScheduled.ts — Hooks reativos para transações agendadas (Cloud-Only)
import { useMemo } from 'react'
import { useFinancialData } from '@/context/FinancialDataContext'
import type { ScheduledTransaction } from '@/types'

/** Todas as transações agendadas ativas */
export function useScheduledTransactions(): ScheduledTransaction[] | undefined {
  const { scheduledTransactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && scheduledTransactions.length === 0) return undefined
    return scheduledTransactions
      .filter(s => s.isActive !== false)
      .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
  }, [scheduledTransactions, isLoading])
}
