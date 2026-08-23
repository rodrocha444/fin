// src/components/organisms/CategoryTransactionsModal.tsx — Modal para visualizar e gerenciar transações de categorias ou meses
import { useState, useMemo } from 'react'
import { Plus, Receipt, Search } from 'lucide-react'
import { useFinancialData } from '@/context/FinancialDataContext'
import { useCategoryMonthTransactions } from '@/hooks/useTransactions'
import { deleteTransaction, deleteSplitTransaction } from '@/services/api/transactions'
import { formatCurrency, formatMonthLabel } from '@/utils/format'
import { useConfirm } from '@/context/ConfirmContext'
import Modal from '@/components/atoms/Modal'
import TransactionItem from '@/components/molecules/TransactionItem'
import TransactionForm from '@/components/organisms/TransactionForm'
import type { Category, Transaction } from '@/types'
import type { AccountingRegime } from '@/utils/accountingRegime'

export interface CategoryTransactionsModalProps {
  category?: Category | { id?: string; name: string }
  month: string
  budgeted?: number
  activity?: number
  available?: number
  isIncome?: boolean
  customTransactions?: Transaction[]
  customTitle?: string
  customDescription?: string
  regime?: AccountingRegime
  onClose: () => void
}

export default function CategoryTransactionsModal({
  category,
  month,
  budgeted,
  activity,
  available,
  isIncome = false,
  customTransactions,
  customTitle,
  customDescription,
  regime,
  onClose,
}: CategoryTransactionsModalProps) {
  const { accounts, installmentGroups, categories = [] } = useFinancialData()
  const hookTxs = useCategoryMonthTransactions(category?.id, month) ?? []
  const rawTransactions = customTransactions ?? hookTxs
  const confirm = useConfirm()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id!, a])), [accounts])
  const groupMap = useMemo(
    () => new Map(installmentGroups?.map(g => [g.id!, g]) ?? []),
    [installmentGroups]
  )
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id!, c])), [categories])

  const filteredTransactions = useMemo(() => {
    if (!search.trim()) return rawTransactions
    const q = search.toLowerCase()
    return rawTransactions.filter(
      t =>
        t.payee.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.categoryId && categoryMap.get(t.categoryId)?.name.toLowerCase().includes(q))
    )
  }, [rawTransactions, search, categoryMap])

  const totalCalculatedAmount = useMemo(() => {
    return rawTransactions.reduce((acc, t) => acc + t.amount, 0)
  }, [rawTransactions])

  const averageTicket = useMemo(() => {
    return rawTransactions.length > 0 ? totalCalculatedAmount / rawTransactions.length : 0
  }, [rawTransactions, totalCalculatedAmount])

  const handleDelete = async (tx: Transaction) => {
    if (tx.splitGroupId) {
      const ok = await confirm({
        title: 'Excluir transação dividida?',
        message: `Esta transação faz parte de uma divisão de categorias (${tx.payee}). Deseja excluir todas as partes deste rateio?`,
        confirmText: 'Excluir todas',
        variant: 'danger',
      })
      if (!ok) return
      await deleteSplitTransaction(tx.splitGroupId)
      return
    }
    if (!tx.id) return
    const ok = await confirm({
      title: tx.installmentGroupId ? 'Excluir parcela?' : 'Excluir transação?',
      message: `Deseja realmente excluir a transação "${tx.payee}"?`,
      confirmText: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return
    await deleteTransaction(tx.id)
  }

  const monthLabel = formatMonthLabel(month)
  const isBudgetView = budgeted !== undefined || available !== undefined

  const titleText = customTitle || category?.name || 'Extrato de Lançamentos'
  const descriptionText =
    customDescription ||
    (regime
      ? `Transações em ${monthLabel} · ${
          regime === 'accrual' ? 'Regime de Competência' : 'Regime de Caixa'
        }`
      : `Transações em ${monthLabel}`)

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        size="2xl"
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-slate-100 text-base sm:text-lg">
              {titleText}
            </h2>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isIncome
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
              }`}
            >
              {isIncome ? 'Receitas' : 'Despesas'}
            </span>
          </div>
        }
        description={descriptionText}
        headerRight={
          <button
            onClick={() => {
              setEditingTx(null)
              setShowForm(true)
            }}
            className="btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 mr-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Novo Lançamento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        }
      >
        <div className="flex flex-col h-full">
          {/* Resumo Financeiro no Topo do Modal */}
          <div className="p-4 sm:p-5 border-b border-slate-800/60 flex-shrink-0 space-y-3">
            {isBudgetView ? (
              <div
                className={`grid ${
                  isIncome ? 'grid-cols-1' : 'grid-cols-3'
                } gap-2 sm:gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80`}
              >
                {!isIncome && (
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Orçado</p>
                    <p className="text-xs sm:text-base font-bold text-slate-200 tabular-nums">
                      {formatCurrency(budgeted ?? 0)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {isIncome ? 'Total Recebido no Mês' : 'Gasto / Atividade'}
                  </p>
                  <p
                    className={`text-xs sm:text-base font-bold tabular-nums ${
                      isIncome
                        ? 'text-emerald-400'
                        : (activity ?? 0) > 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {isIncome
                      ? `+${formatCurrency(activity ?? totalCalculatedAmount)}`
                      : formatCurrency(activity ?? totalCalculatedAmount)}
                  </p>
                </div>
                {!isIncome && (
                  <div>
                    <p className="text-[10px] text-slate-500 font-medium">Disponível</p>
                    <p
                      className={`text-xs sm:text-base font-bold tabular-nums ${
                        (available ?? 0) > 0
                          ? 'text-emerald-400'
                          : (available ?? 0) < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(Math.abs(available ?? 0))}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Total do Período</p>
                  <p
                    className={`text-xs sm:text-base font-bold tabular-nums ${
                      isIncome ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isIncome
                      ? `+${formatCurrency(totalCalculatedAmount)}`
                      : formatCurrency(totalCalculatedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Lançamentos</p>
                  <p className="text-xs sm:text-base font-bold text-slate-200 tabular-nums">
                    {rawTransactions.length}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Ticket Médio</p>
                  <p className="text-xs sm:text-base font-bold text-slate-200 tabular-nums">
                    {formatCurrency(averageTicket)}
                  </p>
                </div>
              </div>
            )}

            {/* Busca Rápida se houver múltiplas transações */}
            {rawTransactions.length > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por favorecido, notas ou categoria..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Lista de Transações */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredTransactions.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                <Receipt className="w-9 h-9 text-slate-700 mx-auto mb-2.5" />
                <p className="font-medium text-slate-400 text-sm">
                  {search ? 'Nenhum lançamento encontrado para a busca' : 'Nenhuma transação registrada'}
                </p>
                <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                  {search
                    ? 'Tente ajustar o termo digitado no filtro.'
                    : `Não há lançamentos registrados para esta seleção em ${monthLabel}.`}
                </p>
                <button
                  onClick={() => {
                    setEditingTx(null)
                    setShowForm(true)
                  }}
                  className="mt-4 btn-secondary py-2 px-3 text-xs mx-auto inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar transação</span>
                </button>
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const account = accountMap.get(tx.accountId)
                const group = tx.installmentGroupId ? groupMap.get(tx.installmentGroupId) : undefined
                const categoryObj = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
                const resolvedCatName = categoryObj?.name || category?.name

                return (
                  <TransactionItem
                    key={tx.id ?? `proj-${new Date(tx.date).getTime()}-${tx.amount}`}
                    tx={tx}
                    accountName={account?.name ?? 'Conta desconhecida'}
                    categoryName={resolvedCatName}
                    installmentGroup={
                      group
                        ? {
                            totalAmount: group.totalAmount,
                            installmentCount: group.installmentCount,
                            installmentAmount: group.installmentAmount,
                          }
                        : undefined
                    }
                    onEdit={
                      tx.id
                        ? () => {
                            setEditingTx(tx)
                            setShowForm(true)
                          }
                        : undefined
                    }
                    onDelete={tx.id ? () => handleDelete(tx) : () => {}}
                  />
                )
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Form modal */}
      {showForm && (
        <TransactionForm
          transaction={editingTx ?? undefined}
          defaultCategoryId={category?.id}
          defaultMode={isIncome ? 'income' : 'expense'}
          onClose={() => {
            setShowForm(false)
            setEditingTx(null)
          }}
        />
      )}
    </>
  )
}
