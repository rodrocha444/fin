import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CreditCard, PiggyBank, Landmark, Pencil, Trash2 } from 'lucide-react'
import { useAccounts, useAllBalances } from '@/hooks/useAccounts'
import { deleteAccount } from '@/db/repositories/accounts'
import { formatCurrency, accountTypeLabel } from '@/utils/format'
import AccountForm from '@/components/organisms/AccountForm'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import type { Account } from '@/types'

function accountIcon(type: string) {
  if (type === 'credit_card') return <CreditCard className="w-5 h-5" />
  if (type === 'savings') return <PiggyBank className="w-5 h-5" />
  return <Landmark className="w-5 h-5" />
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const accounts = useAccounts()
  const balances = useAllBalances()
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | undefined>()

  const handleDelete = async (acc: Account) => {
    if (!acc.id) return
    if (!confirm(`Excluir a conta "${acc.name}"?`)) return
    try {
      await deleteAccount(acc.id)
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir conta.')
    }
  }

  const handleEdit = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation()
    setEditingAccount(acc)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingAccount(undefined) }

  const netWorth = balances
    ? Array.from(balances.values()).reduce((s, v) => s + v, 0)
    : 0

  return (
    <div className="fade-in">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-100">Contas</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Patrimônio:{' '}
            <span className={netWorth >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {formatCurrency(netWorth)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            <SyncStatusBadge compact={true} />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova conta</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">

      {/* Lista de contas */}
      {!accounts ? (
        <p className="text-slate-600 text-sm">Carregando…</p>
      ) : accounts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 gap-3">
          <Landmark className="w-10 h-10 text-slate-700" />
          <p className="text-slate-500 text-sm">Nenhuma conta cadastrada</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs">
            Criar primeira conta
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {(['checking', 'savings', 'credit_card'] as const).map(type => {
            const typed = accounts.filter(a => a.type === type)
            if (typed.length === 0) return null
            return (
              <div key={type}>
                <h2 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {accountTypeLabel(type)}
                </h2>
                <div className="space-y-2">
                  {typed.map(acc => {
                    const balance = balances?.get(acc.id!) ?? 0
                    const isNeg = balance < 0
                    return (
                      <div
                        key={acc.id}
                        onClick={() => navigate(`/accounts/${acc.id}`)}
                        className="card cursor-pointer hover:border-slate-600 transition-all active:scale-[0.99] select-none"
                        style={{
                          background: `linear-gradient(135deg, ${acc.color}10 0%, transparent 60%)`,
                          borderColor: acc.color + '30',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Ícone */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: acc.color + '25' }}
                          >
                            <span style={{ color: acc.color }}>{accountIcon(acc.type)}</span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-100 text-sm truncate">{acc.name}</p>
                            {acc.type === 'credit_card' && acc.creditLimit ? (
                              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                                Limite: {formatCurrency(acc.creditLimit)}
                                {acc.statementClosingDay && ` · Fecha d.${acc.statementClosingDay}`}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-500">Toque para ver histórico</p>
                            )}
                          </div>

                          {/* Saldo + ações */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className={`text-sm sm:text-base font-bold tabular-nums ${isNeg ? 'text-rose-400' : 'text-slate-100'}`}>
                                {formatCurrency(balance)}
                              </p>
                              {acc.type === 'credit_card' && acc.creditLimit && (
                                <p className="text-[10px] text-slate-500 hidden sm:block">
                                  Disp: {formatCurrency(acc.creditLimit + balance)}
                                </p>
                              )}
                            </div>
                            {/* Ações */}
                            <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => { setEditingAccount(acc); setShowForm(true) }}
                                className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
                                title="Editar conta"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(acc)}
                                className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 active:bg-rose-900/30 transition-colors"
                                title="Excluir conta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de formulário */}
      {showForm && <AccountForm account={editingAccount} onClose={closeForm} />}
      </div>
    </div>
  )
}
