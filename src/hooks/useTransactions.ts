// src/hooks/useTransactions.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { getTransactionsByAccount, getTransactionsByMonth, getMonthSummary } from '@/db/repositories/transactions'
import { getProjectedScheduledForMonth } from '@/db/repositories/scheduled'
import { startOfMonth, endOfMonth } from 'date-fns'
import type { Transaction } from '@/types'

/** Transações de uma conta (todas ordenadas por createdAt desc) */
export function useAccountTransactions(accountId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return []
      return getTransactionsByAccount(accountId)
    },
    [accountId]
  )
}

/** Transações de um mês (YYYY-MM), incluindo ocorrências futuras de agendamentos */
export function useMonthTransactions(month: string) {
  return useLiveQuery(async () => {
    const [txs, scheduled] = await Promise.all([
      getTransactionsByMonth(month),
      db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
    ])

    const projected = getProjectedScheduledForMonth(scheduled, month)
    const projectedTxs: Transaction[] = projected.map(p => ({
      accountId: p.accountId,
      transferAccountId: p.transferAccountId,
      date: p.date,
      amount: p.amount,
      payee: p.payee,
      categoryId: p.categoryId,
      notes: p.notes,
      cleared: false,
      type: p.type,
      isScheduledProjection: true,
      scheduledId: p.scheduledId,
      createdAt: p.date,
    }))

    return [...txs, ...projectedTxs]
  }, [month])
}

/** Resumo (income / expense) de um mês */
export function useMonthSummary(month: string) {
  return useLiveQuery(() => getMonthSummary(month), [month])
}

/** Parcelamentos de um grupo */
export function useInstallmentGroup(groupId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (groupId === undefined) return undefined
      const [group, transactions] = await Promise.all([
        db.installmentGroups.get(groupId),
        db.transactions.where('installmentGroupId').equals(groupId).sortBy('date'),
      ])
      return { group, transactions }
    },
    [groupId]
  )
}

export interface CreditCardPurchase {
  id: string
  groupId?: number
  transactionId?: number
  payee: string
  date: Date
  amount: number
  installmentCount?: number
  installmentAmount?: number
  categoryId?: number
  notes?: string
  type: 'expense' | 'income' | 'transfer'
  isInstallment: boolean
}

/** Histórico consolidado de compras para conta do tipo Cartão de Crédito */
export function useCreditCardPurchases(accountId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return []

      const [allTxs, allGroups] = await Promise.all([
        db.transactions
          .where('accountId')
          .equals(accountId)
          .reverse()
          .sortBy('date'),
        db.installmentGroups
          .where('accountId')
          .equals(accountId)
          .toArray(),
      ])

      const groupMap = new Map(allGroups.map(g => [g.id!, g]))
      const seenGroupIds = new Set<number>()
      const purchases: CreditCardPurchase[] = []

      for (const tx of allTxs) {
        if (tx.installmentGroupId) {
          if (seenGroupIds.has(tx.installmentGroupId)) {
            continue
          }
          seenGroupIds.add(tx.installmentGroupId)

          const group = groupMap.get(tx.installmentGroupId)
          const cleanPayee = (group?.description || tx.payee).replace(/\s*\(\d+\/\d+\)$/, '').trim()

          const groupTxs = allTxs.filter(t => t.installmentGroupId === tx.installmentGroupId)
          const sortedGroupTxs = [...groupTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          const earliestDate = group?.startDate || (sortedGroupTxs.length > 0 ? sortedGroupTxs[0].date : tx.date)
          const totalAmount = group?.totalAmount || groupTxs.reduce((sum, t) => sum + t.amount, 0)
          const count = group?.installmentCount || tx.installmentTotal || groupTxs.length
          const instAmount = group?.installmentAmount || (count > 0 ? totalAmount / count : totalAmount)

          purchases.push({
            id: `group-${tx.installmentGroupId}`,
            groupId: tx.installmentGroupId,
            payee: cleanPayee,
            date: earliestDate,
            amount: totalAmount,
            installmentCount: count,
            installmentAmount: instAmount,
            categoryId: group?.categoryId || tx.categoryId,
            notes: group?.description || tx.notes?.replace(/\s*\(\d+\/\d+\)$/, ''),
            type: 'expense',
            isInstallment: true,
          })
        } else {
          purchases.push({
            id: `tx-${tx.id}`,
            transactionId: tx.id,
            payee: tx.payee,
            date: tx.date,
            amount: tx.amount,
            categoryId: tx.categoryId,
            notes: tx.notes,
            type: tx.type,
            isInstallment: false,
          })
        }
      }

      // Ordenar por data da compra decrescente
      purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      return purchases
    },
    [accountId]
  )
}

