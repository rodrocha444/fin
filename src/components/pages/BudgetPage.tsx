import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Copy,
  Trash2,
  MoreHorizontal,
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
        {row.available < -0.005 ? `-${formatCurrency(Math.abs(row.available))}` : formatCurrency(row.available)}
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
          {row.totalAvailable < -0.005 ? `-${formatCurrency(Math.abs(row.totalAvailable))}` : formatCurrency(row.totalAvailable)}
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

      {/* ── Header Principal ─────────────────────────────────── */}
      <div
        className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/90 flex-shrink-0 relative z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="px-3 sm:px-6 pb-3 space-y-2 sm:space-y-0">
          
          {/* Barra Principal: Mês + Regime + Hero Card (sm+) + Sync & Menu */}
          <div className="flex items-center justify-between gap-2">
            
            {/* Esquerda: Navegação de Mês + Seletor de Regime */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink-0">
              <MonthNavigator month={month} onChangeMonth={setMonth} minMonth={startMonth} />
              <BudgetRegimeSelector regime={budgetRegime} onChangeRegime={handleBudgetRegimeChange} />
            </div>

            {/* Centro no Desktop (sm+): Card Hero "Disponível a Orçar" */}
            {summary && (
              <div className="hidden sm:flex flex-1 items-center justify-center px-2 min-w-0">
                <div
                  className={`px-4 py-1.5 rounded-xl border flex items-center justify-center gap-3 shadow-sm transition-all duration-200 ${
                    summary.toBeBudgeted > 0.005
                      ? 'bg-emerald-950/30 border-emerald-800/50 shadow-emerald-950/20'
                      : summary.toBeBudgeted < -0.005
                      ? 'bg-rose-950/30 border-rose-800/50 shadow-rose-950/20'
                      : 'bg-slate-800/50 border-slate-700/60'
                  }`}
                >
                  <div className="text-right min-w-0">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">
                        {summary.isFutureMonth
                          ? 'A Orçar (Projetado)'
                          : (summary.totalExpectedIncome ?? 0) > 0
                          ? 'A Orçar (Caixa)'
                          : 'Disponível a Orçar'}
                      </span>
                      {summary.isFutureMonth ? (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800/60 flex-shrink-0"
                          title={`Sobra vinda do mês anterior: ${formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}`}
                        >
                          Sobra: {formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}
                        </span>
                      ) : (
                        (summary.pendingExpectedIncome ?? 0) > 0 && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-800/60 flex-shrink-0"
                            title="Saldo projetado a orçar ao fim do mês considerando receitas previstas pendentes"
                          >
                            Previsto: {formatCurrency(summary.projectedToBeBudgeted)}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className={`text-base lg:text-lg font-extrabold tabular-nums tracking-tight ${tbbColor}`}>
                      {formatCurrency(summary.toBeBudgeted)}
                    </span>
                  </div>
                </div>
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
                  className={`p-2 rounded-lg transition-all duration-150 border ${
                    showMenu
                      ? 'bg-slate-800 border-indigo-500/50 text-indigo-300 shadow-sm'
                      : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/70 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Ações do orçamento do mês"
                  aria-label="Opções do orçamento"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl z-40 p-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={handleCoverSpent}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
                      >
                        <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Cobrir gastos do mês</span>
                      </button>
                      <button
                        onClick={handleCopy}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors border-t border-slate-800/80 mt-1 pt-2"
                      >
                        <Copy className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span>Copiar mês anterior</span>
                      </button>
                      <button
                        onClick={handleClear}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors border-t border-slate-800/80 mt-1 pt-2"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>Zerar orçamento</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Mobile (< sm): Card Hero "Disponível a Orçar" posicionado logo abaixo */}
          {summary && (
            <div className="sm:hidden pt-0.5">
              <div
                className={`w-full px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 shadow-sm transition-all duration-200 ${
                  summary.toBeBudgeted > 0.005
                    ? 'bg-emerald-950/30 border-emerald-800/50 shadow-emerald-950/20'
                    : summary.toBeBudgeted < -0.005
                    ? 'bg-rose-950/30 border-rose-800/50 shadow-rose-950/20'
                    : 'bg-slate-800/50 border-slate-700/60'
                }`}
              >
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {summary.isFutureMonth
                        ? 'A Orçar (Projetado)'
                        : (summary.totalExpectedIncome ?? 0) > 0
                        ? 'A Orçar (Caixa)'
                        : 'Disponível a Orçar'}
                    </span>
                    {summary.isFutureMonth ? (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800/60"
                        title={`Sobra vinda do mês anterior: ${formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}`}
                      >
                        Sobra: {formatCurrency(summary.rolloverFromPreviousMonth ?? 0)}
                      </span>
                    ) : (
                      (summary.pendingExpectedIncome ?? 0) > 0 && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-800/60"
                          title="Saldo projetado a orçar ao fim do mês considerando receitas previstas pendentes"
                        >
                          Previsto: {formatCurrency(summary.projectedToBeBudgeted)}
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {summary.toBeBudgeted > 0.005
                      ? 'Disponível para distribuir'
                      : summary.toBeBudgeted < -0.005
                      ? 'Orçamento excedeu receitas'
                      : 'Orçamento 100% equilibrado'}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className={`text-base font-extrabold tabular-nums tracking-tight ${tbbColor}`}>
                    {formatCurrency(summary.toBeBudgeted)}
                  </span>
                </div>
              </div>
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
