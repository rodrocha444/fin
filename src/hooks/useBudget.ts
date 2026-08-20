// src/hooks/useBudget.ts — Hooks reativos para orçamento mensal com TanStack Query v5
import { useMemo } from 'react'
import {
  useAccountsQuery,
  useCategoryGroupsQuery,
  useCategoriesQuery,
  useBudgetMonthsQuery,
  useTransactionsQuery,
  useScheduledTransactionsQuery,
} from '@/hooks/queries'
import {
  calculateBudgetRows,
  calculateIncomeBudgetRows,
  calculateInvoiceBudgetRows,
  calculateBudgetSummary,
} from '@/services/api/budget'
import type {
  GroupBudgetRow,
  IncomeGroupBudgetRow,
  InvoiceGroupBudgetRow,
  BudgetSummary,
  CategoryGroup,
  Category,
} from '@/types'

/** Linhas do orçamento de despesas agrupadas por grupo/categoria para um mês */
export function useBudgetRows(month: string): GroupBudgetRow[] | undefined {
  const { data: categoryGroups = [], isLoading: l1 } = useCategoryGroupsQuery()
  const { data: categories = [], isLoading: l2 } = useCategoriesQuery()
  const { data: budgetMonths = [], isLoading: l3 } = useBudgetMonthsQuery()
  const { data: transactions = [], isLoading: l4 } = useTransactionsQuery()
  const isLoading = l1 || l2 || l3 || l4

  return useMemo(() => {
    if (isLoading && categoryGroups.length === 0) return undefined
    return calculateBudgetRows(
      month,
      categoryGroups,
      categories,
      budgetMonths,
      transactions
    )
  }, [month, categoryGroups, categories, budgetMonths, transactions, isLoading])
}

/** Linhas de faturas de cartão de crédito para um mês */
export function useInvoiceBudgetRows(month: string): InvoiceGroupBudgetRow[] | undefined {
  const { data: accounts = [], isLoading: l1 } = useAccountsQuery()
  const { data: transactions = [], isLoading: l2 } = useTransactionsQuery()
  const isLoading = l1 || l2

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    return calculateInvoiceBudgetRows(month, accounts, transactions)
  }, [month, accounts, transactions, isLoading])
}

/** Linhas do orçamento de receitas/rendas para um mês */
export function useIncomeBudgetRows(month: string): IncomeGroupBudgetRow[] | undefined {
  const { data: categoryGroups = [], isLoading: l1 } = useCategoryGroupsQuery()
  const { data: categories = [], isLoading: l2 } = useCategoriesQuery()
  const { data: transactions = [], isLoading: l3 } = useTransactionsQuery()
  const isLoading = l1 || l2 || l3

  return useMemo(() => {
    if (isLoading && categoryGroups.length === 0) return undefined
    return calculateIncomeBudgetRows(
      month,
      categoryGroups,
      categories,
      transactions
    )
  }, [month, categoryGroups, categories, transactions, isLoading])
}

/** Resumo "To Be Budgeted" de um mês */
export function useBudgetSummary(month: string): BudgetSummary | undefined {
  const { data: accounts = [], isLoading: l1 } = useAccountsQuery()
  const { data: categoryGroups = [], isLoading: l2 } = useCategoryGroupsQuery()
  const { data: categories = [], isLoading: l3 } = useCategoriesQuery()
  const { data: budgetMonths = [], isLoading: l4 } = useBudgetMonthsQuery()
  const { data: transactions = [], isLoading: l5 } = useTransactionsQuery()
  const { data: scheduledTransactions = [], isLoading: l6 } = useScheduledTransactionsQuery()
  const isLoading = l1 || l2 || l3 || l4 || l5 || l6

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    return calculateBudgetSummary(
      month,
      accounts,
      categoryGroups,
      categories,
      budgetMonths,
      transactions,
      scheduledTransactions
    )
  }, [
    month,
    accounts,
    categoryGroups,
    categories,
    budgetMonths,
    transactions,
    scheduledTransactions,
    isLoading,
  ])
}

/** Grupos e categorias (para seleção em formulários), com filtro opcional por tipo */
export function useCategoriesWithGroups(type?: 'expense' | 'income'): {
  groups: CategoryGroup[]
  categories: Category[]
} | undefined {
  const { data: categoryGroups = [], isLoading: l1 } = useCategoryGroupsQuery()
  const { data: categories = [], isLoading: l2 } = useCategoriesQuery()
  const isLoading = l1 || l2

  return useMemo(() => {
    if (isLoading && categoryGroups.length === 0) return undefined
    const groups = type
      ? categoryGroups.filter(g => (type === 'income' ? g.type === 'income' : g.type !== 'income'))
      : categoryGroups

    return { groups, categories }
  }, [categoryGroups, categories, type, isLoading])
}
