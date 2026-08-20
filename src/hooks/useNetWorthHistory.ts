// src/hooks/useNetWorthHistory.ts — Histórico de Patrimônio Líquido Multi-Conta com TanStack Query v5
import { useMemo } from 'react'
import {
  useAccountsQuery,
  useTransactionsQuery,
  useDebtAccountsQuery,
  useDebtItemsQuery,
} from '@/hooks/queries'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getAccountingStartDate } from '@/utils/accountingPeriod'

export type Granularity = 'daily' | 'weekly' | 'monthly'

export interface NetWorthPoint {
  date: Date
  dateLabel: string
  netWorth: number
  assets: number
  liabilities: number
  isFuture: boolean
  // Breakdown por Macro (Dentro vs Fora do Orçamento)
  onBudgetTotal: number
  offBudgetTotal: number
  // Breakdown por Tipo de Conta
  checkingTotal: number
  creditCardTotal: number
  offBudgetAccountsTotal: number
  debtReceivableTotal: number
  debtPayableTotal: number
  // Saldos individuais de cada conta (ID -> Saldo)
  accounts: Record<string, number>
}

export function useNetWorthHistory(
  startDate: Date,
  endDate: Date,
  granularity: Granularity
): NetWorthPoint[] | undefined {
  const { data: accounts = [], isLoading: l1 } = useAccountsQuery()
  const { data: transactions = [], isLoading: l2 } = useTransactionsQuery()
  const { data: debtAccounts = [], isLoading: l3 } = useDebtAccountsQuery()
  const { data: debtItems = [], isLoading: l4 } = useDebtItemsQuery()
  const isLoading = l1 || l2 || l3 || l4

  return useMemo(() => {
    if (isLoading && accounts.length === 0) return undefined
    const activeAccounts = accounts.filter(a => a.isActive !== false)
    const activeDebtAccounts = debtAccounts.filter(d => d.isActive !== false)

    if (activeAccounts.length === 0 && activeDebtAccounts.length === 0) return []

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const points: NetWorthPoint[] = []

    const accountingStartStr = getAccountingStartDate()
    let effectiveStart = new Date(startDate)
    if (accountingStartStr) {
      const [y, m, d] = accountingStartStr.split('-').map(Number)
      const accStartDate = new Date(y, m - 1, d)
      if (accStartDate > effectiveStart) {
        effectiveStart = accStartDate
      }
    }

    let current = new Date(effectiveStart)
    current.setHours(23, 59, 59, 999)

    const limit = new Date(endDate)
    limit.setHours(23, 59, 59, 999)

    let count = 0
    const maxPoints = 200

    while (current <= limit && count < maxPoints) {
      count++
      const pDate = new Date(current)
      const isFuture = pDate > today

      let totalNetWorth = 0
      let totalAssets = 0
      let totalLiabilities = 0

      let onBudgetTotal = 0
      let offBudgetTotal = 0

      let checkingTotal = 0
      let creditCardTotal = 0
      let offBudgetAccountsTotal = 0
      let debtReceivableTotal = 0
      let debtPayableTotal = 0

      const accountBalances: Record<string, number> = {}

      // 1. Contas Bancárias e Cartões
      for (const acc of activeAccounts) {
        if (!acc.id) continue
        let bal = Number(acc.initialBalance || 0)
        // Se for cartão de crédito e tiver saldo inicial positivo, é saldo devedor inicial
        if (acc.type === 'credit_card' && bal > 0) {
          bal = -bal
        }

        // Transações reais até a data do ponto (todas as transações compõem o saldo acumulado)
        for (const tx of transactions) {
          const txDate = new Date(tx.date)
          if (txDate > pDate) continue

          if (tx.accountId === acc.id) {
            if (acc.type === 'credit_card') {
              if (tx.type === 'expense') bal -= tx.amount
              else if (tx.type === 'income' || tx.type === 'transfer') bal += tx.amount
            } else {
              if (tx.type === 'income') bal += tx.amount
              else if (tx.type === 'expense' || tx.type === 'transfer') bal -= tx.amount
            }
          }

          if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
            bal += tx.amount
          }
        }

        accountBalances[acc.id] = bal
        totalNetWorth += bal

        if (bal >= 0) totalAssets += bal
        else totalLiabilities += Math.abs(bal)

        if (acc.type === 'checking') {
          checkingTotal += bal
          onBudgetTotal += bal
        } else if (acc.type === 'credit_card') {
          creditCardTotal += bal
          onBudgetTotal += bal
        } else if (acc.type === 'off_budget') {
          offBudgetAccountsTotal += bal
          offBudgetTotal += bal
        }
      }

      // 2. Contas de Cobrança / Dívidas (Receivables & Payables)
      for (const dAcc of activeDebtAccounts) {
        if (!dAcc.id) continue
        const items = debtItems.filter(i => i.debtAccountId === dAcc.id)
        let dBal = 0

        for (const item of items) {
          const itemCreatedAt = new Date(item.createdAt)
          if (itemCreatedAt > pDate) continue

          // Verifica se o item ainda estava pendente ou se já havia sido liquidado na data pDate
          const isSettledAtDate =
            item.status === 'settled' && item.settledDate && new Date(item.settledDate) <= pDate

          if (!isSettledAtDate && item.status !== 'cancelled') {
            if (item.type === 'receivable') {
              dBal += item.amount
              debtReceivableTotal += item.amount
              totalAssets += item.amount
              totalNetWorth += item.amount
              offBudgetTotal += item.amount
            } else if (item.type === 'payable') {
              dBal -= item.amount
              debtPayableTotal += item.amount
              totalLiabilities += item.amount
              totalNetWorth -= item.amount
              offBudgetTotal -= item.amount
            }
          }
        }

        accountBalances[dAcc.id] = dBal
      }

      let dateLabel = ''
      if (granularity === 'daily') {
        dateLabel = format(pDate, 'dd/MM')
      } else if (granularity === 'weekly') {
        dateLabel = format(pDate, 'dd/MM')
      } else {
        dateLabel = format(pDate, 'MMM/yy', { locale: ptBR })
      }

      points.push({
        date: pDate,
        dateLabel,
        netWorth: totalNetWorth,
        assets: totalAssets,
        liabilities: totalLiabilities,
        isFuture,
        onBudgetTotal,
        offBudgetTotal,
        checkingTotal,
        creditCardTotal,
        offBudgetAccountsTotal,
        debtReceivableTotal,
        debtPayableTotal,
        accounts: accountBalances,
      })

      if (granularity === 'daily') {
        current = addDays(current, 1)
      } else if (granularity === 'weekly') {
        current = addWeeks(current, 1)
      } else {
        current = addMonths(current, 1)
      }
    }

    return points
  }, [accounts, transactions, debtAccounts, debtItems, startDate, endDate, granularity, isLoading])
}
