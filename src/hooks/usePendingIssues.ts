// src/hooks/usePendingIssues.ts — Hook reativo para detecção de pendências com TanStack Query v5
import { useMemo } from 'react'
import {
  useTransactionsQuery,
  useCategoriesQuery,
  useCategoryGroupsQuery,
  useBudgetMonthsQuery,
} from '@/hooks/queries'
import { computePendingIssues } from '@/services/api/issues'
import type { PendingIssue } from '@/types'

export function usePendingIssues(): PendingIssue[] | undefined {
  const { data: transactions = [], isLoading: l1 } = useTransactionsQuery()
  const { data: categories = [], isLoading: l2 } = useCategoriesQuery()
  const { data: categoryGroups = [], isLoading: l3 } = useCategoryGroupsQuery()
  const { data: budgetMonths = [], isLoading: l4 } = useBudgetMonthsQuery()
  const isLoading = l1 || l2 || l3 || l4

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    return computePendingIssues(
      transactions,
      categories,
      categoryGroups,
      budgetMonths
    )
  }, [
    transactions,
    categories,
    categoryGroups,
    budgetMonths,
    isLoading,
  ])
}
