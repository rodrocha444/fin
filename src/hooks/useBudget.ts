// src/hooks/useBudget.ts — Hooks reativos para orçamento mensal (Cloud-Only)
import { useMemo } from 'react'
import { useFinancialData } from '@/context/FinancialDataContext'
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
  const { categoryGroups, categories, budgetMonths, transactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && categoryGroups.length === 0) return undefined
    return calculateBudgetRows(month, categoryGroups, categories, budgetMonths, transactions)
  }, [month, categoryGroups, categories, budgetMonths, transactions, isLoading])
}

/** Linhas de faturas de cartão de crédito para um mês */
export function useInvoiceBudgetRows(month: string): InvoiceGroupBudgetRow[] | undefined {
  const { accounts, transactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    return calculateInvoiceBudgetRows(month, accounts, transactions)
  }, [month, accounts, transactions, isLoading])
}

/** Linhas do orçamento de receitas/rendas para um mês */
export function useIncomeBudgetRows(month: string): IncomeGroupBudgetRow[] | undefined {
  const { categoryGroups, categories, transactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && categoryGroups.length === 0) return undefined
    return calculateIncomeBudgetRows(month, categoryGroups, categories, transactions)
  }, [month, categoryGroups, categories, transactions, isLoading])
}

/** Resumo "To Be Budgeted" de um mês */
export function useBudgetSummary(month: string): BudgetSummary | undefined {
  const {
    accounts,
    categoryGroups,
    categories,
    budgetMonths,
    transactions,
    scheduledTransactions,
    isLoading,
  } = useFinancialData()

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
  const { categoryGroups, categories, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && categoryGroups.length === 0) return undefined
    const groups = type
      ? categoryGroups.filter(g => (type === 'income' ? g.type === 'income' : g.type !== 'income'))
      : categoryGroups

    return { groups, categories }
  }, [categoryGroups, categories, type, isLoading])
}
