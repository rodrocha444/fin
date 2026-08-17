// src/hooks/useDebts.ts
// ─────────────────────────────────────────────────────────────
// Hooks reativos para Contas a Receber / Pagar e Cobranças
// ─────────────────────────────────────────────────────────────

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { getDebtSummary, getDebtItemsByAccount } from '@/db/repositories/debts'
import type { DebtAccount, DebtItem, DebtSummary } from '@/types'

export interface DebtAccountWithStats extends DebtAccount {
  receivable: number
  payable: number
  balance: number
  pendingCount: number
  totalCount: number
}

/** Retorna todas as contas ativas com seus respectivos saldos e contadores */
export function useDebtAccounts() {
  return useLiveQuery(async () => {
    const [accounts, items] = await Promise.all([
      db.debtAccounts.orderBy('name').filter(a => a.isActive !== false).toArray(),
      db.debtItems.toArray(),
    ])

    const itemsByAccount = new Map<number, DebtItem[]>()
    for (const item of items) {
      const list = itemsByAccount.get(item.debtAccountId) || []
      list.push(item)
      itemsByAccount.set(item.debtAccountId, list)
    }

    const result: DebtAccountWithStats[] = accounts.map(acc => {
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

    return result
  }, [])
}

/** Retorna os detalhes de uma conta de cobrança específica e todos os seus itens */
export function useDebtAccountWithItems(accountId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return null

      const account = await db.debtAccounts.get(accountId)
      if (!account) return null

      const items = await getDebtItemsByAccount(accountId)

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
    },
    [accountId]
  )
}

/** Resumo geral de todas as pendências ativas */
export function useDebtsSummary(): DebtSummary | undefined {
  return useLiveQuery(() => getDebtSummary(), [])
}
