import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient, getSupabaseConfig } from '@/services/supabase'
import {
  QUERY_KEYS,
  TABLE_INVALIDATION_MAP,
  useAccountsQuery,
  useCategoryGroupsQuery,
  useCategoriesQuery,
  useBudgetMonthsQuery,
  useTransactionsQuery,
  useInstallmentGroupsQuery,
  useDebtAccountsQuery,
  useDebtItemsQuery,
  usePayeesQuery,
} from '@/hooks/queries'
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  Transaction,
  InstallmentGroup,
  DebtAccount,
  DebtItem,
  Payee,
} from '@/types'

export { QUERY_KEYS, TABLE_INVALIDATION_MAP }

// ── Tipos do contexto ────────────────────────────────────────────────────────
export interface FinancialDataContextValue {
  accounts: Account[]
  categoryGroups: CategoryGroup[]
  categories: Category[]
  budgetMonths: BudgetMonth[]
  transactions: Transaction[]
  installmentGroups: InstallmentGroup[]
  debtAccounts: DebtAccount[]
  debtItems: DebtItem[]
  payees: Payee[]
  isLoading: boolean
  isConfigured: boolean
  lastUpdated: Date | null
  refetch: (tableName?: string) => Promise<void>
}

const FinancialDataContext = createContext<FinancialDataContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────────
export const FinancialDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  const isConfigured = Boolean(getSupabaseConfig())

  const { data: accounts = [], isLoading: l1 } = useAccountsQuery()
  const { data: categoryGroups = [], isLoading: l2 } = useCategoryGroupsQuery()
  const { data: categories = [], isLoading: l3 } = useCategoriesQuery()
  const { data: budgetMonths = [], isLoading: l4 } = useBudgetMonthsQuery()
  const { data: transactions = [], isLoading: l5 } = useTransactionsQuery()
  const { data: installmentGroups = [], isLoading: l6 } = useInstallmentGroupsQuery()
  const { data: debtAccounts = [], isLoading: l7 } = useDebtAccountsQuery()
  const { data: debtItems = [], isLoading: l8 } = useDebtItemsQuery()
  const { data: payees = [], isLoading: l9 } = usePayeesQuery()

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9

  // ── Supabase Realtime: invalida queries em vez de setar estado manualmente ──
  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) return

    const tables = [
      'accounts', 'category_groups', 'categories', 'budget_months',
      'transactions', 'installment_groups',
      'payees', 'debt_accounts', 'debt_items',
    ] as const

    const channel = client.channel('finplan_db_realtime')

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          const keysToInvalidate = TABLE_INVALIDATION_MAP[table] ?? []
          for (const key of keysToInvalidate) {
            queryClient.invalidateQueries({ queryKey: key })
          }
        }
      )
    }

    channel.subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [queryClient])

  // ── Barramento de eventos local — integração com notifyDataChanged() ────────
  useEffect(() => {
    const handleLocalDataChanged = (e: Event) => {
      const { table } = (e as CustomEvent<{ table: string }>).detail ?? {}
      const keysToInvalidate = TABLE_INVALIDATION_MAP[table ?? 'all'] ?? Object.values(QUERY_KEYS)
      for (const key of keysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    }

    window.addEventListener('finplan_data_changed', handleLocalDataChanged)
    return () => window.removeEventListener('finplan_data_changed', handleLocalDataChanged)
  }, [queryClient])

  // ── refetch manual (compatibilidade com chamadas existentes) ────────────────
  const refetch = useCallback(async (tableName?: string) => {
    const keysToInvalidate = TABLE_INVALIDATION_MAP[tableName ?? 'all'] ?? Object.values(QUERY_KEYS)
    for (const key of keysToInvalidate) {
      await queryClient.invalidateQueries({ queryKey: key })
    }
  }, [queryClient])

  const value = useMemo<FinancialDataContextValue>(() => ({
    accounts,
    categoryGroups,
    categories,
    budgetMonths,
    transactions,
    installmentGroups,
    debtAccounts,
    debtItems,
    payees,
    isLoading,
    isConfigured,
    lastUpdated: new Date(),
    refetch,
  }), [
    accounts,
    categoryGroups,
    categories,
    budgetMonths,
    transactions,
    installmentGroups,
    debtAccounts,
    debtItems,
    payees,
    isLoading,
    isConfigured,
    refetch,
  ])

  return (
    <FinancialDataContext.Provider value={value}>
      {children}
    </FinancialDataContext.Provider>
  )
}

export function useFinancialData() {
  const context = useContext(FinancialDataContext)
  if (!context) {
    throw new Error('useFinancialData deve ser usado dentro de FinancialDataProvider')
  }
  return context
}
