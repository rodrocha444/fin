// src/hooks/useTransactions.ts — Hooks reativos para transações e compras (Cloud-Only)
import { useMemo } from 'react'
import { useFinancialData } from '@/context/FinancialDataContext'
import { getProjectedScheduledForMonth, getProjectedScheduledForAccount } from '@/services/api/scheduled'
import { format, addMonths } from 'date-fns'
import { getInvoiceCycle, getInvoiceData } from '@/utils/invoices'
import type { Transaction } from '@/types'

export interface CreditCardPurchase {
  id: string
  groupId?: string
  transactionId?: string
  splitGroupId?: string
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

/** Transações de uma conta (todas ordenadas por createdAt/date desc) */
export function useAccountTransactions(accountId: string | undefined): Transaction[] | undefined {
  const { transactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    if (!accountId) return []

    const filtered = transactions.filter(
      t => t.accountId === accountId || (t.transferAccountId === accountId && t.type === 'transfer')
    )

    return filtered.sort((a, b) => {
      const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
      const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
      if (timeB !== timeA) return timeB - timeA
      return (b.id ?? '').localeCompare(a.id ?? '')
    })
  }, [transactions, accountId, isLoading])
}

/** Transações de uma conta incluindo agendamentos futuros projetados e saldo futuro */
export function useAccountTransactionsWithScheduled(accountId: string | undefined): {
  transactions: Transaction[]
  futureOffset: number
} | undefined {
  const { transactions, scheduledTransactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    if (!accountId) return { transactions: [], futureOffset: 0 }

    const txs = transactions.filter(
      t => t.accountId === accountId || (t.transferAccountId === accountId && t.type === 'transfer')
    )

    const activeScheduled = scheduledTransactions.filter(s => s.isActive !== false)
    const projected = getProjectedScheduledForAccount(accountId, activeScheduled, 6)

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
  }, [transactions, scheduledTransactions, accountId, isLoading])
}

/** Transações de uma categoria em um mês específico */
export function useCategoryMonthTransactions(categoryId: string | undefined, month: string): Transaction[] | undefined {
  const { transactions, accounts, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    if (!categoryId) return []

    if (categoryId.startsWith('cc_invoice_')) {
      const accountId = categoryId.replace('cc_invoice_', '')
      const acc = accounts.find(a => a.id === accountId)
      if (acc && acc.statementClosingDay) {
        const [y, m] = month.split('-').map(Number)
        const checkMonths = [-1, 0, 1].map(delta => {
          const d = addMonths(new Date(y, m - 1, 1), delta)
          return format(d, 'yyyy-MM')
        })
        const txs = transactions.filter(t => t.accountId === accountId)
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

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1).getTime()
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999).getTime()

    return transactions
      .filter(t => {
        if (t.categoryId !== categoryId) return false
        const tTime = new Date(t.date).getTime()
        return tTime >= startDate && tTime <= endDate
      })
      .sort((a, b) => {
        const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
        const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
        if (timeB !== timeA) return timeB - timeA
        return (b.id ?? '').localeCompare(a.id ?? '')
      })
  }, [transactions, accounts, categoryId, month, isLoading])
}

/** Transações de um mês (YYYY-MM), incluindo ocorrências futuras de agendamentos */
export function useMonthTransactions(month: string): Transaction[] | undefined {
  const { transactions, scheduledTransactions, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1).getTime()
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999).getTime()

    const txs = transactions.filter(t => {
      const tTime = new Date(t.date).getTime()
      return tTime >= startDate && tTime <= endDate
    })

    const activeScheduled = scheduledTransactions.filter(s => s.isActive !== false)
    const projected = getProjectedScheduledForMonth(activeScheduled, month)
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
  }, [transactions, scheduledTransactions, month, isLoading])
}

/** Resumo (income / expense) de um mês */
export function useMonthSummary(month: string): { income: number; expense: number; net: number } | undefined {
  const txs = useMonthTransactions(month)

  return useMemo(() => {
    if (!txs) return undefined
    let income = 0
    let expense = 0

    for (const tx of txs) {
      if (tx.type === 'income') income += tx.amount
      else if (tx.type === 'expense') expense += tx.amount
    }

    return {
      income,
      expense,
      net: income - expense,
    }
  }, [txs])
}

/** Histórico consolidado de compras para conta do tipo Cartão de Crédito */
export function useCreditCardPurchases(accountId: string | undefined): CreditCardPurchase[] | undefined {
  const { transactions, installmentGroups, accounts, isLoading } = useFinancialData()

  return useMemo(() => {
    if (isLoading && transactions.length === 0) return undefined
    if (!accountId) return []

    const accountMap = new Map(accounts.map(a => [a.id!, a]))

    const allTxs = transactions.filter(
      t => t.accountId === accountId || (t.transferAccountId === accountId && t.type === 'transfer')
    )
    const allGroups = installmentGroups.filter(g => g.accountId === accountId)

    const groupMap = new Map(allGroups.map(g => [g.id!, g]))
    const seenGroupIds = new Set<string>()
    const purchases: CreditCardPurchase[] = []

    for (const tx of allTxs) {
      if (tx.transferAccountId === accountId && tx.type === 'transfer') {
        const fromAcc = accountMap.get(tx.accountId)?.name || 'Conta'
        purchases.push({
          id: `tx-${tx.id}`,
          transactionId: tx.id,
          payee: tx.payee || `Transferência de ${fromAcc}`,
          date: tx.date,
          createdAt: tx.createdAt,
          amount: tx.amount,
          categoryId: tx.categoryId,
          notes: tx.notes,
          type: 'transfer',
          isInstallment: false,
        })
      } else if (tx.installmentGroupId) {
        if (seenGroupIds.has(tx.installmentGroupId)) continue
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
          splitGroupId: tx.splitGroupId,
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

    purchases.sort((a, b) => {
      const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
      const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
      if (timeB !== timeA) return timeB - timeA
      return (b.id ?? '').localeCompare(a.id ?? '')
    })

    return purchases
  }, [transactions, installmentGroups, accounts, accountId, isLoading])
}
