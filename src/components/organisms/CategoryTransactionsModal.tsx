// src/components/organisms/CategoryTransactionsModal.tsx — Modal para visualizar e gerenciar transações com agrupamento de parcelas
import { useState, useMemo } from 'react'
import {
  Plus,
  Receipt,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  CreditCard,
  Layers,
} from 'lucide-react'
import { useFinancialData } from '@/context/FinancialDataContext'
import { useCategoryMonthTransactions } from '@/hooks/useTransactions'
import {
  deleteTransaction,
  deleteSplitTransaction,
  deleteInstallmentGroup,
} from '@/services/api/transactions'
import { formatCurrency, formatMonthLabel, formatDate, formatTime } from '@/utils/format'
import { useConfirm } from '@/context/ConfirmContext'
import Modal from '@/components/atoms/Modal'
import Badge from '@/components/atoms/Badge'
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

interface ConsolidatedInstallmentItem {
  kind: 'installmentGroup'
  groupId: string
  representativeTx: Transaction
  groupTxs: Transaction[]
  cleanPayee: string
  totalAmount: number
  installmentCount: number
  installmentAmount: number
  accountName: string
  categoryName?: string
  notes?: string
  date: string | Date
}

interface SingleTransactionItem {
  kind: 'single'
  tx: Transaction
  accountName: string
  categoryName?: string
}

type DisplayItem = ConsolidatedInstallmentItem | SingleTransactionItem

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
  const { accounts, installmentGroups = [], categories = [] } = useFinancialData()
  const hookTxs = useCategoryMonthTransactions(category?.id, month, regime) ?? []
  const rawTransactions = customTransactions ?? hookTxs
  const confirm = useConfirm()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id!, a])), [accounts])
  const groupMap = useMemo(
    () => new Map(installmentGroups.map(g => [g.id!, g])),
    [installmentGroups]
  )
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id!, c])), [categories])

  const toggleExpandGroup = (groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // ── Agrupamento de Transações Parceladas ───────────────────────────────────
  const consolidatedItems: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = []
    const seenGroupIds = new Set<string>()

    for (const tx of rawTransactions) {
      if (tx.installmentGroupId) {
        if (seenGroupIds.has(tx.installmentGroupId)) continue
        seenGroupIds.add(tx.installmentGroupId)

        const groupTxs = rawTransactions.filter(
          t => t.installmentGroupId === tx.installmentGroupId
        )
        const group = groupMap.get(tx.installmentGroupId)
        const cleanPayee = (group?.description || tx.payee)
          .replace(/\s*\(\d+\/\d+\)$/, '')
          .trim()

        const sortedGroupTxs = [...groupTxs].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        const earliestDate =
          group?.startDate || (sortedGroupTxs.length > 0 ? sortedGroupTxs[0].date : tx.date)

        const groupTotalAmount = groupTxs.reduce((sum, t) => sum + t.amount, 0)
        const count = group?.installmentCount || tx.installmentTotal || groupTxs.length
        const instAmount =
          group?.installmentAmount ||
          (count > 0 ? groupTotalAmount / count : tx.amount)

        const account = accountMap.get(tx.accountId)
        const categoryObj = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
        const resolvedCatName = categoryObj?.name || category?.name

        items.push({
          kind: 'installmentGroup',
          groupId: tx.installmentGroupId,
          representativeTx: sortedGroupTxs[0] || tx,
          groupTxs: sortedGroupTxs,
          cleanPayee,
          totalAmount: groupTotalAmount,
          installmentCount: count,
          installmentAmount: instAmount,
          accountName: account?.name ?? 'Conta desconhecida',
          categoryName: resolvedCatName,
          notes: group?.description || tx.notes?.replace(/\s*\(\d+\/\d+\)$/, ''),
          date: earliestDate,
        })
      } else {
        const account = accountMap.get(tx.accountId)
        const categoryObj = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
        const resolvedCatName = categoryObj?.name || category?.name

        items.push({
          kind: 'single',
          tx,
          accountName: account?.name ?? 'Conta desconhecida',
          categoryName: resolvedCatName,
        })
      }
    }

    return items
  }, [rawTransactions, groupMap, accountMap, categoryMap, category?.name])

  // Filtragem pela barra de busca
  const filteredItems = useMemo(() => {
    if (!search.trim()) return consolidatedItems
    const q = search.toLowerCase()

    return consolidatedItems.filter(item => {
      if (item.kind === 'installmentGroup') {
        return (
          item.cleanPayee.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
          item.groupTxs.some(t => t.payee.toLowerCase().includes(q))
        )
      } else {
        return (
          item.tx.payee.toLowerCase().includes(q) ||
          (item.tx.notes && item.tx.notes.toLowerCase().includes(q)) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(q))
        )
      }
    })
  }, [consolidatedItems, search])

  const totalCalculatedAmount = useMemo(() => {
    return rawTransactions.reduce((acc, t) => acc + t.amount, 0)
  }, [rawTransactions])

  const averageTicket = useMemo(() => {
    return consolidatedItems.length > 0
      ? totalCalculatedAmount / consolidatedItems.length
      : 0
  }, [consolidatedItems, totalCalculatedAmount])

  // Exclusão de transação simples ou rateio
  const handleDeleteSingle = async (tx: Transaction) => {
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
      title: 'Excluir transação?',
      message: `Deseja realmente excluir a transação "${tx.payee}"?`,
      confirmText: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return
    await deleteTransaction(tx.id)
  }

  // Exclusão de grupo de parcelas inteiro
  const handleDeleteGroup = async (item: ConsolidatedInstallmentItem) => {
    const ok = await confirm({
      title: 'Excluir compra parcelada?',
      message: `Deseja realmente excluir todas as ${item.installmentCount} parcelas de "${item.cleanPayee}" (Total: ${formatCurrency(
        item.totalAmount
      )})?`,
      confirmText: 'Excluir todas as parcelas',
      variant: 'danger',
    })
    if (!ok) return
    await deleteInstallmentGroup(item.groupId)
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

  const totalInstallmentGroupsCount = useMemo(() => {
    return consolidatedItems.filter(i => i.kind === 'installmentGroup').length
  }, [consolidatedItems])

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
            {totalInstallmentGroupsCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/50 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Parcelas Agrupadas</span>
              </span>
            )}
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
                        (available ?? 0) > 0.005
                          ? 'text-emerald-400'
                          : (available ?? 0) < -0.005
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {(available ?? 0) < -0.005 ? `-${formatCurrency(Math.abs(available ?? 0))}` : formatCurrency(available ?? 0)}
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
                    {consolidatedItems.length}
                    {rawTransactions.length !== consolidatedItems.length && (
                      <span className="text-[10px] font-normal text-slate-400 ml-1">
                        ({rawTransactions.length} txs)
                      </span>
                    )}
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
            {rawTransactions.length > 2 && (
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

          {/* Lista de Transações com Agrupamento de Parcelas */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredItems.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                <Receipt className="w-9 h-9 text-slate-700 mx-auto mb-2.5" />
                <p className="font-medium text-slate-400 text-sm">
                  {search
                    ? 'Nenhum lançamento encontrado para a busca'
                    : 'Nenhuma transação registrada'}
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
              filteredItems.map(item => {
                if (item.kind === 'installmentGroup') {
                  const isExpanded = expandedGroupIds.has(item.groupId)
                  const hasMultipleTxs = item.groupTxs.length > 1

                  return (
                    <div
                      key={`group-${item.groupId}`}
                      className="bg-slate-950/30 hover:bg-slate-800/20 transition-colors border-b border-slate-800/40"
                    >
                      {/* Linha Consolidada da Compra Parcelada */}
                      <div
                        onClick={() => {
                          setEditingTx(item.representativeTx)
                          setShowForm(true)
                        }}
                        className="flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer select-none"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-slate-100 truncate font-semibold">
                              {item.cleanPayee}
                            </p>
                            <Badge variant="violet">
                              Parcelado {item.installmentCount}x
                            </Badge>
                            {hasMultipleTxs && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-950/90 text-violet-300 border border-violet-800/50">
                                {item.groupTxs.length} parcelas agrupadas
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-slate-500">
                            <span>{formatDate(item.date)}</span>
                            <span className="text-slate-600">·</span>
                            <span>{item.categoryName || 'Sem Categoria'}</span>
                            <span className="text-slate-600">·</span>
                            <span>{item.accountName}</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-violet-400 font-medium">
                              {item.installmentCount}x de{' '}
                              {formatCurrency(item.installmentAmount)}
                            </span>
                          </div>

                          {item.notes && item.notes !== item.cleanPayee && (
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        <div
                          className="flex items-center gap-2 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="text-right">
                            <span className="text-sm font-bold tabular-nums text-rose-400 block">
                              -{formatCurrency(item.totalAmount)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium tabular-nums block">
                              {item.installmentCount}x de {formatCurrency(item.installmentAmount)}
                            </span>
                          </div>

                          {hasMultipleTxs && (
                            <button
                              type="button"
                              onClick={() => toggleExpandGroup(item.groupId)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                              title={isExpanded ? 'Ocultar parcelas individuais' : 'Ver parcelas individuais'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTx(item.representativeTx)
                              setShowForm(true)
                            }}
                            className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-950/40 transition-colors"
                            title="Editar compra parcelada"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(item)}
                            className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                            title="Excluir todas as parcelas desta compra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Lista Expandida de Parcelas Individuais (Accordion) */}
                      {isExpanded && hasMultipleTxs && (
                        <div className="bg-slate-950/60 px-4 py-2 border-t border-slate-800/60 divide-y divide-slate-800/30">
                          {item.groupTxs.map(subTx => {
                            const subTime = subTx.createdAt
                              ? formatTime(subTx.createdAt)
                              : formatTime(subTx.date)

                            return (
                              <div
                                key={subTx.id}
                                className="flex items-center justify-between py-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <CreditCard className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-200 truncate">
                                      {subTx.payee}
                                    </p>
                                    <span className="text-[10px] text-slate-500">
                                      Vencimento: {formatDate(subTx.date)}
                                      {subTime ? ` às ${subTime}` : ''}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="font-semibold text-rose-400 tabular-nums">
                                    -{formatCurrency(subTx.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingle(subTx)}
                                    className="p-1 text-slate-600 hover:text-rose-400"
                                    title="Excluir apenas esta parcela individual"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                }

                // Linha de Transação Simples
                return (
                  <TransactionItem
                    key={
                      item.tx.id ??
                      `proj-${new Date(item.tx.date).getTime()}-${item.tx.amount}`
                    }
                    tx={item.tx}
                    accountName={item.accountName}
                    categoryName={item.categoryName}
                    onEdit={
                      item.tx.id
                        ? () => {
                            setEditingTx(item.tx)
                            setShowForm(true)
                          }
                        : undefined
                    }
                    onDelete={item.tx.id ? () => handleDeleteSingle(item.tx) : () => {}}
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
