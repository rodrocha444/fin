import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Trash2, Plus, MoreHorizontal, ArrowDownLeft, CreditCard, Layers, Receipt } from 'lucide-react'
import { useBudgetRows, useIncomeBudgetRows, useBudgetSummary } from '@/hooks/useBudget'
import { setBudget, copyFromPreviousMonth, clearMonthBudgets } from '@/db/repositories/budget'
import { formatCurrency, currentMonth } from '@/utils/format'
import PriceInput from '@/components/atoms/PriceInput'
import MonthNavigator from '@/components/atoms/MonthNavigator'
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
  onSelectCategory,
}: {
  row: IncomeCategoryBudgetRow
  onSelectCategory: (data: CategoryModalData) => void
}) {
  return (
    <tr
      onClick={() =>
        onSelectCategory({
          category: row.category,
          activity: row.received,
          isIncome: true,
        })
      }
      className="group hover:bg-slate-800/40 active:bg-slate-800/60 cursor-pointer transition-colors"
      title="Clique para ver as transações desta categoria no mês"
    >
      <td className="py-2.5 pl-6 sm:pl-10 pr-2 text-xs sm:text-sm text-slate-300 truncate">
        <span className="truncate block group-hover:text-emerald-300 transition-colors" title={row.category.name}>
          {row.category.name}
        </span>
      </td>
      <td colSpan={3} className="py-2.5 pl-2 pr-3 sm:pr-6 text-right text-xs sm:text-sm text-emerald-400 font-medium tabular-nums">
        {row.received > 0
          ? `+${formatCurrency(row.received)}`
          : <span className="text-slate-600">—</span>}
      </td>
    </tr>
  )
}

function IncomeGroupRow({
  row,
  onSelectCategory,
}: {
  row: IncomeGroupBudgetRow
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <tr
        className="cursor-pointer select-none bg-emerald-950/20 border-t border-emerald-900/30 hover:bg-emerald-950/30 active:bg-emerald-950/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td colSpan={4} className="py-2.5 px-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-xs">{open ? '▼' : '▶'}</span>
              <span className="font-semibold text-xs sm:text-sm text-emerald-300 uppercase tracking-wider">
                {row.group.name}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
              +{formatCurrency(row.totalReceived)}
            </span>
          </div>
        </td>
      </tr>
      {open && row.categories.map(c => (
        <IncomeCategoryRow key={c.category.id} row={c} onSelectCategory={onSelectCategory} />
      ))}
    </>
  )
}

// ── Linha de categoria de Despesas ────────────────────────────

function CategoryRow({
  row,
  month,
  onSelectCategory,
}: {
  row: CategoryBudgetRow
  month: string
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const handleSave = useCallback(
    async (v: number) => {
      if (row.category.id !== undefined) await setBudget(month, row.category.id, v)
    },
    [month, row.category.id]
  )

  const isCurrentInvoice = row.category.groupId === 'system_cc_invoices' || row.category.id?.startsWith('cc_invoice_')

  const availColor =
    row.available > 0 ? 'text-emerald-400 font-medium' :
    row.available < 0 ? 'text-rose-400 font-medium' : 'text-slate-500 font-normal'

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
        className="py-2.5 pl-6 sm:pl-10 pr-2 text-xs sm:text-sm text-slate-300 truncate cursor-pointer"
        title="Clique para ver as transações desta categoria no mês"
      >
        <span className="truncate block group-hover:text-indigo-300 transition-colors" title={row.category.name}>
          {row.category.name}
        </span>
      </td>
      {/* Orçado */}
      <td className="py-2.5 px-2 text-right">
        {isCurrentInvoice ? (
          <span className="text-slate-600 block text-right pr-2 select-none" title="Fatura fixa — valor devido no mês independente de orçamento">
            —
          </span>
        ) : (
          <BudgetCell value={row.budgeted} onSave={handleSave} />
        )}
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
  onSelectCategory,
}: {
  row: GroupBudgetRow
  month: string
  onSelectCategory: (data: CategoryModalData) => void
}) {
  const [open, setOpen] = useState(true)
  const isCurrentInvoicesGroup = row.group.id === 'system_cc_invoices' || row.group.name === 'Faturas Atuais'

  return (
    <>
      <tr
        className="cursor-pointer select-none bg-slate-800/40 hover:bg-slate-800/60 active:bg-slate-800/80 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2.5 pl-3 sm:pl-6 pr-2 text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wider truncate">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-500 text-xs flex-shrink-0">{open ? '▾' : '▸'}</span>
            <span className="truncate" title={row.group.name}>{row.group.name}</span>
          </span>
        </td>
        <td className="py-2.5 px-2 text-right text-xs sm:text-sm font-semibold text-slate-400 tabular-nums">
          {!isCurrentInvoicesGroup && row.totalBudgeted > 0 ? formatCurrency(row.totalBudgeted) : <span className="text-slate-600">—</span>}
        </td>
        <td className="py-2.5 px-2 text-right text-xs sm:text-sm text-rose-400/80 font-semibold tabular-nums">
          {row.totalActivity > 0 ? formatCurrency(row.totalActivity) : <span className="text-slate-600">—</span>}
        </td>
        <td className={`py-2.5 pl-2 pr-3 sm:pr-6 text-right text-xs sm:text-sm font-semibold tabular-nums ${
          row.totalAvailable >= 0 ? 'text-slate-300' : 'text-rose-400'
        }`}>
          {formatCurrency(Math.abs(row.totalAvailable))}
        </td>
      </tr>
      {open && row.categories.map(cat => (
        <CategoryRow key={cat.category.id} row={cat} month={month} onSelectCategory={onSelectCategory} />
      ))}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth)
  const [showMenu, setShowMenu] = useState(false)
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<CategoryModalData | null>(null)

  const rows = useBudgetRows(month)
  const incomeRows = useIncomeBudgetRows(month)
  const summary = useBudgetSummary(month)

  const totalSpent = rows?.reduce((s, r) => s + r.totalActivity, 0) ?? 0

  const handleCopy = async () => {
    setShowMenu(false)
    await copyFromPreviousMonth(month)
  }

  const handleClear = async () => {
    setShowMenu(false)
    if (confirm('Zerar todos os valores orçados deste mês?')) {
      await clearMonthBudgets(month)
    }
  }

  const tbbColor =
    !summary ? 'text-slate-400' :
    summary.toBeBudgeted > 0 ? 'text-emerald-400' :
    summary.toBeBudgeted < 0 ? 'text-rose-400' : 'text-slate-400'

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 bg-slate-900 border-b border-slate-800 flex-shrink-0 gap-2 relative z-20"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >

        {/* Navegação de mês (Atom) */}
        <MonthNavigator month={month} onChangeMonth={setMonth} />

        {/* To Be Budgeted */}
        {summary && (
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] text-slate-500">A orçar</p>
            <p className={`text-base sm:text-lg font-bold tabular-nums truncate ${tbbColor}`}>
              {formatCurrency(Math.abs(summary.toBeBudgeted))}
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
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden min-w-[180px] fade-in">
                  <button onClick={handleCopy} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 active:bg-slate-600 transition-colors">
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

      {/* ── Resumo dos valores que influenciam o orçamento do mês atual ── */}
      {summary && (
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex-shrink-0 overflow-x-auto gap-3 sm:gap-6 select-none scrollbar-none">
          {/* Receitas do Mês */}
          <div className="flex items-center gap-2 flex-shrink-0" title="Entradas e rendas registradas no mês (+ soma ao orçamento)">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium leading-none">Receitas Mês</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums leading-tight mt-0.5">
                +{formatCurrency(summary.totalIncome)}
              </p>
            </div>
          </div>

          {/* Faturas do Mês */}
          <div className="flex items-center gap-2 flex-shrink-0" title="Faturas de cartão de crédito com vencimento neste mês (- deduz do orçamento)">
            <div className="w-7 h-7 rounded-lg bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 flex-shrink-0">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium leading-none">Faturas a Vencer</p>
              <p className="text-xs sm:text-sm font-bold text-rose-400 tabular-nums leading-tight mt-0.5">
                {(summary.currentInvoicesDue ?? 0) > 0 ? `-${formatCurrency(summary.currentInvoicesDue ?? 0)}` : <span className="text-slate-600">—</span>}
              </p>
            </div>
          </div>

          {/* Orçado em Categorias */}
          <div className="flex items-center gap-2 flex-shrink-0" title="Total alocado em envelopes/categorias de despesa no mês (- deduz do orçamento)">
            <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium leading-none">Orçado Mês</p>
              <p className="text-xs sm:text-sm font-bold text-indigo-300 tabular-nums leading-tight mt-0.5">
                {summary.totalBudgeted > 0 ? `-${formatCurrency(summary.totalBudgeted)}` : <span className="text-slate-600">—</span>}
              </p>
            </div>
          </div>

          {/* Gastos Realizados */}
          <div className="flex items-center gap-2 flex-shrink-0" title="Total de despesas efetivamente realizadas no mês">
            <div className="w-7 h-7 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Receipt className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium leading-none">Gastos Reais</p>
              <p className="text-xs sm:text-sm font-bold text-amber-400/90 tabular-nums leading-tight mt-0.5">
                {totalSpent > 0 ? formatCurrency(totalSpent) : <span className="text-slate-600">—</span>}
              </p>
            </div>
          </div>
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
              {/* ── Seção de Despesas ── */}
              {rows && rows.length > 0 && (
                <>
                  <tr className="bg-slate-950/90 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0 backdrop-blur-sm z-10 select-none">
                    <th className="py-2 pl-3 sm:pl-6 pr-1 text-left">Despesas</th>
                    <th className="py-2 px-2 text-right">Orçado</th>
                    <th className="py-2 px-2 text-right">Gasto</th>
                    <th className="py-2 pl-2 pr-3 sm:pr-6 text-right">Disponível</th>
                  </tr>
                  {rows.map(row => (
                    <GroupRow key={row.group.id} row={row} month={month} onSelectCategory={setSelectedCategoryModal} />
                  ))}
                </>
              )}

              {/* ── Seção de Renda / Receitas ── */}
              {incomeRows && incomeRows.length > 0 && (
                <>
                  <tr className="bg-slate-950/90 text-[10px] sm:text-xs font-semibold text-emerald-400/90 uppercase tracking-wider border-t border-b border-emerald-900/40 select-none">
                    <th className="py-2 pl-3 sm:pl-6 pr-1 text-left">Receitas & Rendas</th>
                    <th colSpan={3} className="py-2 pl-2 pr-3 sm:pr-6 text-right">Recebido</th>
                  </tr>
                  {incomeRows.map(row => (
                    <IncomeGroupRow key={row.group.id} row={row} onSelectCategory={setSelectedCategoryModal} />
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
          onClose={() => setSelectedCategoryModal(null)}
        />
      )}
    </div>
  )
}
