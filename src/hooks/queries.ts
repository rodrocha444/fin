// src/hooks/queries.ts — Hooks de consulta dedicados do TanStack Query v5
import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient, getSupabaseConfig } from '@/services/supabase'
import {
  rowToAccount,
  rowToCategoryGroup,
  rowToCategory,
  rowToBudgetMonth,
  rowToTransaction,
  rowToInstallmentGroup,
  rowToScheduledTransaction,
  rowToDebtAccount,
  rowToDebtItem,
  rowToPayee,
} from '@/services/api/types'
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  Transaction,
  InstallmentGroup,
  ScheduledTransaction,
  DebtAccount,
  DebtItem,
  Payee,
} from '@/types'

// ── Query Keys ───────────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  accounts: ['accounts'] as const,
  categoryGroups: ['category_groups'] as const,
  categories: ['categories'] as const,
  budgetMonths: ['budget_months'] as const,
  transactions: ['transactions'] as const,
  installmentGroups: ['installment_groups'] as const,
  scheduledTransactions: ['scheduled_transactions'] as const,
  debtAccounts: ['debt_accounts'] as const,
  debtItems: ['debt_items'] as const,
  payees: ['payees'] as const,
} as const

// ── Mapa: tabela → query keys a invalidar ────────────────────────────────────
export const TABLE_INVALIDATION_MAP: Record<string, ReadonlyArray<readonly string[]>> = {
  accounts: [QUERY_KEYS.accounts],
  category_groups: [QUERY_KEYS.categoryGroups],
  categories: [QUERY_KEYS.categories],
  budget_months: [QUERY_KEYS.budgetMonths],
  transactions: [QUERY_KEYS.transactions, QUERY_KEYS.accounts, QUERY_KEYS.budgetMonths],
  installment_groups: [QUERY_KEYS.installmentGroups, QUERY_KEYS.transactions, QUERY_KEYS.accounts],
  scheduled_transactions: [QUERY_KEYS.scheduledTransactions],
  debt_accounts: [QUERY_KEYS.debtAccounts],
  debt_items: [QUERY_KEYS.debtItems],
  payees: [QUERY_KEYS.payees],
  all: Object.values(QUERY_KEYS),
}

// ── Funções de Fetch ─────────────────────────────────────────────────────────
export async function fetchAccounts(): Promise<Account[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('accounts').select('*')
  if (error) throw new Error(`accounts: ${error.message}`)
  return (data ?? []).map(rowToAccount)
}

export async function fetchCategoryGroups(): Promise<CategoryGroup[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('category_groups').select('*').order('sort_order', { ascending: true })
  if (error) throw new Error(`category_groups: ${error.message}`)
  return (data ?? []).map(rowToCategoryGroup)
}

export async function fetchCategories(): Promise<Category[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('categories').select('*').order('sort_order', { ascending: true })
  if (error) throw new Error(`categories: ${error.message}`)
  return (data ?? []).map(rowToCategory)
}

export async function fetchBudgetMonths(): Promise<BudgetMonth[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('budget_months').select('*')
  if (error) throw new Error(`budget_months: ${error.message}`)
  return (data ?? []).map(rowToBudgetMonth)
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('transactions').select('*')
  if (error) throw new Error(`transactions: ${error.message}`)
  return (data ?? []).map(rowToTransaction)
}

export async function fetchInstallmentGroups(): Promise<InstallmentGroup[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('installment_groups').select('*')
  if (error) throw new Error(`installment_groups: ${error.message}`)
  return (data ?? []).map(rowToInstallmentGroup)
}

export async function fetchScheduledTransactions(): Promise<ScheduledTransaction[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('scheduled_transactions').select('*')
  if (error) throw new Error(`scheduled_transactions: ${error.message}`)
  return (data ?? []).map(rowToScheduledTransaction)
}

export async function fetchDebtAccounts(): Promise<DebtAccount[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('debt_accounts').select('*')
  if (error) throw new Error(`debt_accounts: ${error.message}`)
  return (data ?? []).map(rowToDebtAccount)
}

export async function fetchDebtItems(): Promise<DebtItem[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('debt_items').select('*')
  if (error) throw new Error(`debt_items: ${error.message}`)
  return (data ?? []).map(rowToDebtItem)
}

export async function fetchPayees(): Promise<Payee[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client.from('payees').select('*')
  if (error) throw new Error(`payees: ${error.message}`)
  return (data ?? []).map(rowToPayee)
}

// ── Opções comuns ────────────────────────────────────────────────────────────
function useQueryOptions() {
  const isConfigured = Boolean(getSupabaseConfig())
  return {
    enabled: isConfigured,
    staleTime: 1000 * 30,
  }
}

// ── Hooks Individuais de Query com tipagem explícita ─────────────────────────
export function useAccountsQuery() {
  const opts = useQueryOptions()
  return useQuery<Account[]>({ queryKey: QUERY_KEYS.accounts, queryFn: fetchAccounts, ...opts })
}

export function useCategoryGroupsQuery() {
  const opts = useQueryOptions()
  return useQuery<CategoryGroup[]>({ queryKey: QUERY_KEYS.categoryGroups, queryFn: fetchCategoryGroups, ...opts })
}

export function useCategoriesQuery() {
  const opts = useQueryOptions()
  return useQuery<Category[]>({ queryKey: QUERY_KEYS.categories, queryFn: fetchCategories, ...opts })
}

export function useBudgetMonthsQuery() {
  const opts = useQueryOptions()
  return useQuery<BudgetMonth[]>({ queryKey: QUERY_KEYS.budgetMonths, queryFn: fetchBudgetMonths, ...opts })
}

export function useTransactionsQuery() {
  const opts = useQueryOptions()
  return useQuery<Transaction[]>({ queryKey: QUERY_KEYS.transactions, queryFn: fetchTransactions, ...opts })
}

export function useInstallmentGroupsQuery() {
  const opts = useQueryOptions()
  return useQuery<InstallmentGroup[]>({ queryKey: QUERY_KEYS.installmentGroups, queryFn: fetchInstallmentGroups, ...opts })
}

export function useScheduledTransactionsQuery() {
  const opts = useQueryOptions()
  return useQuery<ScheduledTransaction[]>({ queryKey: QUERY_KEYS.scheduledTransactions, queryFn: fetchScheduledTransactions, ...opts })
}

export function useDebtAccountsQuery() {
  const opts = useQueryOptions()
  return useQuery<DebtAccount[]>({ queryKey: QUERY_KEYS.debtAccounts, queryFn: fetchDebtAccounts, ...opts })
}

export function useDebtItemsQuery() {
  const opts = useQueryOptions()
  return useQuery<DebtItem[]>({ queryKey: QUERY_KEYS.debtItems, queryFn: fetchDebtItems, ...opts })
}

export function usePayeesQuery() {
  const opts = useQueryOptions()
  return useQuery<Payee[]>({ queryKey: QUERY_KEYS.payees, queryFn: fetchPayees, ...opts })
}
