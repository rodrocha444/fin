import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Copy,
  Trash2,
  MoreHorizontal,
  ArrowDownLeft,
  Layers,
  Receipt,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  CheckCheck,
} from 'lucide-react'
import { useBudgetRows, useIncomeBudgetRows, useBudgetSummary } from '@/hooks/useBudget'
import { setBudget, copyFromPreviousMonth, clearMonthBudgets, coverMonthSpent } from '@/services/api/budget'
import { formatCurrency, currentMonth } from '@/utils/format'
import { useAccountingPeriod } from '@/utils/accountingPeriod'
import { getSavedBudgetRegime, saveBudgetRegime, type AccountingRegime } from '@/utils/accountingRegime'
import { useConfirm } from '@/context/ConfirmContext'
import PriceInput from '@/components/atoms/PriceInput'
import MonthNavigator from '@/components/atoms/MonthNavigator'
import BudgetRegimeSelector from '@/components/atoms/BudgetRegimeSelector'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import PendingIssuesCard from '@/components/organisms/PendingIssuesCard'
import CategoryTransactionsModal from '@/components/organisms/CategoryTransactionsModal'
import type {
  Category,
  CategoryBudgetRow,
  GroupBudgetRow,
  IncomeCategoryBudgetRow,
  IncomeGroupBudgetRow,
} from '@/types'

export interface CategoryModalData {
  category: Category
  budgeted?: number
  activity?: number
  available?: number
  isIncome?: boolean
}

const BUDGET_SUMMARY_EXPANDED_KEY = 'fin_budget_summary_expanded'

function getInitialSummaryExpanded(): boolean {
  try {
    const saved = localStorage.getItem(BUDGET_SUMMARY_EXPANDED_KEY)
    if (saved !== null) {
      return saved === 'true'
    }
  } catch {
    // ignore
  }
  return true
}

// ── Célula editável inline ────────────────────────────────────

function BudgetCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [currentVal, setCurrentVal] = useState(value)

  const startEdit = () => {
    setCurrentVal(value)
    setEditing(true)
  }

  const commitEdit = () => {
    onSave(currentVal)
    setEditing(false)
  }

  if (editing) {
    return (
      <PriceInput
        autoFocus
        className="w-full text-right bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-xs sm:text-sm text-slate-100 tabular-nums focus:outline-none min-h-[32px]"
        value={currentVal}
        onChange={v => setCurrentVal(v)}
        onBlur={commitEdit}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') setEditing(false)
        }}
        placeholder="0,00"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="w-full text-right text-xs sm:text-sm text-slate-300 hover:text-indigo-300 tabular-nums transition-colors rounded px-2 py-1 hover:bg-slate-700/50 active:bg-slate-700 min-h-[32px] font-normal"
    >
      {value === 0 ? <span className="text-slate-600">—</span> : formatCurrency(value)}
    </button>
  )
}

// ── Linhas de Receitas / Renda ────────────────────────────────

function IncomeCategoryRow({
  row,
  month,
  budgetRegime = 'cash',
  onSelectCategory,
}: {
  row: IncomeCategoryBudgetRow
  month: string
  budgetRegime?: AccountingRegime
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const handleSave = useCallback(
    async (v: number) => {
      if (row.category.id !== undefined) await setBudget(month, row.category.id, v, true, budgetRegime)
    },
    [month, row.category.id, budgetRegime]
  )

  const diff = Math.round((row.expected - row.received) * 100) / 100

  const diffColor =
    diff <= 0.005 && (row.received > 0.005 || row.expected > 0.005)
      ? 'text-emerald-400 font-medium'
      : diff > 0.005
      ? 'text-amber-400/90 font-medium'
      : 'text-slate-500 font-normal'

  return (
    <tr className="group hover:bg-slate-800/30 transition-colors">
      {/* Nome da categoria */}
      <td
        onClick={() =>
          onSelectCategory({
            category: row.category,
            budgeted: row.expected,
            activity: row.received,
            isIncome: true,
          })
        }
        className="py-2.5 pl-6 sm:pl-10 pr-2 text-xs sm:text-sm text-slate-300 cursor-pointer"
        title="Clique para ver as transações desta categoria no mês"
      >
        <span className="break-words leading-tight block group-hover:text-emerald-300 transition-colors" title={row.category.name}>
          {row.category.name}
        </span>
      </td>
      {/* Previsto / Orçado */}
      <td className="py-2.5 px-2 text-right">
        <BudgetCell value={row.expected} onSave={handleSave} />
      </td>
      {/* Recebido */}
      <td
        onClick={() =>
          onSelectCategory({
            category: row.category,
            budgeted: row.expected,
            activity: row.received,
            isIncome: true,
          })
        }
        className="py-2.5 px-2 text-right text-xs sm:text-sm text-emerald-400 font-medium tabular-nums cursor-pointer hover:bg-slate-800/50"
        title="Clique para ver as transações desta categoria no mês"
      >
        {row.received > 0
          ? `+${formatCurrency(row.received)}`
          : <span className="text-slate-600">—</span>}
      </td>
      {/* A Receber / Diferença */}
      <td
        onClick={() =>
          onSelectCategory({
            category: row.category,
            budgeted: row.expected,
            activity: row.received,
            isIncome: true,
          })
        }
        className={`py-2.5 pl-2 pr-3 sm:pr-6 text-right text-xs sm:text-sm tabular-nums cursor-pointer hover:bg-slate-800/50 ${diffColor}`}
        title="Clique para ver as transações desta categoria no mês"
      >
        {row.expected === 0 && row.received === 0 ? (
          <span className="text-slate-600">—</span>
        ) : diff > 0 ? (
          formatCurrency(diff)
        ) : diff < 0 ? (
          <span className="text-emerald-400 font-semibold" title="Superou a meta prevista!">
            +{formatCurrency(Math.abs(diff))}
          </span>
        ) : (
          <span className="text-emerald-400 text-xs font-semibold">100%</span>
        )}
      </td>
    </tr>
  )
}

function IncomeGroupRow({
  row,
  month,
  budgetRegime = 'cash',
  onSelectCategory,
}: {
  row: IncomeGroupBudgetRow
  month: string
  budgetRegime?: AccountingRegime
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const [open, setOpen] = useState(true)
  const groupDiff = Math.round((row.totalExpected - row.totalReceived) * 100) / 100

  return (
    <>
      <tr
        className="cursor-pointer select-none bg-emerald-950/20 border-t border-emerald-900/30 hover:bg-emerald-950/30 active:bg-emerald-950/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2.5 pl-3 sm:pl-6 pr-2 text-xs sm:text-sm font-semibold text-emerald-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-emerald-500 text-xs flex-shrink-0">{open ? '▾' : '▸'}</span>
            <span className="break-words leading-tight" title={row.group.name}>{row.group.name}</span>
          </span>
        </td>
        <td className="py-2.5 px-2 text-right text-xs sm:text-sm font-semibold text-emerald-300/80 tabular-nums">
          {row.totalExpected > 0 ? formatCurrency(row.totalExpected) : <span className="text-slate-600">—</span>}
        </td>
        <td className="py-2.5 px-2 text-right text-xs sm:text-sm text-emerald-400 font-semibold tabular-nums">
          {row.totalReceived > 0 ? `+${formatCurrency(row.totalReceived)}` : <span className="text-slate-600">—</span>}
        </td>
        <td className={`py-2.5 pl-2 pr-3 sm:pr-6 text-right text-xs sm:text-sm font-semibold tabular-nums ${
          groupDiff <= 0 ? 'text-emerald-400' : 'text-amber-400/90'
        }`}>
          {row.totalExpected === 0 && row.totalReceived === 0 ? (
            <span className="text-slate-600">—</span>
          ) : groupDiff > 0 ? (
            formatCurrency(groupDiff)
          ) : groupDiff < 0 ? (
            `+${formatCurrency(Math.abs(groupDiff))}`
          ) : (
            '100%'
          )}
        </td>
      </tr>
      {open && row.categories.map(c => (
        <IncomeCategoryRow key={c.category.id} row={c} month={month} budgetRegime={budgetRegime} onSelectCategory={onSelectCategory} />
      ))}
    </>
  )
}

// ── Linha de categoria de Despesas ────────────────────────────

function CategoryRow({
  row,
  month,
  budgetRegime = 'cash',
  onSelectCategory,
}: {
  row: CategoryBudgetRow
  month: string
  budgetRegime?: AccountingRegime
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const handleSave = useCallback(
    async (v: number) => {
      if (row.category.id !== undefined) await setBudget(month, row.category.id, v, true, budgetRegime)
    },
    [month, row.category.id, budgetRegime]
  )

  const availColor =
    row.available > 0.005 ? 'text-emerald-400 font-medium' :
    row.available < -0.005 ? 'text-rose-400 font-medium' : 'text-slate-500 font-normal'

  return (
    <tr className="group hover:bg-slate-800/30 transition-colors">
      {/* Nome da categoria */}
      <td
        onClick={() =>
          onSelectCategory({
            category: row.category,
            budgeted: row.budgeted,
            activity: row.activity,
            available: row.available,
            isIncome: false,
          })
        }
        className="py-2.5 pl-6 sm:pl-10 pr-2 text-xs sm:text-sm text-slate-300 cursor-pointer"
        title="Clique para ver as transações desta categoria no mês"
      >
        <span className="break-words leading-tight block group-hover:text-indigo-300 transition-colors" title={row.category.name}>
          {row.category.name}
        </span>
      </td>
      {/* Orçado */}
      <td className="py-2.5 px-2 text-right">
        <BudgetCell value={row.budgeted} onSave={handleSave} />
      </td>
      {/* Gasto */}
      <td
        onClick={() =>
          onSelectCategory({
            category: row.category,
            budgeted: row.budgeted,
            activity: row.activity,
            available: row.available,
            isIncome: false,
          })
        }
        className="py-2.5 px-2 text-right text-xs sm:text-sm text-slate-400 tabular-nums font-normal cursor-pointer hover:bg-slate-800/50"
        title="Clique para ver as transações desta categoria no mês"
      >
        {row.activity > 0
          ? <span className="text-rose-400 font-medium">{formatCurrency(row.activity)}</span>
          : <span className="text-slate-600">—</span>}
      </td>
      {/* Disponível */}
      <td
        onClick={() =>
          onSelectCategory({
            category: row.category,
            budgeted: row.budgeted,
            activity: row.activity,
            available: row.available,
            isIncome: false,
          })
        }
        className={`py-2.5 pl-2 pr-3 sm:pr-6 text-right text-xs sm:text-sm tabular-nums cursor-pointer hover:bg-slate-800/50 ${availColor}`}
        title="Clique para ver as transações desta categoria no mês"
      >
        {formatCurrency(Math.abs(row.available))}
      </td>
    </tr>
  )
}

// ── Linha de grupo de Despesas ────────────────────────────────

function GroupRow({
  row,
  month,
  budgetRegime = 'cash',
  onSelectCategory,
}: {
  row: GroupBudgetRow
  month: string
  budgetRegime?: AccountingRegime
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <tr
        className="cursor-pointer select-none bg-slate-800/40 hover:bg-slate-800/60 active:bg-slate-800/80 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2.5 pl-3 sm:pl-6 pr-2 text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-500 text-xs flex-shrink-0">{open ? '▾' : '▸'}</span>
            <span className="break-words leading-tight" title={row.group.name}>{row.group.name}</span>
          </span>
        </td>
        <td className="py-2.5 px-2 text-right text-xs sm:text-sm font-semibold text-slate-300 tabular-nums">
          {row.totalBudgeted > 0 ? formatCurrency(row.totalBudgeted) : <span className="text-slate-600">—</span>}
        </td>
        <td className="py-2.5 px-2 text-right text-xs sm:text-sm text-rose-400/80 font-semibold tabular-nums">
          {row.totalActivity > 0 ? formatCurrency(row.totalActivity) : <span className="text-slate-600">—</span>}
        </td>
        <td className={`py-2.5 pl-2 pr-3 sm:pr-6 text-right text-xs sm:text-sm font-semibold tabular-nums ${
          row.totalAvailable >= -0.005 ? 'text-slate-300' : 'text-rose-400'
        }`}>
          {formatCurrency(Math.abs(row.totalAvailable))}
        </td>
      </tr>
      {open && row.categories.map(cat => (
        <CategoryRow key={cat.category.id} row={cat} month={month} budgetRegime={budgetRegime} onSelectCategory={onSelectCategory} />
      ))}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth)
  const [budgetRegime, setBudgetRegime] = useState<AccountingRegime>(getSavedBudgetRegime)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<CategoryModalData | null>(null)

  const { startMonth } = useAccountingPeriod()

  const rows = useBudgetRows(month, budgetRegime)
  const incomeRows = useIncomeBudgetRows(month, budgetRegime)
  const summary = useBudgetSummary(month, budgetRegime)

  const handleBudgetRegimeChange = (newRegime: AccountingRegime) => {
    setBudgetRegime(newRegime)
    saveBudgetRegime(newRegime)
  }

  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(getInitialSummaryExpanded)

  const toggleSummaryExpanded = useCallback(() => {
    setIsSummaryExpanded(prev => {
      const next = !prev
      try {
        localStorage.setItem(BUDGET_SUMMARY_EXPANDED_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const totalSpent = rows?.reduce((s, r) => s + r.totalActivity, 0) ?? 0

  const confirm = useConfirm()

  const handleCopy = async () => {
    setShowMenu(false)
    await copyFromPreviousMonth(month, budgetRegime)
  }

  const handleCoverSpent = async () => {
    setShowMenu(false)
    const ok = await confirm({
      title: 'Cobrir Gastos do Mês?',
      message: `Deseja ajustar o valor orçado de cada categoria para cobrir exatamente o que foi gasto neste mês (${budgetRegime === 'accrual' ? 'Regime de Competência' : 'Regime de Caixa'})?`,
      confirmText: 'Cobrir Gastos',
      variant: 'info',
    })
    if (ok) {
      await coverMonthSpent(month, rows, budgetRegime)
    }
  }

  const handleClear = async () => {
    setShowMenu(false)
    const ok = await confirm({
      title: 'Zerar Orçamento?',
      message: `Deseja zerar todos os valores orçados deste mês no modelo ${budgetRegime === 'accrual' ? 'de Competência' : 'de Caixa'}?`,
      confirmText: 'Zerar Orçamento',
      variant: 'warning',
    })
    if (ok) {
      await clearMonthBudgets(month, budgetRegime)
    }
  }

  const tbbColor =
    !summary ? 'text-slate-400' :
    summary.toBeBudgeted > 0.005 ? 'text-emerald-400' :
    summary.toBeBudgeted < -0.005 ? 'text-rose-400' : 'text-slate-400'

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 bg-slate-900 border-b border-slate-800 flex-shrink-0 gap-2 relative z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >

        {/* Navegação de mês e Seletor de Modelo de Orçamento */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <MonthNavigator month={month} onChangeMonth={setMonth} minMonth={startMonth} />
          <BudgetRegimeSelector regime={budgetRegime} onChangeRegime={handleBudgetRegimeChange} />
        </div>

        {/* To Be Budgeted */}
        {summary && (
          <div className="text-center flex-1 min-w-0">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {summary.isFutureMonth
                  ? 'A orçar (Projetado)'
                  : (summary.totalExpectedIncome ?? 0) > 0
                  ? 'A orçar (Caixa)'
                  : 'A orçar'}
              </p>
              {summary.isFutureMonth ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50"
                  title={`Sobra vinda do mês anterior: ${formatCurrency(summary.rolloverFromPreviousMonth ?? 0)} | Receitas previstas: ${formatCurrency(summary.totalExpectedIncome ?? 0)}`}
                >
                  Sobra: {formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}
                </span>
              ) : (
                (summary.pendingExpectedIncome ?? 0) > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50"
                    title="Saldo projetado a orçar ao fim do mês considerando receitas previstas pendentes"
                  >
                    Previsto ao fim: {formatCurrency(summary.projectedToBeBudgeted)}
                  </span>
                )
              )}
            </div>
            <p className={`text-base sm:text-lg font-bold tabular-nums truncate ${tbbColor}`}>
              {formatCurrency(summary.toBeBudgeted)}
            </p>
          </div>
        )}

        {/* Menu de ações e status de sync */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="lg:hidden">
            <SyncStatusBadge compact={true} />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(s => !s)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden min-w-[190px] fade-in">
                  <button onClick={handleCoverSpent} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 active:bg-slate-600 transition-colors">
                    <CheckCheck className="w-4 h-4 text-emerald-400" />
                    Cobrir gastos do mês
                  </button>
                  <button onClick={handleCopy} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 active:bg-slate-600 transition-colors border-t border-slate-700">
                    <Copy className="w-4 h-4 text-slate-400" />
                    Copiar mês anterior
                  </button>
                  <button onClick={handleClear} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-400 hover:bg-slate-700 active:bg-slate-600 transition-colors border-t border-slate-700">
                    <Trash2 className="w-4 h-4" />
                    Zerar orçamento
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Resumo dos valores que influenciam o orçamento do mês atual (Colapsável) ── */}
      {summary && (
        <div className="bg-slate-900/60 border-b border-slate-800/80 flex-shrink-0 select-none transition-all">
          {/* Barra de controle / Header colapsável */}
          <div
            onClick={toggleSummaryExpanded}
            className="flex items-center justify-between px-3 sm:px-6 py-1.5 cursor-pointer hover:bg-slate-800/40 active:bg-slate-800/60 transition-colors group"
            title={isSummaryExpanded ? 'Clique para recolher o resumo financeiro' : 'Clique para expandir o resumo financeiro'}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-300 transition-colors">
                {summary.isFutureMonth ? 'Planejamento do Mês' : 'Resumo do Mês'}
              </span>
              {!isSummaryExpanded && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 truncate">
                  {summary.isFutureMonth ? (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>Sobra Anterior: <strong className="text-indigo-300 font-medium">+{formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Previsto: <strong className="text-emerald-400 font-medium">+{formatCurrency(summary.totalExpectedIncome ?? 0)}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Orçado: <strong className="text-indigo-300 font-medium">-{formatCurrency(summary.totalBudgeted)}</strong></span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>Receitas: <strong className="text-emerald-400 font-medium">+{formatCurrency(summary.totalIncome)}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Orçado: <strong className="text-indigo-300 font-medium">-{formatCurrency(summary.totalBudgeted)}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Gastos: <strong className="text-amber-400 font-medium">{formatCurrency(totalSpent)}</strong></span>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-indigo-300 transition-colors px-1.5 py-0.5 rounded-md hover:bg-slate-800/60"
              aria-expanded={isSummaryExpanded}
            >
              <span className="hidden sm:inline">{isSummaryExpanded ? 'Recolher resumo' : 'Ver resumo completo'}</span>
              {isSummaryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Grid detalhado de 3 cards (quando expandido) */}
          {isSummaryExpanded && (
            <div className="px-3 pb-3 sm:px-6 sm:pb-3 pt-1 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {summary.isFutureMonth ? (
                  <>
                    {/* Sobra Projetada do Mês Anterior */}
                    <div
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm"
                      title="Sobra líquida projetada que transborda do planejamento do mês anterior"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500 font-medium truncate">Sobra Anterior</p>
                        <p className={`text-xs sm:text-sm font-bold tabular-nums truncate ${
                          (summary.rolloverFromPreviousMonth ?? 0) >= 0 ? 'text-indigo-300' : 'text-rose-400'
                        }`}>
                          {(summary.rolloverFromPreviousMonth ?? 0) >= 0 ? '+' : ''}
                          {formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}
                        </p>
                      </div>
                    </div>

                    {/* Receitas Previstas */}
                    <div
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm"
                      title="Receitas e rendas previstas/planejadas para este mês futuro"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <ArrowDownLeft className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500 font-medium truncate">Receitas Previstas</p>
                        <p className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums truncate">
                          +{(summary.totalExpectedIncome ?? 0) > 0 ? formatCurrency(summary.totalExpectedIncome ?? 0) : formatCurrency(0)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Receitas do Mês */}
                    <div
                      className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm"
                      title="Entradas registradas no mês e meta prevista"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <ArrowDownLeft className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[10px] text-slate-500 font-medium truncate">Receitas Mês</p>
                          {(summary.totalExpectedIncome ?? 0) > 0 && (
                            <span className="text-[9px] text-indigo-400 font-medium truncate">
                              Meta: {formatCurrency(summary.totalExpectedIncome ?? 0)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums truncate">
                          +{formatCurrency(summary.totalIncome)}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Orçado em Categorias */}
                <div
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm"
                  title="Total alocado em envelopes/categorias de despesa no mês (- deduz do orçamento)"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-500 font-medium truncate">Orçado Mês</p>
                    <p className="text-xs sm:text-sm font-bold text-indigo-300 tabular-nums truncate">
                      {summary.totalBudgeted > 0 ? `-${formatCurrency(summary.totalBudgeted)}` : <span className="text-slate-600">—</span>}
                    </p>
                  </div>
                </div>

                {!summary.isFutureMonth && (
                  /* Gastos Realizados */
                  <div
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm"
                    title="Total de despesas efetivamente realizadas no mês nas categorias"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400 flex-shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-500 font-medium truncate">Gastos Reais</p>
                      <p className="text-xs sm:text-sm font-bold text-amber-400/90 tabular-nums truncate">
                        {totalSpent > 0 ? formatCurrency(totalSpent) : <span className="text-slate-600">—</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tabela ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3">
        {/* Banner de inconsistências / pendências */}
        <div className="px-3 sm:px-6 pt-3">
          <PendingIssuesCard />
        </div>

        {!rows && !incomeRows ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Carregando…</div>
        ) : (rows?.length === 0 && incomeRows?.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-4 text-center">
            <p className="text-slate-500 text-sm">Nenhuma categoria ainda.</p>
            <Link to="/settings" className="btn-secondary text-xs">
              Criar categorias em Configurações
            </Link>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[35%] sm:w-[37%]" />
              <col className="w-[22%] sm:w-[21%]" />
              <col className="w-[21.5%] sm:w-[21%]" />
              <col className="w-[21.5%] sm:w-[21%]" />
            </colgroup>
            <tbody>
              {/* ── Seção de Despesas (com 3 colunas) ── */}
              {rows && rows.length > 0 && (
                <>
                  <tr className="bg-slate-950/90 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0 backdrop-blur-sm z-10 select-none">
                    <th className="py-2 pl-3 sm:pl-6 pr-1 text-left">Despesas</th>
                    <th className="py-2 px-2 text-right">Orçado</th>
                    <th className="py-2 px-2 text-right">Gasto</th>
                    <th className="py-2 pl-2 pr-3 sm:pr-6 text-right">Disponível</th>
                  </tr>
                  {rows.map(row => (
                    <GroupRow key={row.group.id} row={row} month={month} budgetRegime={budgetRegime} onSelectCategory={setSelectedCategoryModal} />
                  ))}
                </>
              )}

              {/* ── Seção de Renda / Receitas ── */}
              {incomeRows && incomeRows.length > 0 && (
                <>
                  <tr className="bg-slate-950/90 text-[10px] sm:text-xs font-semibold text-emerald-400/90 uppercase tracking-wider border-t border-b border-emerald-900/40 select-none">
                    <th className="py-2 pl-3 sm:pl-6 pr-1 text-left">Receitas & Rendas</th>
                    <th className="py-2 px-2 text-right">Previsto</th>
                    <th className="py-2 px-2 text-right">Recebido</th>
                    <th className="py-2 pl-2 pr-3 sm:pr-6 text-right">A Receber</th>
                  </tr>
                  {incomeRows.map(row => (
                    <IncomeGroupRow key={row.group.id} row={row} month={month} budgetRegime={budgetRegime} onSelectCategory={setSelectedCategoryModal} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Transações da Categoria */}
      {selectedCategoryModal && (
        <CategoryTransactionsModal
          category={selectedCategoryModal.category}
          month={month}
          budgeted={selectedCategoryModal.budgeted}
          activity={selectedCategoryModal.activity}
          available={selectedCategoryModal.available}
          isIncome={selectedCategoryModal.isIncome}
          regime={budgetRegime}
          onClose={() => setSelectedCategoryModal(null)}
        />
      )}
    </div>
  )
}
