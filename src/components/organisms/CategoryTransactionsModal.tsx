// src/components/organisms/CategoryTransactionsModal.tsx — Modal para visualizar e gerenciar transações da categoria no mês
import { useState } from 'react'
import { Plus, Receipt } from 'lucide-react'
import { useFinancialData } from '@/context/FinancialDataContext'
import { useCategoryMonthTransactions } from '@/hooks/useTransactions'
import { deleteTransaction, deleteSplitTransaction } from '@/services/api/transactions'
import { formatCurrency, formatMonthLabel } from '@/utils/format'
import { useConfirm } from '@/context/ConfirmContext'
import Modal from '@/components/atoms/Modal'
import TransactionItem from '@/components/molecules/TransactionItem'
import TransactionForm from '@/components/organisms/TransactionForm'
import type { Category, Transaction } from '@/types'

interface CategoryTransactionsModalProps {
  category: Category
  month: string
  budgeted?: number
  activity?: number
  available?: number
  isIncome?: boolean
  onClose: () => void
}

export default function CategoryTransactionsModal({
  category,
  month,
  budgeted = 0,
  activity = 0,
  available = 0,
  isIncome = false,
  onClose,
}: CategoryTransactionsModalProps) {
  const { accounts, installmentGroups } = useFinancialData()
  const transactions = useCategoryMonthTransactions(category.id, month) ?? []
  const confirm = useConfirm()

  const accountMap = new Map(accounts.map(a => [a.id!, a]))
  const groupMap = new Map(installmentGroups?.map(g => [g.id!, g]) ?? [])

  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

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

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        size="2xl"
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-slate-100 text-base sm:text-lg">
              {category.name}
            </h2>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isIncome
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                  : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50'
              }`}
            >
              {isIncome ? 'Renda' : 'Despesa'}
            </span>
          </div>
        }
        description={`Transações em ${monthLabel}`}
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
          {/* Resumo Financeiro da Categoria no Mês */}
          <div className="p-4 sm:p-5 border-b border-slate-800/60 flex-shrink-0">
            <div
              className={`grid ${
                isIncome ? 'grid-cols-1' : 'grid-cols-3'
              } gap-2 sm:gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80`}
            >
              {!isIncome && (
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Orçado</p>
                  <p className="text-xs sm:text-base font-bold text-slate-200 tabular-nums">
                    {formatCurrency(budgeted)}
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
                      : activity > 0
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {isIncome ? `+${formatCurrency(activity)}` : formatCurrency(activity)}
                </p>
              </div>
              {!isIncome && (
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">Disponível</p>
                  <p
                    className={`text-xs sm:text-base font-bold tabular-nums ${
                      available > 0
                        ? 'text-emerald-400'
                        : available < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatCurrency(Math.abs(available))}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lista de Transações */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {transactions.length === 0 ? (
              <div className="py-16 px-4 text-center text-slate-500 text-xs">
                <Receipt className="w-9 h-9 text-slate-700 mx-auto mb-2.5" />
                <p className="font-medium text-slate-400 text-sm">Nenhuma transação nesta categoria</p>
                <p className="text-slate-500 mt-1 max-w-xs mx-auto">
                  Não há lançamentos ou parcelas registradas para {category.name} em {monthLabel}.
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
              transactions.map(tx => {
                const account = accountMap.get(tx.accountId)
                const group = tx.installmentGroupId ? groupMap.get(tx.installmentGroupId) : undefined

                return (
                  <TransactionItem
                    key={tx.id ?? `proj-${tx.date.getTime()}-${tx.amount}`}
                    tx={tx}
                    accountName={account?.name ?? 'Conta desconhecida'}
                    categoryName={category.name}
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
          defaultCategoryId={category.id}
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
