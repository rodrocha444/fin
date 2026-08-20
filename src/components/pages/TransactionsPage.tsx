import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { useAccounts } from '@/hooks/useAccounts'
import { useMonthTransactions } from '@/hooks/useTransactions'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { deleteTransaction } from '@/db/repositories/transactions'
import { formatCurrency, currentMonth } from '@/utils/format'
import MonthNavigator from '@/components/atoms/MonthNavigator'
import SearchBar from '@/components/atoms/SearchBar'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import TransactionItem from '@/components/molecules/TransactionItem'
import TransactionForm from '@/components/organisms/TransactionForm'
import PendingIssuesCard from '@/components/organisms/PendingIssuesCard'
import type { Transaction } from '@/types'

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState(currentMonth)
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const selectedAccountId = searchParams.get('account') || undefined
  const editTxId = searchParams.get('edit')

  useEffect(() => {
    if (editTxId) {
      db.transactions.get(editTxId).then(tx => {
        if (tx) {
          const txMonth = format(new Date(tx.date), 'yyyy-MM')
          setMonth(txMonth)
          setEditingTx(tx)
        }
      })
    }
  }, [editTxId])

  const handleCloseEdit = () => {
    setEditingTx(null)
    if (searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }

  const accounts = useAccounts()
  const transactions = useMonthTransactions(month)
  const installmentGroups = useLiveQuery(() => db.installmentGroups.toArray(), [])
  const { categories } = useCategoriesWithGroups() ?? {}

  const accountMap = new Map(accounts?.map(a => [a.id!, a]) ?? [])
  const categoryMap = new Map(categories?.map(c => [c.id!, c]) ?? [])
  const groupMap = new Map(installmentGroups?.map(g => [g.id!, g]) ?? [])

  const sorted = [...(transactions ?? [])]
    .filter(tx => {
      if (selectedAccountId && tx.accountId !== selectedAccountId && tx.transferAccountId !== selectedAccountId) {
        return false
      }
      if (!search) return true
      const q = search.toLowerCase()
      return tx.payee.toLowerCase().includes(q) || (tx.notes ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
      const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
      if (timeB !== timeA) return timeB - timeA
      return (b.id ?? '').localeCompare(a.id ?? '')
    })

  const handleDelete = async (tx: Transaction) => {
    if (!tx.id) return
    if (!confirm(tx.installmentGroupId ? 'Excluir esta parcela?' : 'Excluir esta transação?')) return
    await deleteTransaction(tx.id)
  }

  const income = sorted.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = sorted.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div
        className="flex-shrink-0 border-b border-slate-800 bg-slate-900 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center gap-2 px-3 sm:px-6">
          {/* Mês (Atom) */}
          <MonthNavigator month={month} onChangeMonth={setMonth} />

          <div className="flex-1" />

          {/* Status de sync no mobile */}
          <div className="lg:hidden">
            <SyncStatusBadge compact={true} />
          </div>

          {/* Busca toggle */}
          <button
            onClick={() => setShowSearch(s => !s)}
            className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Nova transação */}
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-1.5 py-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Nova</span>
          </button>
        </div>

        {/* Seletor de conta */}
        <div className="px-3 sm:px-6 pt-2.5">
          <select
            className="w-full sm:w-auto min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
            value={selectedAccountId ?? ''}
            onChange={e => {
              if (e.target.value) setSearchParams({ account: e.target.value })
              else setSearchParams({})
            }}
          >
            <option value="">Todas as contas</option>
            {accounts?.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>

        {/* Campo de busca expansível */}
        {showSearch && (
          <div className="px-3 sm:px-6 pt-2.5">
            <SearchBar
              autoFocus
              value={search}
              onChange={setSearch}
              placeholder="Buscar por favorecido ou nota…"
            />
          </div>
        )}

        {/* Totais rápidos */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 sm:px-6 pt-2.5 text-xs">
          <span className="text-slate-500">
            Renda: <span className="text-emerald-400 font-medium tabular-nums">{formatCurrency(income)}</span>
          </span>
          <span className="text-slate-500">
            Despesas: <span className="text-rose-400 font-medium tabular-nums">{formatCurrency(expense)}</span>
          </span>
          <span className="text-slate-600">{sorted.length} lançamentos</span>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {/* Banner de inconsistências / pendências */}
        <div className="px-3 sm:px-6 pt-3">
          <PendingIssuesCard />
        </div>

        {!transactions ? (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Carregando…</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-slate-500 text-sm">
              {search ? 'Nenhuma transação encontrada' : 'Nenhuma transação neste mês'}
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-xs">
              Lançar transação
            </button>
          </div>
        ) : (
          <div>
            {sorted.map(tx => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                accountName={accountMap.get(tx.accountId)?.name ?? '—'}
                transferAccountName={tx.transferAccountId ? accountMap.get(tx.transferAccountId)?.name : undefined}
                currentAccountId={selectedAccountId}
                categoryName={tx.categoryId ? categoryMap.get(tx.categoryId)?.name : undefined}
                installmentGroup={tx.installmentGroupId ? groupMap.get(tx.installmentGroupId) : undefined}
                onEdit={() => setEditingTx(tx)}
                onDelete={() => handleDelete(tx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB para adicionar (mobile extra) */}
      <button
        onClick={() => setShowForm(true)}
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-900/50 active:scale-95 transition-all z-30"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
      {editingTx && <TransactionForm transaction={editingTx} onClose={handleCloseEdit} />}
    </div>
  )
}
