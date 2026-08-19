// src/hooks/useTransactions.ts
// ─────────────────────────────────────────────────────────────
// Hooks reativos para transações e compras (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { getTransactionsByAccount, getTransactionsByMonth, getMonthSummary, getTransactionsByCategoryAndMonth } from '@/db/repositories/transactions'
import { getProjectedScheduledForMonth, getProjectedScheduledForAccount } from '@/db/repositories/scheduled'
import { format, addMonths } from 'date-fns'
import { getInvoiceCycle, getInvoiceData } from '@/utils/invoices'
import type { Transaction } from '@/types'

/** Transações de uma conta (todas ordenadas por createdAt desc) */
export function useAccountTransactions(accountId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return []
      return getTransactionsByAccount(accountId)
    },
    [accountId]
  )
}

/** Transações de uma conta incluindo agendamentos futuros projetados e saldo futuro */
export function useAccountTransactionsWithScheduled(accountId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (accountId === undefined) return { transactions: [] as Transaction[], futureOffset: 0 }

      const [txs, scheduled] = await Promise.all([
        getTransactionsByAccount(accountId),
        db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
      ])

      const projected = getProjectedScheduledForAccount(accountId, scheduled, 6)
      const projectedTxs: Transaction[] = projected.map(p => ({
        id: `proj_${p.scheduledId}_${p.date.getTime()}`,
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

      let futureOffset = 0
      for (const p of projected) {
        if (p.accountId === accountId) {
          if (p.type === 'income') futureOffset += p.amount
          else if (p.type === 'expense' || p.type === 'transfer') futureOffset -= p.amount
        }
        if (p.transferAccountId === accountId && p.type === 'transfer') {
          futureOffset += p.amount
        }
      }

      const combined = [...txs, ...projectedTxs]
      combined.sort((a, b) => {
        const timeB = new Date(b.date).getTime()
        const timeA = new Date(a.date).getTime()
        if (timeB !== timeA) return timeB - timeA
        const createB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
        const createA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
        return createB - createA
      })

      return { transactions: combined, futureOffset }
    },
    [accountId]
  )
}

/** Transações de uma categoria em um mês específico */
export function useCategoryMonthTransactions(categoryId: string | undefined, month: string) {
  return useLiveQuery(
    async () => {
      if (categoryId === undefined) return []
      if (categoryId.startsWith('cc_invoice_')) {
        const accountId = categoryId.replace('cc_invoice_', '')
        const acc = await db.accounts.get(accountId)
        if (acc && acc.statementClosingDay) {
          const [y, m] = month.split('-').map(Number)
          const checkMonths = [-1, 0, 1].map(delta => {
            const d = addMonths(new Date(y, m - 1, 1), delta)
            return format(d, 'yyyy-MM')
          })
          const txs = await db.transactions.where('accountId').equals(accountId).toArray()
          const matchedTxs: Transaction[] = []
          for (const mKey of checkMonths) {
            const cycle = getInvoiceCycle(mKey, acc.statementClosingDay, acc.paymentDueDay)
            if (format(cycle.dueDate, 'yyyy-MM') === month) {
              const data = getInvoiceData(txs, cycle)
              matchedTxs.push(...data.transactions)
            }
          }
          return matchedTxs
        }
      }
      return getTransactionsByCategoryAndMonth(categoryId, month)
    },
    [categoryId, month]
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

    const combined = [...txs, ...projectedTxs]
    return combined.sort((a, b) => {
      const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
      const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
      if (timeB !== timeA) return timeB - timeA
      return (b.id ?? '').localeCompare(a.id ?? '')
    })
  }, [month])
}

/** Resumo (income / expense) de um mês */
export function useMonthSummary(month: string) {
  return useLiveQuery(() => getMonthSummary(month), [month])
}

export interface CreditCardPurchase {
  id: string
  groupId?: string
  transactionId?: string
  payee: string
  date: Date
  createdAt?: Date
  amount: number
  installmentCount?: number
  installmentAmount?: number
  categoryId?: string
  notes?: string
  type: 'expense' | 'income' | 'transfer'
  isInstallment: boolean
}

/** Histórico consolidado de compras para conta do tipo Cartão de Crédito */
export function useCreditCardPurchases(accountId: string | undefined) {
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
      const seenGroupIds = new Set<string>()
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
            createdAt: tx.createdAt,
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
            createdAt: tx.createdAt,
            amount: tx.amount,
            categoryId: tx.categoryId,
            notes: tx.notes,
            type: tx.type,
            isInstallment: false,
          })
        }
      }

      // Ordenar por data de criação decrescente (incluindo hora)
      purchases.sort((a, b) => {
        const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
        const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
        if (timeB !== timeA) return timeB - timeA
        return (b.id ?? '').localeCompare(a.id ?? '')
      })
      return purchases
    },
    [accountId]
  )
}
