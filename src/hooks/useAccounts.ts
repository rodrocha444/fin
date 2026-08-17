// src/hooks/useAccounts.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { calculateAccountBalance } from '@/db/repositories/accounts'

/** Todas as contas ativas, em tempo real */
export function useAccounts() {
  return useLiveQuery(() => db.accounts.orderBy('name').filter(a => a.isActive !== false).toArray(), [])
}

/** Uma conta específica pelo ID */
export function useAccount(accountId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return undefined
      return db.accounts.get(accountId)
    },
    [accountId]
  )
}

/** Saldo de uma conta específica, calculado dinamicamente */
export function useAccountBalance(accountId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return undefined
      return calculateAccountBalance(accountId)
    },
    [accountId]
  )
}

/** Saldo de todas as contas: Map<accountId, balance> */
export function useAllBalances() {
  return useLiveQuery(async () => {
    const accounts = await db.accounts.filter(a => a.isActive !== false).toArray()
    const entries = await Promise.all(
      accounts
        .filter(a => a.id !== undefined)
        .map(async a => [a.id!, await calculateAccountBalance(a.id!)] as [number, number])
    )
    return new Map(entries)
  }, [])
}
