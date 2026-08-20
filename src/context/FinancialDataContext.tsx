// src/context/FinancialDataContext.tsx — Provedor de Dados Reativo e Realtime (Cloud-Only)
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
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

export interface FinancialDataContextValue {
  accounts: Account[]
  categoryGroups: CategoryGroup[]
  categories: Category[]
  budgetMonths: BudgetMonth[]
  transactions: Transaction[]
  installmentGroups: InstallmentGroup[]
  scheduledTransactions: ScheduledTransaction[]
  debtAccounts: DebtAccount[]
  debtItems: DebtItem[]
  payees: Payee[]
  isLoading: boolean
  isConfigured: boolean
  lastUpdated: Date | null
  refetch: (tableName?: string) => Promise<void>
}

const FinancialDataContext = createContext<FinancialDataContextValue | null>(null)

export const FinancialDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetMonths, setBudgetMonths] = useState<BudgetMonth[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [installmentGroups, setInstallmentGroups] = useState<InstallmentGroup[]>([])
  const [scheduledTransactions, setScheduledTransactions] = useState<ScheduledTransaction[]>([])
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([])
  const [debtItems, setDebtItems] = useState<DebtItem[]>([])
  const [payees, setPayees] = useState<Payee[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isConfigured = Boolean(getSupabaseConfig())

  const fetchTable = useCallback(async (tableName: string) => {
    const client = getSupabaseClient()
    if (!client) return

    try {
      const { data, error } = await client.from(tableName).select('*')
      if (error) {
        console.error(`Erro ao carregar ${tableName}:`, error)
        return
      }

      if (tableName === 'accounts') setAccounts((data || []).map(rowToAccount))
      else if (tableName === 'category_groups') setCategoryGroups((data || []).map(rowToCategoryGroup))
      else if (tableName === 'categories') setCategories((data || []).map(rowToCategory))
      else if (tableName === 'budget_months') setBudgetMonths((data || []).map(rowToBudgetMonth))
      else if (tableName === 'transactions') setTransactions((data || []).map(rowToTransaction))
      else if (tableName === 'installment_groups') setInstallmentGroups((data || []).map(rowToInstallmentGroup))
      else if (tableName === 'scheduled_transactions') setScheduledTransactions((data || []).map(rowToScheduledTransaction))
      else if (tableName === 'debt_accounts') setDebtAccounts((data || []).map(rowToDebtAccount))
      else if (tableName === 'debt_items') setDebtItems((data || []).map(rowToDebtItem))
      else if (tableName === 'payees') setPayees((data || []).map(rowToPayee))

      setLastUpdated(new Date())
    } catch (err) {
      console.error(`Erro na busca de ${tableName}:`, err)
    }
  }, [])

  const fetchAll = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const [
        accsRes,
        groupsRes,
        catsRes,
        budgetRes,
        txsRes,
        instRes,
        schedRes,
        debtAccsRes,
        debtItemsRes,
        payeesRes,
      ] = await Promise.all([
        client.from('accounts').select('*'),
        client.from('category_groups').select('*').order('sort_order', { ascending: true }),
        client.from('categories').select('*').order('sort_order', { ascending: true }),
        client.from('budget_months').select('*'),
        client.from('transactions').select('*'),
        client.from('installment_groups').select('*'),
        client.from('scheduled_transactions').select('*'),
        client.from('debt_accounts').select('*'),
        client.from('debt_items').select('*'),
        client.from('payees').select('*'),
      ])

      if (accsRes.data) setAccounts(accsRes.data.map(rowToAccount))
      if (groupsRes.data) setCategoryGroups(groupsRes.data.map(rowToCategoryGroup))
      if (catsRes.data) setCategories(catsRes.data.map(rowToCategory))
      if (budgetRes.data) setBudgetMonths(budgetRes.data.map(rowToBudgetMonth))
      if (txsRes.data) setTransactions(txsRes.data.map(rowToTransaction))
      if (instRes.data) setInstallmentGroups(instRes.data.map(rowToInstallmentGroup))
      if (schedRes.data) setScheduledTransactions(schedRes.data.map(rowToScheduledTransaction))
      if (debtAccsRes.data) setDebtAccounts(debtAccsRes.data.map(rowToDebtAccount))
      if (debtItemsRes.data) setDebtItems(debtItemsRes.data.map(rowToDebtItem))
      if (payeesRes.data) setPayees(payeesRes.data.map(rowToPayee))

      setLastUpdated(new Date())
    } catch (err) {
      console.error('Erro ao carregar dados do Supabase:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Inicialização e Assinatura Realtime
  useEffect(() => {
    fetchAll()

    const client = getSupabaseClient()
    if (!client) return

    // Configura canal Realtime do Supabase para atualizar a aplicação instantaneamente
    const channel = client
      .channel('finplan_db_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setAccounts(prev => prev.filter(a => a.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setAccounts(prev => [...prev.filter(a => a.id !== (payload.new as any).id), rowToAccount(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setAccounts(prev => prev.map(a => (a.id === (payload.new as any).id ? rowToAccount(payload.new) : a)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'category_groups' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setCategoryGroups(prev => prev.filter(g => g.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setCategoryGroups(prev => [...prev.filter(g => g.id !== (payload.new as any).id), rowToCategoryGroup(payload.new)].sort((a, b) => a.sortOrder - b.sortOrder))
          } else if (payload.eventType === 'UPDATE') {
            setCategoryGroups(prev => prev.map(g => (g.id === (payload.new as any).id ? rowToCategoryGroup(payload.new) : g)).sort((a, b) => a.sortOrder - b.sortOrder))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setCategories(prev => prev.filter(c => c.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setCategories(prev => [...prev.filter(c => c.id !== (payload.new as any).id), rowToCategory(payload.new)].sort((a, b) => a.sortOrder - b.sortOrder))
          } else if (payload.eventType === 'UPDATE') {
            setCategories(prev => prev.map(c => (c.id === (payload.new as any).id ? rowToCategory(payload.new) : c)).sort((a, b) => a.sortOrder - b.sortOrder))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_months' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setBudgetMonths(prev => prev.filter(b => b.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setBudgetMonths(prev => [...prev.filter(b => b.id !== (payload.new as any).id), rowToBudgetMonth(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setBudgetMonths(prev => prev.map(b => (b.id === (payload.new as any).id ? rowToBudgetMonth(payload.new) : b)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setTransactions(prev => prev.filter(t => t.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setTransactions(prev => [...prev.filter(t => t.id !== (payload.new as any).id), rowToTransaction(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setTransactions(prev => prev.map(t => (t.id === (payload.new as any).id ? rowToTransaction(payload.new) : t)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'installment_groups' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setInstallmentGroups(prev => prev.filter(i => i.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setInstallmentGroups(prev => [...prev.filter(i => i.id !== (payload.new as any).id), rowToInstallmentGroup(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setInstallmentGroups(prev => prev.map(i => (i.id === (payload.new as any).id ? rowToInstallmentGroup(payload.new) : i)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_transactions' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setScheduledTransactions(prev => prev.filter(s => s.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setScheduledTransactions(prev => [...prev.filter(s => s.id !== (payload.new as any).id), rowToScheduledTransaction(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setScheduledTransactions(prev => prev.map(s => (s.id === (payload.new as any).id ? rowToScheduledTransaction(payload.new) : s)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debt_accounts' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setDebtAccounts(prev => prev.filter(d => d.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setDebtAccounts(prev => [...prev.filter(d => d.id !== (payload.new as any).id), rowToDebtAccount(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setDebtAccounts(prev => prev.map(d => (d.id === (payload.new as any).id ? rowToDebtAccount(payload.new) : d)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debt_items' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setDebtItems(prev => prev.filter(d => d.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setDebtItems(prev => [...prev.filter(d => d.id !== (payload.new as any).id), rowToDebtItem(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setDebtItems(prev => prev.map(d => (d.id === (payload.new as any).id ? rowToDebtItem(payload.new) : d)))
          }
          setLastUpdated(new Date())
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payees' },
        payload => {
          if (payload.eventType === 'DELETE') {
            setPayees(prev => prev.filter(p => p.id !== (payload.old as any).id))
          } else if (payload.eventType === 'INSERT') {
            setPayees(prev => [...prev.filter(p => p.id !== (payload.new as any).id), rowToPayee(payload.new)])
          } else if (payload.eventType === 'UPDATE') {
            setPayees(prev => prev.map(p => (p.id === (payload.new as any).id ? rowToPayee(payload.new) : p)))
          }
          setLastUpdated(new Date())
        }
      )
      .subscribe()

    // 2. Barramento de eventos local (para respostas imediatas em mutações locais)
    const handleLocalDataChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ table: string; action?: string; id?: string }>
      const table = customEvent.detail?.table
      if (!table || table === 'all') {
        fetchAll()
      } else {
        fetchTable(table)
        if (table === 'transactions' || table === 'installment_groups') {
          fetchTable('accounts')
          fetchTable('budget_months')
        }
      }
    }

    window.addEventListener('finplan_data_changed', handleLocalDataChanged)

    return () => {
      client.removeChannel(channel)
      window.removeEventListener('finplan_data_changed', handleLocalDataChanged)
    }
  }, [fetchAll, fetchTable])

  const refetch = useCallback(async (tableName?: string) => {
    if (tableName) {
      await fetchTable(tableName)
    } else {
      await fetchAll()
    }
  }, [fetchTable, fetchAll])

  const value = useMemo<FinancialDataContextValue>(() => ({
    accounts,
    categoryGroups,
    categories,
    budgetMonths,
    transactions,
    installmentGroups,
    scheduledTransactions,
    debtAccounts,
    debtItems,
    payees,
    isLoading,
    isConfigured,
    lastUpdated,
    refetch,
  }), [
    accounts,
    categoryGroups,
    categories,
    budgetMonths,
    transactions,
    installmentGroups,
    scheduledTransactions,
    debtAccounts,
    debtItems,
    payees,
    isLoading,
    isConfigured,
    lastUpdated,
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
