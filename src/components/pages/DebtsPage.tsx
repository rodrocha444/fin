// src/components/pages/DebtsPage.tsx — Página de Contas a Receber / Pagar (Cobranças e Pendências)
import { useState } from 'react'
import {
  HandCoins,
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  User,
  Users,
  Phone,
  Calendar,
  AlertCircle,
  Undo2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import {
  useDebtAccounts,
  useDebtAccountWithItems,
  useDebtsSummary,
  type DebtAccountWithStats,
} from '@/hooks/useDebts'
import {
  deleteDebtAccount,
  deleteDebtItem,
  setDebtItemStatus,
} from '@/db/repositories/debts'
import { formatCurrency, formatDate } from '@/utils/format'
import DebtAccountForm from '@/components/organisms/DebtAccountForm'
import DebtItemForm from '@/components/organisms/DebtItemForm'
import DebtPrintModal from '@/components/organisms/DebtPrintModal'
import type { DebtAccount, DebtItem } from '@/types'

export default function DebtsPage() {
  const accounts = useDebtAccounts() ?? []
  const summary = useDebtsSummary()

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(() => {
    return accounts.length > 0 && accounts[0].id ? accounts[0].id : null
  })

  // Se nada selecionado mas temos contas, seleciona a primeira
  const activeAccountId = selectedAccountId ?? (accounts.length > 0 ? accounts[0].id ?? null : null)
  const selectedAccountData = useDebtAccountWithItems(activeAccountId ?? undefined)

  const [search, setSearch] = useState('')
  const [itemFilter, setItemFilter] = useState<'all' | 'pending' | 'settled'>('pending')

  // Modais
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<DebtAccount | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<DebtItem | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Filtragem de contas por busca
  const filteredAccounts = accounts.filter(acc => {
    if (!search) return true
    const q = search.toLowerCase()
    return acc.name.toLowerCase().includes(q) || (acc.phone || '').includes(q)
  })

  // Filtragem de itens da conta selecionada
  const filteredItems = (selectedAccountData?.items ?? []).filter(item => {
    if (itemFilter === 'pending') return item.status === 'pending'
    if (itemFilter === 'settled') return item.status === 'settled'
    return true
  })

  const handleDeleteAccount = async (acc: DebtAccount) => {
    if (!acc.id) return
    if (!confirm(`Excluir o contato "${acc.name}" e todas as suas pendências associadas?`)) return
    await deleteDebtAccount(acc.id)
    if (activeAccountId === acc.id) {
      setSelectedAccountId(null)
    }
  }

  const handleDeleteItem = async (item: DebtItem) => {
    if (!item.id) return
    if (!confirm(`Excluir a pendência "${item.description}"?`)) return
    await deleteDebtItem(item.id)
  }

  const handleToggleItemStatus = async (item: DebtItem) => {
    if (!item.id) return
    const nextStatus = item.status === 'pending' ? 'settled' : 'pending'
    await setDebtItemStatus(item.id, nextStatus)
  }

  const today = new Date()

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
          onClick={() => {
            setEditingAccount(null)
            setShowAccountModal(true)
          }}
          className="btn-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Contato</span>
        </button>
      </div>

      <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
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
              (summary?.netBalance ?? 0) > 0
                ? 'text-emerald-400'
                : (summary?.netBalance ?? 0) < 0
                ? 'text-rose-400'
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
            <p className="text-base sm:text-2xl font-bold text-slate-100 mt-1 tabular-nums">
              {accounts.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{summary?.pendingCount ?? 0} itens em aberto</p>
          </div>
        </div>

        {/* Layout Principal: Lista de Contatos (Esquerda) + Detalhes e Itens (Direita) */}
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
              onClick={() => {
                setEditingAccount(null)
                setShowAccountModal(true)
              }}
              className="btn-primary text-xs px-4 py-2.5 mx-auto inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Criar primeiro contato</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

            {/* Coluna da Esquerda: Contatos (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              {/* Barra de Busca de Contatos */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar contato…"
                  className="input-base pl-9 py-2 text-xs min-h-[38px] h-[38px]"
                />
              </div>

              {/* Lista de Contatos */}
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {filteredAccounts.map(acc => {
                  const isSelected = activeAccountId === acc.id
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id!)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-slate-800 border-indigo-500/60 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
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
                                <Phone className="w-3 h-3" />
                                <span>{acc.phone}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs sm:text-sm font-bold tabular-nums ${
                            acc.balance > 0
                              ? 'text-emerald-400'
                              : acc.balance < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}>
                            {acc.balance > 0 ? '+' : ''}{formatCurrency(acc.balance)}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {acc.pendingCount} {acc.pendingCount === 1 ? 'pendência' : 'pendências'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Coluna da Direita: Detalhes e Itens do Contato Selecionado (8 cols) */}
            <div className="lg:col-span-8">
              {selectedAccountData ? (
                <div className="card space-y-5">
                  {/* Cabeçalho do Contato Selecionado */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-base shadow-sm"
                        style={{
                          backgroundColor: (selectedAccountData.account.color || '#6366f1') + '30',
                          color: selectedAccountData.account.color || '#6366f1',
                        }}
                      >
                        {selectedAccountData.account.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-100">
                          {selectedAccountData.account.name}
                        </h2>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-0.5">
                          {selectedAccountData.account.phone && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Phone className="w-3.5 h-3.5" />
                              {selectedAccountData.account.phone}
                            </span>
                          )}
                          {selectedAccountData.account.notes && (
                            <>
                              <span>·</span>
                              <span className="text-slate-500 truncate max-w-xs">{selectedAccountData.account.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação do Contato */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        onClick={() => setShowPrintModal(true)}
                        className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 hover:text-indigo-300"
                        title="Imprimir extrato em PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF / Imprimir</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingAccount(selectedAccountData.account)
                          setShowAccountModal(true)
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
                        title="Editar contato"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteAccount(selectedAccountData.account)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 active:bg-rose-950/50 transition-colors"
                        title="Excluir contato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Resumo do Contato */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">A Receber</p>
                      <p className="text-xs sm:text-base font-bold text-emerald-400 tabular-nums">
                        {formatCurrency(selectedAccountData.receivable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">A Pagar</p>
                      <p className="text-xs sm:text-base font-bold text-rose-400 tabular-nums">
                        {formatCurrency(selectedAccountData.payable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Saldo Líquido</p>
                      <p className={`text-xs sm:text-base font-bold tabular-nums ${
                        selectedAccountData.balance > 0
                          ? 'text-emerald-400'
                          : selectedAccountData.balance < 0
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}>
                        {selectedAccountData.balance > 0 ? '+' : ''}{formatCurrency(selectedAccountData.balance)}
                      </p>
                    </div>
                  </div>

                  {/* Barra de Filtros e Nova Pendência */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    {/* Filtro por status */}
                    <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 self-start sm:self-auto">
                      {(
                        [
                          { key: 'pending', label: 'Pendentes' },
                          { key: 'settled', label: 'Quitadas' },
                          { key: 'all', label: 'Todas' },
                        ] as const
                      ).map(f => (
                        <button
                          key={f.key}
                          onClick={() => setItemFilter(f.key)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            itemFilter === f.key
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setEditingItem(null)
                        setShowItemModal(true)
                      }}
                      className="btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 self-stretch sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Pendência</span>
                    </button>
                  </div>

                  {/* Lista de Itens / Pendências */}
                  <div className="space-y-2 divide-y divide-slate-800/40">
                    {filteredItems.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p>Nenhuma pendência encontrada neste filtro.</p>
                      </div>
                    ) : (
                      filteredItems.map(item => {
                        const isSettled = item.status === 'settled'
                        const isOverdue =
                          !isSettled && item.dueDate && new Date(item.dueDate) < today

                        return (
                          <div
                            key={item.id}
                            className={`pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-800/20 p-2.5 rounded-xl transition-colors ${
                              isSettled ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* Botão de Quitar / Desfazer */}
                              <button
                                onClick={() => handleToggleItemStatus(item)}
                                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 mt-0.5 ${
                                  isSettled
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                    : 'bg-slate-800 text-slate-500 hover:text-emerald-400 hover:bg-slate-700'
                                }`}
                                title={isSettled ? 'Marcar como pendente' : 'Marcar como quitado/pago'}
                              >
                                {isSettled ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`font-semibold text-sm text-slate-200 truncate ${isSettled ? 'line-through text-slate-400' : ''}`}>
                                    {item.description}
                                  </p>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    item.type === 'receivable'
                                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                      : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                                  }`}>
                                    {item.type === 'receivable' ? 'A Receber' : 'A Pagar'}
                                  </span>

                                  {isSettled && (
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                                      Quitado {item.settledDate ? `em ${formatDate(item.settledDate)}` : ''}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 mt-1">
                                  <span>Criado em {formatDate(item.createdAt)}</span>
                                  {item.dueDate && (
                                    <>
                                      <span>·</span>
                                      <span className={`flex items-center gap-1 ${
                                        isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-400'
                                      }`}>
                                        <Calendar className="w-3 h-3" />
                                        Prazo: {formatDate(item.dueDate)} {isOverdue && '(Vencido)'}
                                      </span>
                                    </>
                                  )}
                                  {item.notes && (
                                    <>
                                      <span>·</span>
                                      <span className="text-slate-400 italic truncate max-w-xs">{item.notes}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Valor e Ações */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                              <div className="text-left sm:text-right">
                                <p className={`text-sm sm:text-base font-bold tabular-nums ${
                                  item.type === 'receivable' ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  {item.type === 'receivable' ? '+' : '-'}{formatCurrency(item.amount)}
                                </p>
                              </div>

                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => {
                                    setEditingItem(item)
                                    setShowItemModal(true)
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                  title="Editar pendência"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                                  title="Excluir pendência"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="card py-16 text-center text-slate-500 text-xs">
                  Selecione um contato na lista ao lado para ver o extrato de pendências.
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Modais */}
      {showAccountModal && (
        <DebtAccountForm
          account={editingAccount || undefined}
          onClose={() => {
            setShowAccountModal(false)
            setEditingAccount(null)
          }}
          onSuccess={newId => {
            setSelectedAccountId(newId)
          }}
        />
      )}

      {showItemModal && selectedAccountData && (
        <DebtItemForm
          debtAccountId={selectedAccountData.account.id!}
          accountName={selectedAccountData.account.name}
          item={editingItem || undefined}
          onClose={() => {
            setShowItemModal(false)
            setEditingItem(null)
          }}
        />
      )}

      {showPrintModal && selectedAccountData && (
        <DebtPrintModal
          account={selectedAccountData.account}
          items={selectedAccountData.items}
          receivable={selectedAccountData.receivable}
          payable={selectedAccountData.payable}
          balance={selectedAccountData.balance}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  )
}
