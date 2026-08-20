// src/hooks/usePendingIssues.ts — Hook reativo para detecção de pendências (Cloud-Only)
import { useMemo } from 'react'
import { useFinancialData } from '@/context/FinancialDataContext'
import { computePendingIssues } from '@/services/api/issues'
import type { PendingIssue } from '@/types'

export function usePendingIssues(): PendingIssue[] | undefined {
  const {
    transactions,
    categories,
    categoryGroups,
    budgetMonths,
    scheduledTransactions,
    isLoading,
  } = useFinancialData()

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    return computePendingIssues(
      transactions,
      categories,
      categoryGroups,
      budgetMonths,
      scheduledTransactions
    )
  }, [
    transactions,
    categories,
    categoryGroups,
    budgetMonths,
    scheduledTransactions,
    isLoading,
  ])
}
