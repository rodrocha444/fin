// src/hooks/useNetWorthHistory.ts — Histórico de Patrimônio Líquido Multi-Conta com TanStack Query v5
import { useMemo } from 'react'
import {
  useAccountsQuery,
  useTransactionsQuery,
  useDebtAccountsQuery,
  useDebtItemsQuery,
} from '@/hooks/queries'
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getAccountingStartDate } from '@/utils/accountingPeriod'
import { getDebtItemAmountAtDate } from '@/utils/debts'

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

    const accountingStartStr = getAccountingStartDate()
    let effectiveStart = new Date(startDate)
    if (accountingStartStr) {
      const [y, m, d] = accountingStartStr.split('-').map(Number)
      const accStartDate = new Date(y, m - 1, d)
      if (accStartDate > effectiveStart) {
        effectiveStart = accStartDate
      }
    }
    effectiveStart.setHours(23, 59, 59, 999)

    const limit = new Date(endDate)
    limit.setHours(23, 59, 59, 999)

    if (effectiveStart > limit) {
      effectiveStart = new Date(limit)
    }

    // ── Geração de Datas Ancoradas em "Hoje" ───────────────────────────
    // Garante que a data atual ("Hoje") seja um ponto exato no gráfico e que,
    // quando a projeção futura estiver desativada (limit <= today), o último ponto
    // corresponda a Hoje com 100% de paridade contábil com a página de Contas.
    const dateSet = new Set<string>()
    const targetDates: Date[] = []

    const addDate = (d: Date) => {
      const clone = new Date(d)
      clone.setHours(23, 59, 59, 999)
      const key = format(clone, 'yyyy-MM-dd')
      if (!dateSet.has(key)) {
        dateSet.add(key)
        targetDates.push(clone)
      }
    }

    if (limit <= today) {
      // Período puramente passado/presente: ancoramos em limit (que normalmente é today) e retrocedemos
      addDate(limit)
      let curr = new Date(limit)
      let safety = 0
      while (safety++ < 200) {
        if (granularity === 'daily') curr = subDays(curr, 1)
        else if (granularity === 'weekly') curr = subWeeks(curr, 1)
        else curr = subMonths(curr, 1)

        if (curr < effectiveStart) break
        addDate(curr)
      }
      addDate(effectiveStart)
    } else if (effectiveStart >= today) {
      // Período puramente futuro (ex: presets de projeção)
      addDate(effectiveStart)
      let curr = new Date(effectiveStart)
      let safety = 0
      while (safety++ < 200) {
        if (granularity === 'daily') curr = addDays(curr, 1)
        else if (granularity === 'weekly') curr = addWeeks(curr, 1)
        else curr = addMonths(curr, 1)

        if (curr > limit) break
        addDate(curr)
      }
      addDate(limit)
    } else {
      // Período híbrido (passado + futuro): Hoje é a âncora central
      addDate(today)

      let currPast = new Date(today)
      let safetyPast = 0
      while (safetyPast++ < 150) {
        if (granularity === 'daily') currPast = subDays(currPast, 1)
        else if (granularity === 'weekly') currPast = subWeeks(currPast, 1)
        else currPast = subMonths(currPast, 1)

        if (currPast < effectiveStart) break
        addDate(currPast)
      }
      addDate(effectiveStart)

      let currFuture = new Date(today)
      let safetyFuture = 0
      while (safetyFuture++ < 150) {
        if (granularity === 'daily') currFuture = addDays(currFuture, 1)
        else if (granularity === 'weekly') currFuture = addWeeks(currFuture, 1)
        else currFuture = addMonths(currFuture, 1)

        if (currFuture > limit) break
        addDate(currFuture)
      }
      addDate(limit)
    }

    targetDates.sort((a, b) => a.getTime() - b.getTime())

    const round2 = (v: number) => {
      const r = Math.round(v * 100) / 100
      return Math.abs(r) < 0.005 ? 0 : r
    }

    const points: NetWorthPoint[] = []

    for (const pDate of targetDates) {
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

        const roundedBal = round2(bal)
        accountBalances[acc.id] = roundedBal
        totalNetWorth += roundedBal

        if (roundedBal >= 0) totalAssets += roundedBal
        else totalLiabilities += Math.abs(roundedBal)

        if (acc.type === 'checking') {
          checkingTotal += roundedBal
          onBudgetTotal += roundedBal
        } else if (acc.type === 'credit_card') {
          creditCardTotal += roundedBal
          onBudgetTotal += roundedBal
        } else if (acc.type === 'off_budget') {
          offBudgetAccountsTotal += roundedBal
          offBudgetTotal += roundedBal
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

          // Se estiver cancelado, ignora
          if (item.status === 'cancelled') continue

          // Se estiver liquidado:
          if (item.status === 'settled') {
            // Se não tem data de liquidação informada, considera liquidado e não entra no saldo
            if (!item.settledDate) continue
            // Se foi liquidado antes ou na data do ponto, já foi quitado
            if (new Date(item.settledDate) <= pDate) continue
          }

          const effectiveAmount = getDebtItemAmountAtDate(item, pDate)
          if (effectiveAmount > 0) {
            if (item.type === 'receivable') {
              dBal += effectiveAmount
              debtReceivableTotal += effectiveAmount
              totalAssets += effectiveAmount
              totalNetWorth += effectiveAmount
              offBudgetTotal += effectiveAmount
            } else if (item.type === 'payable') {
              dBal -= effectiveAmount
              debtPayableTotal += effectiveAmount
              totalLiabilities += effectiveAmount
              totalNetWorth -= effectiveAmount
              offBudgetTotal -= effectiveAmount
            }
          }
        }

        const roundedDBal = round2(dBal)
        accountBalances[dAcc.id] = roundedDBal
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
        netWorth: round2(totalNetWorth),
        assets: round2(totalAssets),
        liabilities: round2(totalLiabilities),
        isFuture,
        onBudgetTotal: round2(onBudgetTotal),
        offBudgetTotal: round2(offBudgetTotal),
        checkingTotal: round2(checkingTotal),
        creditCardTotal: round2(creditCardTotal),
        offBudgetAccountsTotal: round2(offBudgetAccountsTotal),
        debtReceivableTotal: round2(debtReceivableTotal),
        debtPayableTotal: round2(debtPayableTotal),
        accounts: accountBalances,
      })
    }

    // Se gerou apenas 1 ponto (ex: início contábil é hoje), cria um ponto inicial complementar para desenhar a curva
    if (points.length === 1) {
      const p = points[0]
      const prevDate = new Date(p.date.getTime() - 24 * 60 * 60 * 1000)
      points.unshift({
        ...p,
        date: prevDate,
        dateLabel: format(prevDate, 'dd/MM'),
      })
    }

    return points
  }, [accounts, transactions, debtAccounts, debtItems, startDate, endDate, granularity, isLoading])
}
