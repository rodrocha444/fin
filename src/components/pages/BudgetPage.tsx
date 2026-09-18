import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Copy,
  Trash2,
  MoreHorizontal,
  CheckCheck,
  Loader2,
  HelpCircle,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import { useBudgetRows, useIncomeBudgetRows, useBudgetSummary } from '@/hooks/useBudget'
import { setBudget, copyFromPreviousMonth, clearMonthBudgets, coverMonthSpent } from '@/services/api/budget'
import { formatCurrency, currentMonth, formatMonthLabel, shiftMonth } from '@/utils/format'
import { useAccountingPeriod } from '@/utils/accountingPeriod'
import { getSavedBudgetRegime, saveBudgetRegime, type AccountingRegime } from '@/utils/accountingRegime'
import { useConfirm, useAlert } from '@/context/ConfirmContext'
import PriceInput from '@/components/atoms/PriceInput'
import MonthNavigator from '@/components/atoms/MonthNavigator'
import BudgetRegimeSelector from '@/components/atoms/BudgetRegimeSelector'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import PendingIssuesCard from '@/components/organisms/PendingIssuesCard'
import CategoryTransactionsModal from '@/components/organisms/CategoryTransactionsModal'
import OnboardingWizardModal from '@/components/organisms/OnboardingWizardModal'
import Modal from '@/components/atoms/Modal'
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

// ── Célula editável inline ────────────────────────────────────

function BudgetCell({
  value,
  onSave,
}: {
  value: number
  onSave: (v: number) => Promise<void> | void
}) {
  const [editing, setEditing] = useState(false)
  const [currentVal, setCurrentVal] = useState(value)
  const [loading, setLoading] = useState(false)
  const isSavingRef = useRef(false)

  const startEdit = () => {
    if (loading) return
    setCurrentVal(value)
    setEditing(true)
  }

  const commitEdit = async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setEditing(false)

    if (currentVal === value) {
      isSavingRef.current = false
      return
    }

    try {
      setLoading(true)
      await onSave(currentVal)
    } catch (err) {
      console.error('Erro ao salvar valor orçado:', err)
    } finally {
      setLoading(false)
      isSavingRef.current = false
    }
  }

  const cancelEdit = () => {
    isSavingRef.current = true
    setCurrentVal(value)
    setEditing(false)
    setTimeout(() => {
      isSavingRef.current = false
    }, 50)
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-end px-2 py-1 min-h-[32px] text-xs sm:text-sm text-indigo-400 gap-1.5 animate-pulse">
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-indigo-400" />
        <span className="tabular-nums font-medium">
          {currentVal === 0 ? <span className="text-slate-600">—</span> : formatCurrency(currentVal)}
        </span>
      </div>
    )
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
          if (e.key === 'Escape') cancelEdit()
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
    row.available < -0.005 ? 'text-rose-400 font-semibold' : 'text-slate-500 font-normal'

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
        title={
          row.available < -0.005
            ? `Atenção: faltam ${formatCurrency(Math.abs(row.available))} para cobrir os gastos desta categoria`
            : 'Clique para ver as transações desta categoria no mês'
        }
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
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [showAdvancedMode, setShowAdvancedMode] = useState<boolean>(() => {
    return localStorage.getItem('fin_advanced_mode') === 'true' || localStorage.getItem('finplan_advanced_mode') === 'true' || getSavedBudgetRegime() === 'accrual'
  })

  const toggleAdvancedMode = () => {
    const next = !showAdvancedMode
    setShowAdvancedMode(next)
    localStorage.setItem('fin_advanced_mode', String(next))
    if (!next && budgetRegime !== 'cash') {
      handleBudgetRegimeChange('cash')
    }
  }

  const { startMonth } = useAccountingPeriod()

  const rows = useBudgetRows(month, budgetRegime)
  const incomeRows = useIncomeBudgetRows(month, budgetRegime)
  const summary = useBudgetSummary(month, budgetRegime)

  const handleBudgetRegimeChange = (newRegime: AccountingRegime) => {
    setBudgetRegime(newRegime)
    saveBudgetRegime(newRegime)
  }

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth)
  }

  const confirm = useConfirm()
  const alert = useAlert()
  const [isProcessingBudget, setIsProcessingBudget] = useState(false)

  const handleCopy = async () => {
    setShowMenu(false)
    const prevMonth = shiftMonth(month, -1)
    const prevLabel = formatMonthLabel(prevMonth)
    const currentLabel = formatMonthLabel(month)
    const regimeLabel = budgetRegime === 'accrual' ? 'Regime de Competência' : 'Regime de Caixa'

    const ok = await confirm({
      title: 'Copiar Orçamento do Mês Anterior?',
      message: `Deseja copiar todos os valores orçados de ${prevLabel} para ${currentLabel} (${regimeLabel})?`,
      details: 'Atenção: Quaisquer valores já orçados nas categorias correspondentes deste mês serão substituídos.',
      confirmText: 'Copiar Orçamento',
      variant: 'info',
    })

    if (!ok) return

    try {
      setIsProcessingBudget(true)
      const result = await copyFromPreviousMonth(month, budgetRegime)
      if (!result.success || result.copiedCount === 0) {
        await alert({
          title: 'Nenhum Orçamento Encontrado',
          message: `Não foram encontrados valores orçados no mês anterior (${prevLabel}) para o ${regimeLabel}.`,
          variant: 'info',
        })
      }
    } catch (err: any) {
      await alert({
        title: 'Erro ao Copiar Orçamento',
        message: err?.message || 'Ocorreu um erro inesperado ao copiar o orçamento.',
        variant: 'danger',
      })
    } finally {
      setIsProcessingBudget(false)
    }
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
      try {
        setIsProcessingBudget(true)
        await coverMonthSpent(month, rows, budgetRegime)
      } catch (err: any) {
        await alert({
          title: 'Erro ao Cobrir Gastos',
          message: err?.message || 'Erro inesperado ao cobrir gastos.',
          variant: 'danger',
        })
      } finally {
        setIsProcessingBudget(false)
      }
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
      try {
        setIsProcessingBudget(true)
        await clearMonthBudgets(month, budgetRegime)
      } catch (err: any) {
        await alert({
          title: 'Erro ao Zerar Orçamento',
          message: err?.message || 'Erro inesperado ao zerar orçamento.',
          variant: 'danger',
        })
      } finally {
        setIsProcessingBudget(false)
      }
    }
  }

  const isAccrual = budgetRegime === 'accrual'
  const isFuture = Boolean(summary?.isFutureMonth)
  const hasExpectedIncome = (summary?.totalExpectedIncome ?? 0) > 0

  // Valor principal exibido no card Hero:
  // - Competência mês futuro: Resultado Previsto (Receita Prevista − Despesa Orçada)
  // - Competência mês atual/passado: Resultado Realizado (Receitas Reais que entraram − Despesas Reais)
  // - Caixa: Disponível a Orçar / Projeção a Orçar
  const heroValue = !summary
    ? 0
    : isAccrual
    ? (isFuture ? (summary.plannedNetResult ?? 0) : (summary.actualNetResult ?? 0))
    : summary.toBeBudgeted

  const heroColor =
    heroValue > 0.005 ? 'text-emerald-400' :
    heroValue < -0.005 ? 'text-rose-400' : 'text-slate-400'

  const heroBgBorder =
    heroValue > 0.005
      ? 'bg-emerald-950/30 border-emerald-800/50 shadow-emerald-950/20'
      : heroValue < -0.005
      ? 'bg-rose-950/30 border-rose-800/50 shadow-rose-950/20'
      : 'bg-slate-800/50 border-slate-700/60'

  return (
    <div className="flex flex-col h-full">

      {/* ── Header Principal ─────────────────────────────────── */}
      <div
        className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/90 flex-shrink-0 relative z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="px-3 sm:px-6 pb-3 space-y-2 sm:space-y-0">
          
          {/* Barra Principal: Mês + Regime + Hero Card (sm+) + Sync & Menu */}
          <div className="flex items-center justify-between gap-2">
            
            {/* Esquerda: Navegação de Mês + Seletor de Regime (se ativado) */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink-0">
              <MonthNavigator
                month={month}
                onChangeMonth={handleMonthChange}
                minMonth={startMonth}
              />
              {(showAdvancedMode || budgetRegime === 'accrual') && (
                <BudgetRegimeSelector regime={budgetRegime} onChangeRegime={handleBudgetRegimeChange} />
              )}
            </div>

            {/* Centro no Desktop (sm+): Card Hero ("Disponível a Orçar" no Caixa / 3 Pilares na Competência) */}
            {summary && (
              <div className="hidden sm:flex flex-1 items-center justify-center px-2 min-w-0">
                {isAccrual ? (
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border flex items-center justify-center gap-3 sm:gap-4 shadow-sm transition-all duration-200 ${heroBgBorder}`}
                  >
                    {/* 1. Receitas */}
                    <div className="flex flex-col text-right min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Receitas
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
                        {formatCurrency(isFuture ? (summary.totalExpectedIncome ?? 0) : summary.totalIncome)}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate" title="Meta de receita prevista orçada">
                        {isFuture ? 'Previstas' : `Meta: ${formatCurrency(summary.totalExpectedIncome ?? 0)}`}
                      </span>
                    </div>

                    <span className="text-slate-600 font-bold text-xs select-none">−</span>

                    {/* 2. Despesas */}
                    <div className="flex flex-col text-right min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Despesas
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-rose-400 tabular-nums">
                        {formatCurrency(isFuture ? summary.totalBudgeted : (summary.totalSpent ?? 0))}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate" title="Teto de despesas orçado">
                        {isFuture ? 'Orçadas' : `Orçado: ${formatCurrency(summary.totalBudgeted)}`}
                      </span>
                    </div>

                    <span className="text-slate-600 font-bold text-xs select-none">=</span>

                    {/* 3. Resultado Final */}
                    <div className="flex flex-col text-right pl-2 border-l border-slate-700/60 min-w-0">
                      <span className={`text-[10px] uppercase font-bold tracking-wider truncate ${heroValue < -0.005 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {isFuture ? 'Resultado Previsto' : 'Resultado Real'}
                      </span>
                      <span className={`text-sm sm:text-base font-extrabold tabular-nums tracking-tight ${heroColor}`}>
                        {heroValue > 0.005 ? `+${formatCurrency(heroValue)}` : formatCurrency(heroValue)}
                      </span>
                      <div className="flex items-center justify-end gap-1 text-[9px] truncate">
                        {isFuture ? (
                          <span
                            className={`font-semibold ${
                              heroValue > 0.005 ? 'text-emerald-400' : heroValue < -0.005 ? 'text-rose-400 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {heroValue > 0.005 ? 'Previsto: Positivo' : heroValue < -0.005 ? 'Previsto: Negativo' : 'Previsto: Equilibrado'}
                          </span>
                        ) : hasExpectedIncome ? (
                          <span
                            className={`font-semibold ${
                              (summary.plannedNetResult ?? 0) < -0.005
                                ? 'text-rose-400 font-bold'
                                : (summary.plannedNetResult ?? 0) > 0.005
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }`}
                            title={`Resultado Previsto do orçamento (Receitas Previstas − Despesas Orçadas): ${formatCurrency(summary.plannedNetResult ?? 0)}`}
                          >
                            Previsto: {(summary.plannedNetResult ?? 0) > 0.005 ? '+' : ''}{formatCurrency(summary.plannedNetResult ?? 0)}
                          </span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              heroValue > 0.005 ? 'text-emerald-400' : heroValue < -0.005 ? 'text-rose-400 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {heroValue > 0.005 ? 'Positivo' : heroValue < -0.005 ? 'Negativo' : 'Equilibrado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`px-4 py-1.5 rounded-xl border flex items-center justify-center gap-3 shadow-sm transition-all duration-200 ${heroBgBorder}`}
                  >
                    <div className="text-right min-w-0">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">
                            {summary.isFutureMonth ? 'Projeção a Orçar' : 'Disponível a Orçar'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowHelpModal(true)}
                            className="text-slate-500 hover:text-indigo-400 p-0.5 rounded transition-colors"
                            title="Como funciona o Disponível a Orçar?"
                            aria-label="Explicação sobre Disponível a Orçar"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Carryover do mês atual para meses futuros */}
                        {summary.isFutureMonth && (summary.rolloverFromPreviousMonth ?? 0) !== 0 && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600/60 flex-shrink-0"
                            title={`Sobra real do mês atual que seria levada para este mês: ${formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}`}
                          >
                            Carryover: {formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}
                          </span>
                        )}

                        {/* Projeção com renda prevista */}
                        {(summary.pendingExpectedIncome ?? 0) > 0 && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-800/60 flex-shrink-0"
                            title={summary.isFutureMonth
                              ? `Se toda a renda planejada para os meses até aqui entrar, o valor a orçar seria ${formatCurrency(summary.projectedToBeBudgeted)}`
                              : 'Saldo projetado incluindo receitas previstas que ainda não entraram'}
                          >
                            {summary.isFutureMonth ? 'Otimista:' : 'Previsto:'} {formatCurrency(summary.projectedToBeBudgeted)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`text-base lg:text-lg font-extrabold tabular-nums tracking-tight ${heroColor}`}>
                        {formatCurrency(summary.toBeBudgeted)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Direita: Status de Sync + Menu de Ações (Unificado para todas as telas) */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <div className="lg:hidden">
                <SyncStatusBadge compact={true} />
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu(s => !s)}
                  disabled={isProcessingBudget}
                  className={`p-2 rounded-lg transition-all duration-150 border ${
                    showMenu
                      ? 'bg-slate-800 border-indigo-500/50 text-indigo-300 shadow-sm'
                      : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/70 text-slate-400 hover:text-slate-200'
                  } ${isProcessingBudget ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Ações do orçamento do mês"
                  aria-label="Opções do orçamento"
                >
                  {isProcessingBudget ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <MoreHorizontal className="w-4 h-4" />
                  )}
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl z-40 p-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={handleCoverSpent}
                        disabled={isProcessingBudget}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Cobrir gastos do mês</span>
                      </button>
                      <button
                        onClick={handleCopy}
                        disabled={isProcessingBudget}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors border-t border-slate-800/80 mt-1 pt-2 disabled:opacity-50"
                      >
                        <Copy className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span>Copiar mês anterior</span>
                      </button>
                      <button
                        onClick={handleClear}
                        disabled={isProcessingBudget}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors border-t border-slate-800/80 mt-1 pt-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>Zerar orçamento</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          setShowHelpModal(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-slate-800/80 rounded-lg transition-colors border-t border-slate-800/80 mt-1 pt-2"
                      >
                        <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span>Como funciona o Orçamento</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          toggleAdvancedMode()
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800/80 rounded-lg transition-colors border-t border-slate-800/80 mt-1 pt-2"
                      >
                        <SlidersHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{showAdvancedMode ? 'Ocultar Modo Avançado' : 'Modo Avançado (Regimes)'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Mobile (< sm): Card Hero posicionado logo abaixo */}
          {summary && (
            <div className="sm:hidden pt-0.5">
              {isAccrual ? (
                <div
                  className={`w-full px-2.5 py-2 rounded-xl border grid grid-cols-3 divide-x divide-slate-800/80 shadow-sm transition-all duration-200 ${heroBgBorder}`}
                >
                  {/* Coluna 1: Receitas */}
                  <div className="flex flex-col items-center justify-center text-center px-1 min-w-0">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">
                      Receitas
                    </span>
                    <span className="text-xs font-bold text-emerald-400 tabular-nums truncate">
                      {formatCurrency(isFuture ? (summary.totalExpectedIncome ?? 0) : summary.totalIncome)}
                    </span>
                    <span className="text-[8.5px] text-slate-500 truncate" title="Meta prevista">
                      {isFuture ? 'Previstas' : `Meta: ${formatCurrency(summary.totalExpectedIncome ?? 0)}`}
                    </span>
                  </div>

                  {/* Coluna 2: Despesas */}
                  <div className="flex flex-col items-center justify-center text-center px-1 min-w-0">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 truncate">
                      Despesas
                    </span>
                    <span className="text-xs font-bold text-rose-400 tabular-nums truncate">
                      {formatCurrency(isFuture ? summary.totalBudgeted : (summary.totalSpent ?? 0))}
                    </span>
                    <span className="text-[8.5px] text-slate-500 truncate" title="Teto orçado">
                      {isFuture ? 'Orçadas' : `Orç: ${formatCurrency(summary.totalBudgeted)}`}
                    </span>
                  </div>

                  {/* Coluna 3: Resultado */}
                  <div className="flex flex-col items-center justify-center text-center px-1 min-w-0">
                    <span className={`text-[9px] uppercase font-bold tracking-wider truncate ${heroValue < -0.005 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {isFuture ? 'Previsto' : 'Resultado'}
                    </span>
                    <span className={`text-xs font-extrabold tabular-nums tracking-tight truncate ${heroColor}`}>
                      {heroValue > 0.005 ? `+${formatCurrency(heroValue)}` : formatCurrency(heroValue)}
                    </span>
                    <div className="flex items-center justify-center gap-1 text-[8.5px] truncate max-w-full">
                      {isFuture ? (
                        <span
                          className={`font-semibold truncate ${
                            heroValue > 0.005 ? 'text-emerald-400' : heroValue < -0.005 ? 'text-rose-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {heroValue > 0.005 ? 'Positivo' : heroValue < -0.005 ? 'Negativo' : 'Equil.'}
                        </span>
                      ) : hasExpectedIncome ? (
                        <span
                          className={`font-semibold truncate ${
                            (summary.plannedNetResult ?? 0) < -0.005
                              ? 'text-rose-400 font-bold'
                              : (summary.plannedNetResult ?? 0) > 0.005
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                          title={`Resultado Previsto do orçamento: ${formatCurrency(summary.plannedNetResult ?? 0)}`}
                        >
                          Prev: {(summary.plannedNetResult ?? 0) > 0.005 ? '+' : ''}{formatCurrency(summary.plannedNetResult ?? 0)}
                        </span>
                      ) : (
                        <span
                          className={`font-semibold truncate ${
                            heroValue > 0.005 ? 'text-emerald-400' : heroValue < -0.005 ? 'text-rose-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {heroValue > 0.005 ? 'Positivo' : heroValue < -0.005 ? 'Negativo' : 'Equil.'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`w-full px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 shadow-sm transition-all duration-200 ${heroBgBorder}`}
                >
                  <div className="text-left min-w-0">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          {summary.isFutureMonth ? 'Projeção a Orçar' : 'Disponível a Orçar'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowHelpModal(true)}
                          className="text-slate-500 hover:text-indigo-400 p-0.5 rounded transition-colors"
                          title="Como funciona o Disponível a Orçar?"
                          aria-label="Explicação sobre Disponível a Orçar"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {summary.isFutureMonth && (summary.rolloverFromPreviousMonth ?? 0) !== 0 && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300 border border-slate-600/60"
                          title={`Sobra real do mês atual: ${formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}`}
                        >
                          Carryover: {formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}
                        </span>
                      )}

                      {(summary.pendingExpectedIncome ?? 0) > 0 && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-800/60"
                          title={summary.isFutureMonth
                            ? `Se toda a renda planejada entrar, o valor seria ${formatCurrency(summary.projectedToBeBudgeted)}`
                            : 'Saldo projetado incluindo receitas previstas'}
                        >
                          {summary.isFutureMonth ? 'Otimista:' : 'Previsto:'} {formatCurrency(summary.projectedToBeBudgeted)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {summary.isFutureMonth
                        ? `Carryover: ${formatCurrency(summary.rolloverFromPreviousMonth ?? 0)} · Pessimista (sem renda futura)`
                        : summary.toBeBudgeted > 0.005
                        ? 'Disponível para distribuir'
                        : summary.toBeBudgeted < -0.005
                        ? 'Orçamento excedeu receitas'
                        : 'Orçamento 100% equilibrado'}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className={`text-base font-extrabold tabular-nums tracking-tight ${heroColor}`}>
                      {formatCurrency(summary.toBeBudgeted)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Tabela ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3">
        {/* Banner de inconsistências / pendências */}
        <div className="px-3 sm:px-6 pt-3">
          <PendingIssuesCard month={month} regime={budgetRegime} />
        </div>

        {!rows && !incomeRows ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Carregando…</div>
        ) : (rows?.length === 0 && incomeRows?.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600/30 to-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-950/40">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-100">Bem-vindo ao seu Novo Orçamento!</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                O Fin funciona com <strong>Envelopes Virtuais</strong>. Você distribui o dinheiro que tem hoje nas categorias que precisa pagar este mês e acompanha os gastos em tempo real.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => setShowOnboardingModal(true)}
                className="btn-primary flex-1 py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Configuração Guiada (1 min)</span>
              </button>
              <Link
                to="/settings"
                className="btn-secondary py-2.5 px-4 text-xs flex items-center justify-center"
              >
                Criar Manualmente
              </Link>
            </div>
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
                    <th className="py-2 pl-3 sm:pl-6 pr-1 text-left" title="Envelopes de despesas organizados por grupos">
                      Despesas
                    </th>
                    <th className="py-2 px-2 text-right" title="Meta planejada para o envelope no mês">
                      Orçado
                    </th>
                    <th className="py-2 px-2 text-right" title="Total já gasto no mês nesta categoria">
                      Gasto
                    </th>
                    <th className="py-2 pl-2 pr-3 sm:pr-6 text-right" title="Saldo restante no envelope (verde = sobrou, vermelho = estourou o teto)">
                      Disponível
                    </th>
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

      {/* Modal Didático de Ajuda do Orçamento Base Zero */}
      {showHelpModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowHelpModal(false)}
          size="md"
          title={
            <div className="flex items-center gap-2 text-indigo-400">
              <HelpCircle className="w-5 h-5" />
              <span className="text-slate-100 font-semibold text-base">Entenda o Orçamento Base Zero</span>
            </div>
          }
        >
          <div className="p-5 space-y-4 text-xs leading-relaxed text-slate-300">
            <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl space-y-1.5">
              <h4 className="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
                💡 O que é "Disponível a Orçar"?
              </h4>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                É a soma de todo o dinheiro líquido em suas contas correntes que ainda não tem destinação definida.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                As 3 Colunas do seu Mês:
              </h4>

              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200">1. Orçado:</span>
                  <p className="text-[11px] text-slate-400">Quanto você colocou no envelope desta categoria para o mês.</p>
                </div>
                <div className="border-t border-slate-800 pt-2">
                  <span className="font-bold text-slate-200">2. Gasto:</span>
                  <p className="text-[11px] text-slate-400">O total de despesas e compras já lançadas nesta categoria.</p>
                </div>
                <div className="border-t border-slate-800 pt-2">
                  <span className="font-bold text-slate-200">3. Disponível:</span>
                  <p className="text-[11px] text-slate-400">
                    O que restou no envelope. Se estiver verde, você ainda tem saldo. Se ficar vermelho, você gastou mais do que havia planejado e deve remanejar de outro envelope.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-300">
              🎯 <strong>A Regra de Ouro:</strong> Distribua seu dinheiro até o "Disponível a Orçar" ficar <strong>R$ 0,00</strong>. Assim cada real tem um trabalho e você tem controle total.
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="btn-primary w-full py-2.5 text-xs font-semibold mt-2"
            >
              Entendido, fechar
            </button>
          </div>
        </Modal>
      )}

      {/* Assistente de Onboarding Guiado */}
      <OnboardingWizardModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />
    </div>
  )
}
