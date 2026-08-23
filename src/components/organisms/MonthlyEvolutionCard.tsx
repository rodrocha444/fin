// src/components/organisms/MonthlyEvolutionCard.tsx — Gráfico de Barras de Evolução Temporal de Despesas e Receitas
import { useState, useMemo } from 'react'
import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Info,
} from 'lucide-react'
import {
  format,
  subMonths,
  startOfYear,
  parseISO,
  isAfter,
  addMonths,
} from 'date-fns'
import { useFinancialData } from '@/context/FinancialDataContext'
import { formatCurrency } from '@/utils/format'
import { getAccountingStartDate } from '@/utils/accountingPeriod'
import {
  type AccountingRegime,
  calculateMonthlyEvolution,
  type MonthlyEvolutionItem,
} from '@/utils/accountingRegime'
import BarChart, { type BarChartItem } from '@/components/atoms/BarChart'

type TimeRangePreset = '6m' | '12m' | 'ytd' | 'all'
type EvolutionViewMode = 'expense' | 'income' | 'comparative'

interface MonthlyEvolutionCardProps {
  currentActiveMonth: string
  regime: AccountingRegime
  onSelectMonthBar: (month: string, type: 'expense' | 'income') => void
  onMonthChange?: (month: string) => void
}

export default function MonthlyEvolutionCard({
  currentActiveMonth,
  regime,
  onSelectMonthBar,
  onMonthChange,
}: MonthlyEvolutionCardProps) {
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>('6m')
  const [viewMode, setViewMode] = useState<EvolutionViewMode>('expense')

  const { transactions = [], installmentGroups = [] } = useFinancialData()

  // Gera a lista de meses com base no preset selecionado
  const monthsList = useMemo(() => {
    const baseDate = parseISO(`${currentActiveMonth}-01`)
    const today = new Date()
    const referenceDate = isAfter(baseDate, today) ? baseDate : today

    let start: Date
    if (rangePreset === '6m') {
      start = subMonths(referenceDate, 5)
    } else if (rangePreset === '12m') {
      start = subMonths(referenceDate, 11)
    } else if (rangePreset === 'ytd') {
      start = startOfYear(referenceDate)
    } else {
      // 'all'
      const accStart = getAccountingStartDate()
      start = accStart ? parseISO(`${accStart}-01`) : subMonths(referenceDate, 24)
    }

    // Identifica o último mês que possui transações ou parcelas futuras
    let maxFuture = referenceDate
    for (const tx of transactions) {
      const d = new Date(tx.date)
      if (d > maxFuture) maxFuture = d
    }
    const end = isAfter(maxFuture, referenceDate) ? maxFuture : referenceDate

    const list: string[] = []
    let curr = start
    while (curr <= end || format(curr, 'yyyy-MM') === format(end, 'yyyy-MM')) {
      const mKey = format(curr, 'yyyy-MM')
      if (!list.includes(mKey)) {
        list.push(mKey)
      }
      curr = addMonths(curr, 1)
      if (list.length > 48) break // proteção de segurança
    }

    return list
  }, [currentActiveMonth, rangePreset, transactions])

  // Dados calculados para a série temporal
  const evolutionData: MonthlyEvolutionItem[] = useMemo(() => {
    return calculateMonthlyEvolution(transactions, installmentGroups, monthsList, regime)
  }, [transactions, installmentGroups, monthsList, regime])

  // Estatísticas agregadas do período
  const stats = useMemo(() => {
    if (evolutionData.length === 0) {
      return {
        totalExpense: 0,
        totalIncome: 0,
        avgExpense: 0,
        avgIncome: 0,
        minExpenseMonth: null,
        maxIncomeMonth: null,
        lastExpenseVariation: 0,
        lastIncomeVariation: 0,
      }
    }

    const totalExpense = evolutionData.reduce((s, it) => s + it.expense, 0)
    const totalIncome = evolutionData.reduce((s, it) => s + it.income, 0)
    const avgExpense = totalExpense / evolutionData.length
    const avgIncome = totalIncome / evolutionData.length

    // Mês de menor gasto com valor > 0
    const nonZeroExpenses = evolutionData.filter(e => e.expense > 0)
    const minExpenseMonth =
      nonZeroExpenses.length > 0
        ? [...nonZeroExpenses].sort((a, b) => a.expense - b.expense)[0]
        : null

    const nonZeroIncomes = evolutionData.filter(i => i.income > 0)
    const maxIncomeMonth =
      nonZeroIncomes.length > 0
        ? [...nonZeroIncomes].sort((a, b) => b.income - a.income)[0]
        : null

    const lastItem = evolutionData[evolutionData.length - 1]
    const lastExpenseVariation = lastItem?.expenseChangePercent ?? 0
    const lastIncomeVariation = lastItem?.incomeChangePercent ?? 0

    return {
      totalExpense,
      totalIncome,
      avgExpense,
      avgIncome,
      minExpenseMonth,
      maxIncomeMonth,
      lastExpenseVariation,
      lastIncomeVariation,
    }
  }, [evolutionData])

  // Converte os dados da evolução para os itens do BarChart
  const barChartItems: BarChartItem[] = useMemo(() => {
    return evolutionData.map(item => {
      const isSelected = item.month === currentActiveMonth

      if (viewMode === 'expense') {
        let badge: string | undefined = undefined
        let badgeVariant: 'success' | 'danger' | 'neutral' | 'info' = 'neutral'

        if (item.expenseChangePercent !== undefined) {
          const val = item.expenseChangePercent
          if (val < -0.1) {
            badge = `↓ ${Math.abs(val).toFixed(0)}%`
            badgeVariant = 'success' // Gastou menos = bom!
          } else if (val > 0.1) {
            badge = `↑ ${val.toFixed(0)}%`
            badgeVariant = 'danger' // Gastou mais = atenção!
          } else {
            badge = '= 0%'
            badgeVariant = 'neutral'
          }
        }

        return {
          id: item.month,
          label: item.label,
          sublabel: item.month.split('-')[0].slice(2), // Ex: '26'
          fullLabel: item.fullLabel,
          value: item.expense,
          color: isSelected ? '#fb7185' : '#f43f5e',
          badge,
          badgeVariant,
          count: item.expenseCount,
          isActive: isSelected,
        }
      }

      if (viewMode === 'income') {
        let badge: string | undefined = undefined
        let badgeVariant: 'success' | 'danger' | 'neutral' | 'info' = 'neutral'

        if (item.incomeChangePercent !== undefined) {
          const val = item.incomeChangePercent
          if (val > 0.1) {
            badge = `↑ ${val.toFixed(0)}%`
            badgeVariant = 'success' // Ganhou mais = bom!
          } else if (val < -0.1) {
            badge = `↓ ${Math.abs(val).toFixed(0)}%`
            badgeVariant = 'danger' // Ganhou menos = atenção!
          } else {
            badge = '= 0%'
            badgeVariant = 'neutral'
          }
        }

        return {
          id: item.month,
          label: item.label,
          sublabel: item.month.split('-')[0].slice(2),
          fullLabel: item.fullLabel,
          value: item.income,
          color: isSelected ? '#34d399' : '#10b981',
          badge,
          badgeVariant,
          count: item.incomeCount,
          isActive: isSelected,
        }
      }

      // Modo Comparativo (Despesa vs Receita)
      return {
        id: item.month,
        label: item.label,
        sublabel: item.month.split('-')[0].slice(2),
        fullLabel: `${item.fullLabel} · Saldo: ${formatCurrency(item.netSavings)}`,
        value: item.expense,
        secondaryValue: item.income,
        color: isSelected ? '#fb7185' : '#f43f5e',
        secondaryColor: isSelected ? '#34d399' : '#10b981',
        count: item.expenseCount + item.incomeCount,
        isActive: isSelected,
      }
    })
  }, [evolutionData, viewMode, currentActiveMonth])

  return (
    <div className="card p-4 sm:p-5 bg-slate-900 border border-slate-800 space-y-4">
      {/* ── Cabeçalho do Card com Filtros e Abas ──────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex-shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Evolução Temporal de Gastos e Receitas</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Acompanhe a trajetória de despesas e receitas ao longo dos meses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Modo (Despesas, Receitas, Comparativo) */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('expense')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Despesas</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('income')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Receitas</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('comparative')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'comparative'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Comparativo</span>
            </button>
          </div>

          {/* Seletor de Período (6M, 12M, YTD, Tudo) */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRangePreset('6m')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                rangePreset === '6m'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              6M
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('12m')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                rangePreset === '12m'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              12M
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('ytd')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                rangePreset === 'ytd'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              YTD
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('all')}
              className={`px-2 py-1 rounded-lg transition-colors ${
                rangePreset === 'all'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Tudo
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs Rápidos de Destaque da Tendência ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 font-medium block">
            {viewMode === 'income' ? 'Média Mensal de Receitas' : 'Média Mensal de Gastos'}
          </span>
          <p className="text-sm font-bold text-slate-200 tabular-nums">
            {formatCurrency(viewMode === 'income' ? stats.avgIncome : stats.avgExpense)}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 font-medium block">
            {viewMode === 'income' ? 'Total Recebido no Período' : 'Total de Despesas no Período'}
          </span>
          <p
            className={`text-sm font-bold tabular-nums ${
              viewMode === 'income' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(viewMode === 'income' ? stats.totalIncome : stats.totalExpense)}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 font-medium block">
            {viewMode === 'income' ? 'Mês de Maior Receita' : 'Mês de Menor Gasto'}
          </span>
          <p className="text-sm font-bold text-indigo-300 truncate">
            {viewMode === 'income'
              ? stats.maxIncomeMonth
                ? `${stats.maxIncomeMonth.label} (${formatCurrency(stats.maxIncomeMonth.income)})`
                : '—'
              : stats.minExpenseMonth
              ? `${stats.minExpenseMonth.label} (${formatCurrency(stats.minExpenseMonth.expense)})`
              : '—'}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 font-medium block">
            Tendência no Último Mês
          </span>
          <div className="flex items-center gap-1.5">
            {viewMode === 'expense' ? (
              stats.lastExpenseVariation < 0 ? (
                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Queda de {Math.abs(stats.lastExpenseVariation).toFixed(1)}%</span>
                </span>
              ) : stats.lastExpenseVariation > 0 ? (
                <span className="text-rose-400 font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Aumento de {stats.lastExpenseVariation.toFixed(1)}%</span>
                </span>
              ) : (
                <span className="text-slate-400 font-medium">Estável</span>
              )
            ) : stats.lastIncomeVariation > 0 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Crescimento de {stats.lastIncomeVariation.toFixed(1)}%</span>
              </span>
            ) : stats.lastIncomeVariation < 0 ? (
              <span className="text-rose-400 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Queda de {Math.abs(stats.lastIncomeVariation).toFixed(1)}%</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Estável</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Legenda de Comparativo se ativo ─────────────────────────────────── */}
      {viewMode === 'comparative' && (
        <div className="flex items-center justify-center gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500" />
            <span className="text-slate-300">Despesas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-slate-300">Receitas</span>
          </div>
        </div>
      )}

      {/* ── Área do Gráfico de Barras ───────────────────────────────────────── */}
      <div className="pt-2">
        <BarChart
          items={barChartItems}
          height={230}
          orientation="vertical"
          type={viewMode === 'income' ? 'income' : 'expense'}
          showAverageLine={viewMode !== 'comparative'}
          onBarClick={item => {
            const targetType = viewMode === 'income' ? 'income' : 'expense'
            onSelectMonthBar(item.id, targetType)
            if (onMonthChange && item.id !== currentActiveMonth) {
              onMonthChange(item.id)
            }
          }}
        />
      </div>

      {/* ── Rodapé Informativo ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            {regime === 'accrual'
              ? 'Regime de Competência: compras parceladas contabilizadas integralmente no mês da compra.'
              : 'Regime de Caixa: compras parceladas contabilizadas no mês da fatura.'}
          </span>
        </div>

        <span className="hidden sm:inline text-slate-600">
          Mês em destaque: <strong className="text-indigo-400">{currentActiveMonth}</strong>
        </span>
      </div>
    </div>
  )
}
