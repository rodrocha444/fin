// src/hooks/usePendingIssues.ts — Hook reativo para detecção de pendências com TanStack Query v5
import { useMemo } from 'react'
import {
  useTransactionsQuery,
  useCategoriesQuery,
  useCategoryGroupsQuery,
  useBudgetMonthsQuery,
  useAccountsQuery,
  useInstallmentGroupsQuery,
} from '@/hooks/queries'
import { computePendingIssues } from '@/services/api/issues'
import type { PendingIssue } from '@/types'
import type { AccountingRegime } from '@/utils/accountingRegime'

export function usePendingIssues(
  month?: string,
  regime: AccountingRegime = 'cash'
): PendingIssue[] | undefined {
  const { data: accounts = [], isLoading: l0 } = useAccountsQuery()
  const { data: transactions = [], isLoading: l1 } = useTransactionsQuery()
  const { data: categories = [], isLoading: l2 } = useCategoriesQuery()
  const { data: categoryGroups = [], isLoading: l3 } = useCategoryGroupsQuery()
  const { data: budgetMonths = [], isLoading: l4 } = useBudgetMonthsQuery()
  const { data: installmentGroups = [], isLoading: l5 } = useInstallmentGroupsQuery()
  const isLoading = l0 || l1 || l2 || l3 || l4 || l5

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    return computePendingIssues(
      transactions,
      categories,
      categoryGroups,
      budgetMonths,
      accounts,
      month,
      regime,
      installmentGroups
    )
  }, [
    transactions,
    categories,
    categoryGroups,
    budgetMonths,
    accounts,
    month,
    regime,
    installmentGroups,
    isLoading,
  ])
}
