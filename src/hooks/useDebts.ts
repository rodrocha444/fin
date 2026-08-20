// src/hooks/useDebts.ts — Hooks reativos para Contas a Receber / Pagar com TanStack Query v5
import { useMemo } from 'react'
import { useDebtAccountsQuery, useDebtItemsQuery } from '@/hooks/queries'
import type { DebtAccount, DebtItem, DebtSummary } from '@/types'

export interface DebtAccountWithStats extends DebtAccount {
  receivable: number
  payable: number
  balance: number
  pendingCount: number
  totalCount: number
}

/** Retorna todas as contas ativas com seus respectivos saldos e contadores */
export function useDebtAccounts(): DebtAccountWithStats[] | undefined {
  const { data: debtAccounts = [], isLoading: l1 } = useDebtAccountsQuery()
  const { data: debtItems = [], isLoading: l2 } = useDebtItemsQuery()
  const isLoading = l1 || l2

  return useMemo(() => {
    if (isLoading && debtAccounts.length === 0) return undefined

    const activeAccounts = debtAccounts.filter(a => a.isActive !== false)
    const itemsByAccount = new Map<string, DebtItem[]>()

    for (const item of debtItems) {
      const list = itemsByAccount.get(item.debtAccountId) || []
      list.push(item)
      itemsByAccount.set(item.debtAccountId, list)
    }

    return activeAccounts.map(acc => {
      const accItems = itemsByAccount.get(acc.id!) || []
      let receivable = 0
      let payable = 0
      let pendingCount = 0

      for (const item of accItems) {
        if (item.status === 'pending') {
          pendingCount++
          if (item.type === 'receivable') receivable += item.amount
          else if (item.type === 'payable') payable += item.amount
        }
      }

      return {
        ...acc,
        receivable,
        payable,
        balance: receivable - payable,
        pendingCount,
        totalCount: accItems.length,
      }
    })
  }, [debtAccounts, debtItems, isLoading])
}

/** Retorna os detalhes de uma conta de cobrança específica e todos os seus itens */
export function useDebtAccountWithItems(accountId: string | undefined): {
  account: DebtAccount
  items: DebtItem[]
  receivable: number
  payable: number
  balance: number
  pendingCount: number
  totalCount: number
} | null | undefined {
  const { data: debtAccounts = [], isLoading: l1 } = useDebtAccountsQuery()
  const { data: debtItems = [], isLoading: l2 } = useDebtItemsQuery()
  const isLoading = l1 || l2

  return useMemo(() => {
    if (isLoading && debtAccounts.length === 0) return undefined
    if (!accountId) return null

    const account = debtAccounts.find(a => a.id === accountId)
    if (!account) return null

    const items = debtItems
      .filter(i => i.debtAccountId === accountId)
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

    let receivable = 0
    let payable = 0
    let pendingCount = 0

    for (const item of items) {
      if (item.status === 'pending') {
        pendingCount++
        if (item.type === 'receivable') receivable += item.amount
        else if (item.type === 'payable') payable += item.amount
      }
    }

    return {
      account,
      items,
      receivable,
      payable,
      balance: receivable - payable,
      pendingCount,
      totalCount: items.length,
    }
  }, [debtAccounts, debtItems, accountId, isLoading])
}

/** Resumo geral de todas as pendências ativas */
export function useDebtsSummary(): DebtSummary | undefined {
  const { data: debtItems = [], isLoading } = useDebtItemsQuery()

  return useMemo(() => {
    if (isLoading && debtItems.length === 0) return undefined
    const items = debtItems.filter(i => i.status === 'pending')

    let totalReceivable = 0
    let totalPayable = 0

    for (const item of items) {
      if (item.type === 'receivable') totalReceivable += item.amount
      else if (item.type === 'payable') totalPayable += item.amount
    }

    return {
      totalReceivable,
      totalPayable,
      netBalance: totalReceivable - totalPayable,
      pendingCount: items.length,
    }
  }, [debtItems, isLoading])
}
