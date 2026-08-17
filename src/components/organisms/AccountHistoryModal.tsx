// src/components/organisms/AccountHistoryModal.tsx
import { useState } from 'react'
import { X, Plus, Trash2, Pencil, ArrowLeftRight, CreditCard, Landmark, PiggyBank, Search } from 'lucide-react'
import { useAccountTransactions } from '@/hooks/useTransactions'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { deleteTransaction } from '@/db/repositories/transactions'
import { formatCurrency, formatDate, accountTypeLabel } from '@/utils/format'
import TransactionForm from '@/components/organisms/TransactionForm'
import type { Account, Transaction } from '@/types'

function accountIcon(type: string) {
  if (type === 'credit_card') return <CreditCard className="w-5 h-5" />
  if (type === 'savings') return <PiggyBank className="w-5 h-5" />
  return <Landmark className="w-5 h-5" />
}

interface Props {
  account: Account
  balance: number
  onClose: () => void
}

export default function AccountHistoryModal({ account, balance, onClose }: Props) {
  const transactions = useAccountTransactions(account.id)
  const { categories } = useCategoriesWithGroups() ?? {}
  const categoryMap = new Map(categories?.map(c => [c.id!, c]) ?? [])

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const isNeg = balance < 0

  const filtered = [...(transactions ?? [])]
    .filter(tx => {
      if (!search) return true
      const q = search.toLowerCase()
      return tx.payee.toLowerCase().includes(q) || (tx.notes ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
      const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
      if (timeB !== timeA) return timeB - timeA
      return (b.id ?? 0) - (a.id ?? 0)
    })

  const handleDelete = async (tx: Transaction) => {
    if (!tx.id) return
    if (!confirm(tx.installmentGroupId ? 'Excluir esta parcela?' : 'Excluir esta transação?')) return
    await deleteTransaction(tx.id)
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl shadow-2xl sheet-up sm:fade-in max-h-[92dvh] flex flex-col">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Header da conta */}
        <div className="px-5 py-4 border-b border-slate-800 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: account.color + '25' }}
            >
              <span style={{ color: account.color }}>{accountIcon(account.type)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-100 text-base sm:text-lg">{account.name}</h2>
                <span className="badge bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                  {accountTypeLabel(account.type)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Saldo:{' '}
                <span className={`font-bold tabular-nums ${isNeg ? 'text-rose-400' : 'text-slate-100'}`}>
                  {formatCurrency(balance)}
                </span>
                {account.type === 'credit_card' && account.creditLimit && (
                  <span className="text-slate-500 ml-2">
                    (Limite: {formatCurrency(account.creditLimit)})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de busca + nova transação */}
        <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input-base pl-9 py-2 text-xs h-9"
              placeholder="Buscar no histórico desta conta…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova
          </button>
        </div>

        {/* Lista de transações */}
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {!transactions ? (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500 text-xs px-4 text-center">
              <ArrowLeftRight className="w-8 h-8 text-slate-700 mb-1" />
              <p>{search ? 'Nenhuma transação encontrada' : 'Nenhuma transação registrada nesta conta'}</p>
              <button onClick={() => setShowForm(true)} className="btn-secondary text-xs mt-1">
                Lançar transação
              </button>
            </div>
          ) : (
            <div>
              {filtered.map(tx => {
                const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
                const amtColor = tx.type === 'income' ? 'text-emerald-400' : tx.type === 'transfer' ? 'text-sky-400' : 'text-rose-400'
                const prefix = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''

                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200 truncate">{tx.payee}</p>
                        {tx.installmentGroupId && (
                          <span className="badge bg-violet-900/40 text-violet-300 text-[10px]">
                            {tx.installmentNumber}/{tx.installmentTotal}x
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>{formatDate(tx.date)}</span>
                        <span>·</span>
                        <span className="truncate">
                          {tx.type === 'transfer' ? 'Transferência' : cat?.name ?? 'Sem categoria'}
                        </span>
                      </div>
                      {tx.notes && <p className="text-[10px] text-slate-600 truncate mt-0.5">{tx.notes}</p>}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-semibold tabular-nums ${amtColor}`}>
                        {prefix}{formatCurrency(tx.amount)}
                      </span>
                      <button
                        onClick={() => setEditingTx(tx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-950/40 active:bg-indigo-950/60 transition-colors"
                        title="Editar transação"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tx)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-900/20 active:bg-rose-900/30 transition-colors"
                        title="Excluir transação"
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

        {showForm && (
          <TransactionForm defaultAccountId={account.id} onClose={() => setShowForm(false)} />
        )}

        {editingTx && (
          <TransactionForm transaction={editingTx} onClose={() => setEditingTx(null)} />
        )}
      </div>
    </div>
  )
}
