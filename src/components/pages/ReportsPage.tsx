// src/components/pages/ReportsPage.tsx — Página de Relatórios Financeiros com Evolução Temporal, Detalhamento e Ocultação de Categorias
import { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Receipt,
  PieChart as PieIcon,
  EyeOff,
  Filter,
} from 'lucide-react'
import { useAllBalances } from '@/hooks/useAccounts'
import { useDebtsSummary } from '@/hooks/useDebts'
import { useFinancialData } from '@/context/FinancialDataContext'
import { formatCurrency, formatMonthLabel, currentMonth } from '@/utils/format'
import { isMonthBeforeAccountingStart } from '@/utils/accountingPeriod'
import {
  type AccountingRegime,
  getSavedAccountingRegime,
  saveAccountingRegime,
  getSavedReportHiddenCategories,
  saveReportHiddenCategories,
  calculateReportExpensesByCategory,
  calculateReportIncomeByCategory,
  calculateReportSummary,
  buildExpensePieItems,
  buildIncomePieItems,
  getReportTransactionsForMonth,
} from '@/utils/accountingRegime'
import CategoryPieCard, { type CategoryPieItem } from '@/components/molecules/CategoryPieCard'
import MonthlyEvolutionCard from '@/components/organisms/MonthlyEvolutionCard'
import CategoryTransactionsModal from '@/components/organisms/CategoryTransactionsModal'
import ReportHiddenCategoriesModal from '@/components/organisms/ReportHiddenCategoriesModal'
import AdvancedFinancialChart from '@/components/organisms/AdvancedFinancialChart'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import { addMonths, subMonths, parseISO, format } from 'date-fns'
import type { Transaction } from '@/types'

interface TransactionsModalState {
  isOpen: boolean
  title: string
  description?: string
  month: string
  transactions: Transaction[]
  isIncome: boolean
  categoryId?: string
}

export default function ReportsPage() {
  const [month, setMonth] = useState(() => currentMonth())
  const [regime, setRegime] = useState<AccountingRegime>(() => getSavedAccountingRegime())
  const [modalState, setModalState] = useState<TransactionsModalState | null>(null)
  const [showHiddenModal, setShowHiddenModal] = useState(false)

  // Categorias ocultadas especificamente dos relatórios
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(
    () => new Set(getSavedReportHiddenCategories())
  )

  const {
    accounts = [],
    transactions = [],
    categories = [],
    categoryGroups = [],
    installmentGroups = [],
  } = useFinancialData()

  const balances = useAllBalances()
  const debtSummary = useDebtsSummary()

  const handleRegimeChange = (newRegime: AccountingRegime) => {
    setRegime(newRegime)
    saveAccountingRegime(newRegime)
  }

  // Ações de ocultar / exibir categorias dos relatórios
  const handleToggleHideCategory = (id: string) => {
    setHiddenCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      saveReportHiddenCategories(Array.from(next))
      return next
    })
  }

  const handleHideMultiple = (ids: string[]) => {
    setHiddenCategoryIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.add(id))
      saveReportHiddenCategories(Array.from(next))
      return next
    })
  }

  const handleShowMultiple = (ids: string[]) => {
    setHiddenCategoryIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => next.delete(id))
      saveReportHiddenCategories(Array.from(next))
      return next
    })
  }

  const handleResetAllHidden = () => {
    setHiddenCategoryIds(new Set())
    saveReportHiddenCategories([])
  }

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

  // Patrimônio líquido total consolidado
  const netWorth = useMemo(() => {
    const bankTotal = balances ? Array.from(balances.values()).reduce((sum, v) => sum + v, 0) : 0
    const debtNet = debtSummary?.netBalance ?? 0
    return bankTotal + debtNet
  }, [balances, debtSummary])

  // Métricas consolidadas do mês conforme o regime contábil ativo e categorias ocultas
  const { income, expense, netSavings, savingsRate } = useMemo(() => {
    return calculateReportSummary(transactions, installmentGroups, month, regime, hiddenCategoryIds, accounts)
  }, [transactions, installmentGroups, month, regime, hiddenCategoryIds, accounts])

  // ── 1. Itens de Despesa do Mês para o Gráfico de Pizza/Barras ────────────────
  const expensePieItems: CategoryPieItem[] = useMemo(() => {
    const expenseMap = calculateReportExpensesByCategory(
      transactions,
      installmentGroups,
      month,
      regime,
      hiddenCategoryIds,
      accounts
    )
    return buildExpensePieItems(expenseMap, categoryGroups, categories)
  }, [transactions, installmentGroups, month, regime, hiddenCategoryIds, categoryGroups, categories, accounts])

  // ── 2. Itens de Receita do Mês para o Gráfico de Pizza/Barras ────────────────
  const incomePieItems: CategoryPieItem[] = useMemo(() => {
    const incomeMap = calculateReportIncomeByCategory(
      transactions,
      installmentGroups,
      month,
      regime,
      hiddenCategoryIds,
      accounts
    )
    return buildIncomePieItems(incomeMap, categoryGroups, categories)
  }, [transactions, installmentGroups, month, regime, hiddenCategoryIds, categoryGroups, categories, accounts])

  // ── 3. Abertura do Modal de Transações por Categoria ─────────────────────────
  const handleCategorySelect = (item: CategoryPieItem, type: 'expense' | 'income') => {
    const catTxs = getReportTransactionsForMonth(
      transactions,
      installmentGroups,
      month,
      regime,
      {
        type,
        categoryId: item.id,
      },
      accounts
    )

    const monthLabel = formatMonthLabel(month)
    const regimeLabel = regime === 'accrual' ? 'Data da Compra' : 'Por Fatura'

    setModalState({
      isOpen: true,
      title: item.name,
      description: `Lançamentos de ${item.name} em ${monthLabel} (${regimeLabel})`,
      month,
      transactions: catTxs,
      isIncome: type === 'income',
      categoryId: item.id,
    })
  }

  // ── 4. Abertura do Modal de Transações por Barra Mensal ──────────────────────
  const handleMonthBarSelect = (
    barMonth: string,
    type: 'expense' | 'income',
    categoryId?: string
  ) => {
    const monthTxs = getReportTransactionsForMonth(
      transactions,
      installmentGroups,
      barMonth,
      regime,
      {
        type,
        categoryId,
        hiddenCategoryIds,
      },
      accounts
    )

    const monthLabel = formatMonthLabel(barMonth)
    const regimeLabel = regime === 'accrual' ? 'Data da Compra' : 'Por Fatura'

    let title: string
    let description: string

    if (categoryId) {
      const catObj = categories.find(c => c.id === categoryId)
      const catName =
        catObj?.name || (categoryId.startsWith('uncategorized') ? 'Sem Categoria' : categoryId)
      title = catName
      description = `Lançamentos de ${catName} em ${monthLabel} (${regimeLabel})`
    } else {
      title = type === 'expense' ? `Despesas de ${monthLabel}` : `Receitas de ${monthLabel}`
      description = `Todas as ${
        type === 'expense' ? 'despesas' : 'receitas'
      } de ${monthLabel} (${regimeLabel})`
    }

    setModalState({
      isOpen: true,
      title,
      description,
      month: barMonth,
      transactions: monthTxs,
      isIncome: type === 'income',
      categoryId,
    })
  }

  return (
    <div className="fade-in pb-16">
      {/* ── Header com Seletor de Regime, Mês e Ocultar Categorias ─────────── */}
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão de Categorias Ocultas */}
            <button
              type="button"
              onClick={() => setShowHiddenModal(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                hiddenCategoryIds.size > 0
                  ? 'bg-rose-950/50 text-rose-300 border-rose-800/60 hover:bg-rose-900/40 shadow-sm'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title="Gerenciar quais categorias são incluídas ou ocultadas dos relatórios"
            >
              {hiddenCategoryIds.size > 0 ? (
                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Filter className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden md:inline">Filtro de Categorias</span>
              <span className="md:hidden">Filtro</span>
              {hiddenCategoryIds.size > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-500 text-white leading-none">
                  {hiddenCategoryIds.size}
                </span>
              )}
            </button>

            {/* Seletor de Regime Contábil */}
            <div className="flex items-center bg-slate-950/90 rounded-xl border border-slate-800 p-0.5 shadow-inner">
              <button
                type="button"
                onClick={() => handleRegimeChange('accrual')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  regime === 'accrual'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
                title="Regime de Competência: Contabiliza compras parceladas integralmente na data da compra"
              >
                <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Data da Compra</span>
                <span className="hidden md:inline text-[10px] opacity-75">(Competência)</span>
              </button>

              <button
                type="button"
                onClick={() => handleRegimeChange('cash')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  regime === 'cash'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
                title="Regime de Caixa: Contabiliza compras parceladas no mês de vencimento de cada fatura"
              >
                <Receipt className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Por Fatura</span>
                <span className="hidden md:inline text-[10px] opacity-75">(Caixa)</span>
              </button>
            </div>

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
        {/* ── Banner Informativo do Regime Contábil e Categorias Ocultas ─────── */}
        <div className="space-y-2">
          <div
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
              regime === 'accrual'
                ? 'bg-indigo-950/30 border-indigo-800/40 text-indigo-200'
                : 'bg-slate-950/40 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {regime === 'accrual' ? (
                <CalendarDays className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              ) : (
                <Receipt className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              <div>
                {regime === 'accrual' ? (
                  <p>
                    <strong className="text-indigo-300">Regime de Competência (Data da Compra):</strong> As compras parceladas e rateios são contabilizados integralmente na data em que foram realizados, refletindo o consumo real deste mês.
                  </p>
                ) : (
                  <p>
                    <strong className="text-slate-200">Regime de Caixa (Por Fatura):</strong> As compras parceladas são contabilizadas no mês de vencimento de cada fatura ou parcela individual.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Aviso se houver categorias ocultadas */}
          {hiddenCategoryIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>
                  <strong>{hiddenCategoryIds.size}</strong> {hiddenCategoryIds.size === 1 ? 'categoria está oculta' : 'categorias estão ocultas'} nos cálculos dos relatórios e gráficos.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHiddenModal(true)}
                className="underline hover:text-white font-semibold flex-shrink-0"
              >
                Gerenciar
              </button>
            </div>
          )}
        </div>

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

        {/* ── Gráficos de Barras de Evolução Temporal de Despesas e Receitas ────── */}
        <MonthlyEvolutionCard
          currentActiveMonth={month}
          regime={regime}
          hiddenCategoryIds={hiddenCategoryIds}
          onSelectMonthBar={handleMonthBarSelect}
          onMonthChange={setMonth}
        />

        {/* ── 2 Gráficos de Distribuição por Categoria (Despesas e Receitas) ─────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Distribuição por Categoria em {formatMonthLabel(month)}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* Pizza / Barras de Despesas do Mês */}
            <CategoryPieCard
              title="Despesas por Categoria"
              type="expense"
              items={expensePieItems}
              monthLabel={formatMonthLabel(month)}
              onSelectCategory={item => handleCategorySelect(item, 'expense')}
              onToggleHideCategory={handleToggleHideCategory}
              onOpenHiddenManager={() => setShowHiddenModal(true)}
              hiddenCount={hiddenCategoryIds.size}
            />

            {/* Pizza / Barras de Receitas do Mês */}
            <CategoryPieCard
              title="Receitas por Categoria"
              type="income"
              items={incomePieItems}
              monthLabel={formatMonthLabel(month)}
              onSelectCategory={item => handleCategorySelect(item, 'income')}
              onToggleHideCategory={handleToggleHideCategory}
              onOpenHiddenManager={() => setShowHiddenModal(true)}
              hiddenCount={hiddenCategoryIds.size}
            />
          </div>
        </div>

        {/* ── Terminal de Evolução e Análise Financeira ────────────────────────── */}
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

      {/* ── Modal de Transações Detalhadas ao Clicar em Qualquer Seção ────────── */}
      {modalState && modalState.isOpen && (
        <CategoryTransactionsModal
          category={modalState.categoryId ? { id: modalState.categoryId, name: modalState.title } : undefined}
          month={modalState.month}
          isIncome={modalState.isIncome}
          customTransactions={modalState.transactions}
          customTitle={modalState.title}
          customDescription={modalState.description}
          regime={regime}
          onClose={() => setModalState(null)}
        />
      )}

      {/* ── Modal para Gerenciar Categorias Ocultas dos Relatórios ────────────── */}
      <ReportHiddenCategoriesModal
        isOpen={showHiddenModal}
        hiddenCategoryIds={hiddenCategoryIds}
        onToggleCategory={handleToggleHideCategory}
        onHideMultiple={handleHideMultiple}
        onShowMultiple={handleShowMultiple}
        onResetAll={handleResetAllHidden}
        onClose={() => setShowHiddenModal(false)}
      />
    </div>
  )
}
