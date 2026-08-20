// src/components/pages/ReportsPage.tsx — Página de Relatórios Financeiros Reformulada
import { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useBudgetRows, useIncomeBudgetRows } from '@/hooks/useBudget'
import { useMonthSummary } from '@/hooks/useTransactions'
import { useAllBalances } from '@/hooks/useAccounts'
import { useDebtsSummary } from '@/hooks/useDebts'
import { useFinancialData } from '@/context/FinancialDataContext'
import { formatCurrency, formatMonthLabel, currentMonth } from '@/utils/format'
import { toMonthKey } from '@/services/api/budget'
import { isMonthBeforeAccountingStart } from '@/utils/accountingPeriod'
import CategoryPieCard, { type CategoryPieItem } from '@/components/molecules/CategoryPieCard'
import AdvancedFinancialChart from '@/components/organisms/AdvancedFinancialChart'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import { addMonths, subMonths, parseISO, format } from 'date-fns'

export default function ReportsPage() {
  const [month, setMonth] = useState(() => currentMonth())
  const { transactions = [], categories = [], categoryGroups = [] } = useFinancialData()

  const budgetRows = useBudgetRows(month)
  const incomeBudgetRows = useIncomeBudgetRows(month)
  const monthSummary = useMonthSummary(month)
  const balances = useAllBalances()
  const debtSummary = useDebtsSummary()

  // Navegação de mês
  const handlePrevMonth = () => {
    const d = parseISO(`${month}-01`)
    const prev = format(subMonths(d, 1), 'yyyy-MM')
    if (!isMonthBeforeAccountingStart(prev)) {
      setMonth(prev)
    }
  }

  const handleNextMonth = () => {
    const d = parseISO(`${month}-01`)
    setMonth(format(addMonths(d, 1), 'yyyy-MM'))
  }

  const handleCurrentMonth = () => {
    setMonth(currentMonth())
  }

  // Patrimônio líquido total consolidado (Contas Bancárias + Cartões + Cobranças a Receber - Dívidas a Pagar)
  const netWorth = useMemo(() => {
    const bankTotal = balances ? Array.from(balances.values()).reduce((sum, v) => sum + v, 0) : 0
    const debtNet = debtSummary?.netBalance ?? 0
    return bankTotal + debtNet
  }, [balances, debtSummary])

  // Métricas do mês
  const income = monthSummary?.income ?? 0
  const expense = monthSummary?.expense ?? 0
  const netSavings = income - expense
  const savingsRate = income > 0 ? (netSavings / income) * 100 : 0

  // ── 1. Itens de Despesa do Mês para o Gráfico de Pizza ──────────────────────
  const expensePieItems: CategoryPieItem[] = useMemo(() => {
    const list: CategoryPieItem[] = []

    if (budgetRows && budgetRows.length > 0) {
      for (const group of budgetRows) {
        for (const cat of group.categories) {
          if (cat.activity > 0) {
            list.push({
              id: cat.category.id || `${group.group.id}_${cat.category.name}`,
              name: cat.category.name,
              groupName: group.group.name,
              amount: cat.activity,
            })
          }
        }
      }
    }

    // Adiciona eventuais despesas sem categoria
    const uncategorizedExpense = transactions
      .filter(t => t.type === 'expense' && !t.categoryId && toMonthKey(new Date(t.date)) === month)
      .reduce((s, t) => s + t.amount, 0)

    if (uncategorizedExpense > 0) {
      list.push({
        id: 'uncategorized_expense',
        name: 'Sem Categoria',
        groupName: 'Diversos',
        amount: uncategorizedExpense,
      })
    }

    return list
  }, [budgetRows, transactions, month])

  // ── 2. Itens de Receita do Mês para o Gráfico de Pizza ──────────────────────
  const incomePieItems: CategoryPieItem[] = useMemo(() => {
    const list: CategoryPieItem[] = []
    const catMap = new Map(categories.map(c => [c.id!, c]))
    const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

    if (incomeBudgetRows && incomeBudgetRows.length > 0) {
      for (const group of incomeBudgetRows) {
        for (const cat of group.categories) {
          if (cat.received > 0) {
            list.push({
              id: cat.category.id || `${group.group.id}_${cat.category.name}`,
              name: cat.category.name,
              groupName: group.group.name,
              amount: cat.received,
            })
          }
        }
      }
    }

    // Se ainda não houver itens agrupados, extrai diretamente das transações de renda do mês
    if (list.length === 0) {
      const monthIncomeTxs = transactions.filter(
        t => t.type === 'income' && toMonthKey(new Date(t.date)) === month
      )

      const byCategory = new Map<string, { name: string; groupName?: string; amount: number }>()

      for (const tx of monthIncomeTxs) {
        const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined
        const grp = cat ? groupMap.get(cat.groupId) : undefined
        const catKey = tx.categoryId || (tx.payee ? `payee_${tx.payee}` : 'uncategorized_income')
        const catName = cat?.name || tx.payee || 'Renda Diversa'

        const current = byCategory.get(catKey) || { name: catName, groupName: grp?.name, amount: 0 }
        current.amount += tx.amount
        byCategory.set(catKey, current)
      }

      for (const [id, data] of byCategory.entries()) {
        if (data.amount > 0) {
          list.push({
            id,
            name: data.name,
            groupName: data.groupName,
            amount: data.amount,
          })
        }
      }
    }

    return list
  }, [incomeBudgetRows, transactions, categories, categoryGroups, month])

  return (
    <div className="fade-in pb-16">
      
      {/* ── Header com Seletor de Mês ────────────────────────────────────────── */}
      <div
        className="px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900 sticky top-0 z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>Relatórios Financeiros</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Análise de distribuição de despesas, receitas e evolução patrimonial
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de Mês */}
            <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-800 p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={isMonthBeforeAccountingStart(month)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-bold text-slate-200 capitalize min-w-[110px] text-center">
                {formatMonthLabel(month)}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {month !== currentMonth() && (
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="btn-secondary py-1.5 px-2.5 text-xs font-semibold"
                title="Voltar para o mês atual"
              >
                Mês Atual
              </button>
            )}

            <div className="lg:hidden">
              <SyncStatusBadge compact={true} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-6">
        
        {/* ── Cards de KPIs Principais do Mês ───────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Receitas */}
          <div className="card !p-3.5 sm:!p-4 bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Receitas</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-emerald-400 tabular-nums">
              {formatCurrency(income)}
            </p>
            <p className="text-[10px] text-slate-500">Entradas em {formatMonthLabel(month)}</p>
          </div>

          {/* Despesas */}
          <div className="card !p-3.5 sm:!p-4 bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Despesas</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-base sm:text-xl font-extrabold text-rose-400 tabular-nums">
              {formatCurrency(expense)}
            </p>
            <p className="text-[10px] text-slate-500">Saídas em {formatMonthLabel(month)}</p>
          </div>

          {/* Economia / Taxa de Poupança */}
          <div className="card !p-3.5 sm:!p-4 bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Economia Líquida</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
            </div>
            <p
              className={`text-base sm:text-xl font-extrabold tabular-nums ${
                netSavings >= 0 ? 'text-indigo-300' : 'text-rose-400'
              }`}
            >
              {formatCurrency(netSavings)}
            </p>
            <p className="text-[10px] text-slate-500">
              Taxa de poupança: <strong className={savingsRate >= 0 ? 'text-indigo-400' : 'text-rose-400'}>{savingsRate.toFixed(1)}%</strong>
            </p>
          </div>

          {/* Patrimônio Líquido */}
          <div className="card !p-3.5 sm:!p-4 bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">Patrimônio Líquido</span>
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <p
              className={`text-base sm:text-xl font-extrabold tabular-nums ${
                netWorth >= 0 ? 'text-slate-100' : 'text-rose-400'
              }`}
            >
              {formatCurrency(netWorth)}
            </p>
            <p className="text-[10px] text-slate-500">Saldo consolidado de todas as contas</p>
          </div>

        </div>

        {/* ── 2 Gráficos de Pizza Interativos com Checkbox (Despesas e Receitas) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          
          {/* Pizza de Despesas do Mês */}
          <CategoryPieCard
            title="Despesas por Categoria"
            type="expense"
            items={expensePieItems}
            monthLabel={formatMonthLabel(month)}
          />

          {/* Pizza de Receitas do Mês */}
          <CategoryPieCard
            title="Receitas por Categoria"
            type="income"
            items={incomePieItems}
            monthLabel={formatMonthLabel(month)}
          />

        </div>

        {/* ── Gráfico Completo Estilo Plataforma de Corretora ────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Terminal de Evolução e Análise Financeira
            </h2>
          </div>

          <AdvancedFinancialChart />
        </div>

      </div>
    </div>
  )
}
