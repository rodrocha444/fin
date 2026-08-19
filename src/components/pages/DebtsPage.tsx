// src/components/pages/DebtsPage.tsx — Lista de Contatos de Cobrança
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HandCoins,
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Phone,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { useDebtAccounts, useDebtsSummary } from '@/hooks/useDebts'
import { formatCurrency } from '@/utils/format'
import DebtAccountForm from '@/components/organisms/DebtAccountForm'
import SearchBar from '@/components/atoms/SearchBar'

export default function DebtsPage() {
  const navigate = useNavigate()
  const accounts = useDebtAccounts() ?? []
  const summary = useDebtsSummary()

  const [search, setSearch] = useState('')
  const [showAccountModal, setShowAccountModal] = useState(false)

  const filteredAccounts = accounts.filter(acc => {
    if (!search) return true
    const q = search.toLowerCase()
    return acc.name.toLowerCase().includes(q) || (acc.phone || '').includes(q)
  })

  return (
    <div className="fade-in">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-6 pb-4 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-100 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-indigo-400" />
            Contas a Receber / Pagar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Controle de empréstimos, cobranças e pendências com terceiros
          </p>
        </div>

        <button
          onClick={() => setShowAccountModal(true)}
          className="btn-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Contato</span>
        </button>
      </div>

      <div className="p-3 sm:p-6 space-y-4 max-w-3xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card !p-3 sm:!p-4 bg-emerald-950/20 border-emerald-900/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-emerald-400/90 uppercase tracking-wider">A Receber</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-base sm:text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {formatCurrency(summary?.totalReceivable ?? 0)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total pendente de terceiros</p>
          </div>

          <div className="card !p-3 sm:!p-4 bg-rose-950/20 border-rose-900/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-rose-400/90 uppercase tracking-wider">A Pagar</span>
              <ArrowUpRight className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-base sm:text-2xl font-bold text-rose-400 mt-1 tabular-nums">
              {formatCurrency(summary?.totalPayable ?? 0)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total a reembolsar a outros</p>
          </div>

          <div className="card !p-3 sm:!p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Saldo Líquido</span>
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <p className={`text-base sm:text-2xl font-bold mt-1 tabular-nums ${
              (summary?.netBalance ?? 0) > 0 ? 'text-emerald-400'
              : (summary?.netBalance ?? 0) < 0 ? 'text-rose-400'
              : 'text-slate-100'
            }`}>
              {(summary?.netBalance ?? 0) > 0 ? '+' : ''}
              {formatCurrency(summary?.netBalance ?? 0)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Diferença geral pendente</p>
          </div>

          <div className="card !p-3 sm:!p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Contatos Ativos</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-base sm:text-2xl font-bold text-slate-100 mt-1 tabular-nums">{accounts.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{summary?.pendingCount ?? 0} itens em aberto</p>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="card text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <HandCoins className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Nenhum contato ou devedor cadastrado</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Crie contatos para controlar valores que você emprestou, compras parceladas que fez para amigos ou valores que você precisa reembolsar.
            </p>
            <button
              onClick={() => setShowAccountModal(true)}
              className="btn-primary text-xs px-4 py-2.5 mx-auto inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar primeiro contato</span>
            </button>
          </div>
        ) : (
          <>
            {/* Busca */}
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar contato…"
            />

            {/* Lista de Contatos */}
            <div className="space-y-2">
              {filteredAccounts.map(acc => (
                <div
                  key={acc.id}
                  onClick={() => navigate(`/debts/${acc.id}`)}
                  className="card !p-3 sm:!p-4 cursor-pointer hover:bg-slate-800/60 hover:border-slate-700 active:scale-[0.99] transition-all duration-150"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                        style={{
                          backgroundColor: (acc.color || '#6366f1') + '25',
                          color: acc.color || '#6366f1',
                        }}
                      >
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-100 truncate">{acc.name}</p>
                        {acc.phone && (
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span>{acc.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-bold tabular-nums ${
                          acc.balance > 0 ? 'text-emerald-400'
                          : acc.balance < 0 ? 'text-rose-400'
                          : 'text-slate-400'
                        }`}>
                          {acc.balance > 0 ? '+' : ''}{formatCurrency(acc.balance)}
                        </p>
                        <span className="text-[10px] text-slate-500">
                          {acc.pendingCount} {acc.pendingCount === 1 ? 'pendência' : 'pendências'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAccountModal && (
        <DebtAccountForm
          onClose={() => setShowAccountModal(false)}
          onSuccess={newId => {
            setShowAccountModal(false)
            if (newId) navigate(`/debts/${newId}`)
          }}
        />
      )}
    </div>
  )
}
