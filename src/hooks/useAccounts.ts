// src/hooks/useAccounts.ts — Hooks reativos para contas e saldos com TanStack Query v5
import { useMemo } from 'react'
import { useAccountsQuery, useTransactionsQuery } from '@/hooks/queries'
import type { Account } from '@/types'

/** Todas as contas ativas, em tempo real */
export function useAccounts(): Account[] | undefined {
  const { data: accounts = [], isLoading } = useAccountsQuery()
  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    return accounts.filter(a => a.isActive !== false)
  }, [accounts, isLoading])
}

/** Uma conta específica pelo ID */
export function useAccount(accountId: string | undefined): Account | undefined {
  const { data: accounts = [] } = useAccountsQuery()
  return useMemo(() => {
    if (!accountId) return undefined
    return accounts.find(a => a.id === accountId)
  }, [accounts, accountId])
}

/** Saldo de uma conta específica, calculado dinamicamente */
export function useAccountBalance(accountId: string | undefined): number | undefined {
  const { data: accounts = [] } = useAccountsQuery()
  const { data: transactions = [] } = useTransactionsQuery()

  return useMemo(() => {
    if (!accountId) return undefined
    const account = accounts.find(a => a.id === accountId)
    if (!account) return 0

    let balance = Number(account.initialBalance || 0)
    if (account.type === 'credit_card' && balance > 0) {
      balance = -balance
    }

    // 1. Transações diretas
    for (const tx of transactions) {
      if (tx.accountId === accountId) {
        const amount = Number(tx.amount || 0)
        if (account.type === 'credit_card') {
          if (tx.type === 'expense') balance -= amount
          else if (tx.type === 'income' || tx.type === 'transfer') balance += amount
        } else {
          if (tx.type === 'income') balance += amount
          else if (tx.type === 'expense' || tx.type === 'transfer') balance -= amount
        }
      }
      // 2. Transferências de entrada
      if (tx.transferAccountId === accountId && tx.type === 'transfer') {
        balance += Number(tx.amount || 0)
      }
    }

    return balance
  }, [accounts, transactions, accountId])
}

/** Verifica se uma conta possui transações vinculadas (reativo) */
export function useHasAccountTransactions(accountId: string | undefined): boolean {
  const { data: transactions = [] } = useTransactionsQuery()
  return useMemo(() => {
    if (!accountId) return false
    return transactions.some(t => t.accountId === accountId || t.transferAccountId === accountId)
  }, [transactions, accountId])
}

/** Saldo de todas as contas: Map<accountId, balance> */
export function useAllBalances(): Map<string, number> | undefined {
  const { data: accounts = [], isLoading: lAccounts } = useAccountsQuery()
  const { data: transactions = [], isLoading: lTransactions } = useTransactionsQuery()
  const isLoading = lAccounts || lTransactions

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    const map = new Map<string, number>()

    for (const acc of accounts) {
      if (!acc.id || acc.isActive === false) continue
      let balance = Number(acc.initialBalance || 0)
      if (acc.type === 'credit_card' && balance > 0) {
        balance = -balance
      }

      for (const tx of transactions) {
        if (tx.accountId === acc.id) {
          const amount = Number(tx.amount || 0)
          if (acc.type === 'credit_card') {
            if (tx.type === 'expense') balance -= amount
            else if (tx.type === 'income' || tx.type === 'transfer') balance += amount
          } else {
            if (tx.type === 'income') balance += amount
            else if (tx.type === 'expense' || tx.type === 'transfer') balance -= amount
          }
        }
        if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
          balance += Number(tx.amount || 0)
        }
      }

      map.set(acc.id, balance)
    }

    return map
  }, [accounts, transactions, isLoading])
}
