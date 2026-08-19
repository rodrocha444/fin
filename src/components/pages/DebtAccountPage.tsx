// src/components/pages/DebtAccountPage.tsx — Página dedicada ao extrato de uma conta de cobrança
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Printer,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  Phone,
  Calendar,
  ChevronRight,
  HandCoins,
} from 'lucide-react'
import { useDebtAccountWithItems } from '@/hooks/useDebts'
import {
  deleteDebtAccount,
  deleteDebtItem,
  setDebtItemStatus,
} from '@/db/repositories/debts'
import { formatCurrency, formatDate } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import DebtAccountForm from '@/components/organisms/DebtAccountForm'
import DebtItemForm from '@/components/organisms/DebtItemForm'
import DebtPrintModal from '@/components/organisms/DebtPrintModal'
import DebtSettleConfirmModal from '@/components/organisms/DebtSettleConfirmModal'
import type { DebtAccount, DebtItem } from '@/types'

// ── Tipos para agrupamento ───────────────────────────────────
type InstallmentGroup = {
  groupId: string
  description: string
  type: DebtItem['type']
  totalInstallments: number
  settledCount: number
  pendingCount: number
  totalAmount: number
  perInstallmentAmount: number
  nextDueDate?: Date
  items: DebtItem[]
}
type ListEntry = { kind: 'single'; item: DebtItem } | { kind: 'group'; group: InstallmentGroup }

function buildListEntries(allItems: DebtItem[], itemFilter: 'all' | 'pending' | 'settled'): ListEntry[] {
  const groupMap = new Map<string, DebtItem[]>()
  const singles: DebtItem[] = []

  for (const item of allItems) {
    if (item.installmentGroupId) {
      const arr = groupMap.get(item.installmentGroupId) ?? []
      arr.push(item)
      groupMap.set(item.installmentGroupId, arr)
    } else {
      singles.push(item)
    }
  }

  const entries: ListEntry[] = []

  for (const item of singles) {
    if (itemFilter === 'pending' && item.status !== 'pending') continue
    if (itemFilter === 'settled' && item.status !== 'settled') continue
    entries.push({ kind: 'single', item })
  }

  for (const [groupId, items] of groupMap) {
    const allSettled = items.every(i => i.status === 'settled')
    const allPending = items.every(i => i.status === 'pending')
    if (itemFilter === 'pending' && allSettled) continue
    if (itemFilter === 'settled' && !allSettled) continue

    const representative = items[0]
    const settledCount = items.filter(i => i.status === 'settled').length
    const pendingCount = items.filter(i => i.status === 'pending').length
    const nextDue = items
      .filter(i => i.status === 'pending' && i.dueDate)
      .map(i => new Date(i.dueDate!))
      .sort((a, b) => a.getTime() - b.getTime())[0]

    entries.push({
      kind: 'group',
      group: {
        groupId,
        description: representative.description.replace(/\s*\(\d+\/\d+\)$/, '').trim(),
        type: representative.type,
        totalInstallments: representative.installmentTotal ?? items.length,
        settledCount,
        pendingCount,
        totalAmount: items.reduce((s, i) => s + i.amount, 0),
        perInstallmentAmount: representative.amount,
        nextDueDate: nextDue,
        items: [...items].sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0)),
      },
    })
  }

  return entries
}

export default function DebtAccountPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accountId = id
  const data = useDebtAccountWithItems(accountId)

  const [itemFilter, setItemFilter] = useState<'all' | 'pending' | 'settled'>('pending')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<DebtItem | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [settleConfirmItem, setSettleConfirmItem] = useState<DebtItem | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleDeleteAccount = async (acc: DebtAccount) => {
    if (!acc.id) return
    if (!confirm(`Excluir o contato "${acc.name}" e todas as suas pendências associadas?`)) return
    await deleteDebtAccount(acc.id)
    navigate('/accounts')
  }

  const handleDeleteItem = async (item: DebtItem) => {
    if (!item.id) return
    if (!confirm(`Excluir ${item.installmentTotal ? `esta parcela (${item.installmentNumber}/${item.installmentTotal}x)` : 'esta pendência'}?`)) return
    await deleteDebtItem(item.id)
  }

  const handleConfirmSettle = async () => {
    if (!settleConfirmItem?.id) return
    const nextStatus = settleConfirmItem.status === 'pending' ? 'settled' : 'pending'
    await setDebtItemStatus(settleConfirmItem.id, nextStatus)
    setSettleConfirmItem(null)
  }

  const today = new Date()

  // Loading / not found
  if (data === undefined) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm fade-in">
        Carregando…
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500 text-sm fade-in">
        <HandCoins className="w-10 h-10 text-slate-700" />
        <p>Contato não encontrado.</p>
        <button onClick={() => navigate('/accounts')} className="btn-secondary py-2 px-4 text-xs">
          ← Voltar para Contas
        </button>
      </div>
    )
  }

  const { account, items, receivable, payable, balance } = data
  const listEntries = buildListEntries(items, itemFilter)

  return (
    <div className="fade-in">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-6 pb-4 border-b border-slate-800 bg-slate-900 print:hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/accounts')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Voltar à lista de contas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-sm"
            style={{
              backgroundColor: (account.color || '#6366f1') + '30',
              color: account.color || '#6366f1',
            }}
          >
            {account.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-100">{account.name}</h1>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-0.5">
              {account.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {account.phone}
                </span>
              )}
              {account.notes && (
                <>
                  {account.phone && <span>·</span>}
                  <span className="text-slate-500 truncate max-w-[200px]">{account.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto pl-[52px] sm:pl-0">
          <button
            onClick={() => setShowPrintModal(true)}
            className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 hover:text-indigo-300"
            title="Imprimir extrato em PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF / Imprimir</span>
          </button>
          <button
            onClick={() => setShowAccountModal(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Editar contato"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteAccount(account)}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
            title="Excluir contato"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4 print:hidden">

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 card">
          <div>
            <p className="text-[10px] text-slate-500 font-medium">A Receber</p>
            <p className="text-xs sm:text-base font-bold text-emerald-400 tabular-nums">{formatCurrency(receivable)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-medium">A Pagar</p>
            <p className="text-xs sm:text-base font-bold text-rose-400 tabular-nums">{formatCurrency(payable)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-medium">Saldo Líquido</p>
            <p className={`text-xs sm:text-base font-bold tabular-nums ${
              balance > 0 ? 'text-emerald-400' : balance < 0 ? 'text-rose-400' : 'text-slate-300'
            }`}>
              {balance > 0 ? '+' : ''}{formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* Filtros + Nova Pendência */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 self-start">
            {(['pending', 'settled', 'all'] as const).map(key => (
              <button
                key={key}
                onClick={() => setItemFilter(key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  itemFilter === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {key === 'pending' ? 'Pendentes' : key === 'settled' ? 'Quitadas' : 'Todas'}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowItemModal(true) }}
            className="btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 self-stretch sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Pendência</span>
          </button>
        </div>

        {/* Lista de Pendências */}
        <div className="card space-y-2 divide-y divide-slate-800/40">
          {listEntries.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p>Nenhuma pendência encontrada neste filtro.</p>
            </div>
          ) : (
            listEntries.map(entry => {
              // ── Item simples ──
              if (entry.kind === 'single') {
                const { item } = entry
                const isSettled = item.status === 'settled'
                const isOverdue = !isSettled && item.dueDate && new Date(item.dueDate) < today
                return (
                  <div
                    key={item.id}
                    className={`pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/20 p-2.5 rounded-xl transition-colors ${isSettled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => setSettleConfirmItem(item)}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 mt-0.5 ${
                          isSettled
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 hover:text-emerald-400 hover:bg-slate-700'
                        }`}
                        title={isSettled ? 'Marcar como pendente' : 'Quitar'}
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
                              <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
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
                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                      <p className={`text-sm sm:text-base font-bold tabular-nums ${item.type === 'receivable' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.type === 'receivable' ? '+' : '-'}{formatCurrency(item.amount)}
                      </p>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => { setEditingItem(item); setShowItemModal(true) }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors" title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              // ── Grupo de parcelas ──
              const { group } = entry
              const isExpanded = expandedGroups.has(group.groupId)
              const allGroupSettled = group.pendingCount === 0
              const progress = (group.settledCount / group.totalInstallments) * 100
              const isGroupOverdue = group.nextDueDate && new Date(group.nextDueDate) < today

              return (
                <div key={group.groupId} className="pt-3 first:pt-0">
                  <div
                    onClick={() => toggleGroup(group.groupId)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/20 p-2.5 rounded-xl cursor-pointer transition-colors ${allGroupSettled ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center mt-0.5 ${
                        allGroupSettled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-900/50 text-violet-300'
                      }`}>
                        {allGroupSettled
                          ? <CheckCircle className="w-4 h-4" />
                          : <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold text-sm text-slate-200 truncate ${allGroupSettled ? 'line-through text-slate-400' : ''}`}>
                            {group.description}
                          </p>
                          <Badge variant="violet">{group.totalInstallments}x</Badge>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            group.type === 'receivable'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                          }`}>
                            {group.type === 'receivable' ? 'A Receber' : 'A Pagar'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <div className="flex-1 max-w-[140px] h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${allGroupSettled ? 'bg-emerald-500' : 'bg-violet-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">
                            {group.settledCount}/{group.totalInstallments} pagas
                            {group.pendingCount > 0 && ` · ${group.pendingCount} pendente${group.pendingCount > 1 ? 's' : ''}`}
                          </span>
                          {group.nextDueDate && !allGroupSettled && (
                            <span className={`text-[10px] flex items-center gap-1 ${isGroupOverdue ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                              <Calendar className="w-3 h-3" />
                              Próx: {formatDate(group.nextDueDate)} {isGroupOverdue && '(Vencido)'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`text-sm sm:text-base font-bold tabular-nums ${group.type === 'receivable' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {group.type === 'receivable' ? '+' : '-'}{formatCurrency(group.totalAmount)}
                        </p>
                        <p className="text-[10px] text-slate-500 tabular-nums">{formatCurrency(group.perInstallmentAmount)}/parcela</p>
                      </div>
                    </div>
                  </div>

                  {/* Parcelas expandidas */}
                  {isExpanded && (
                    <div className="mt-1 ml-10 space-y-1 border-l-2 border-slate-800 pl-3">
                      {group.items.map(item => {
                        const isSettled = item.status === 'settled'
                        const isOverdue = !isSettled && item.dueDate && new Date(item.dueDate) < today
                        return (
                          <div key={item.id}
                            className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800/30 transition-colors ${isSettled ? 'opacity-60' : ''}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                onClick={() => setSettleConfirmItem(item)}
                                className={`p-1 rounded flex-shrink-0 ${isSettled ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}
                                title={isSettled ? 'Marcar como pendente' : 'Quitar parcela'}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <div className="min-w-0">
                                <span className={`text-[11px] font-medium ${isSettled ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                  Parcela {item.installmentNumber}/{item.installmentTotal}
                                </span>
                                {item.dueDate && (
                                  <span className={`ml-2 text-[10px] ${isOverdue ? 'text-rose-400' : 'text-slate-500'}`}>
                                    {formatDate(item.dueDate)} {isOverdue && '(Vencido)'}
                                  </span>
                                )}
                                {isSettled && item.settledDate && (
                                  <span className="ml-2 text-[10px] text-slate-500">Quitado em {formatDate(item.settledDate)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`text-[11px] font-bold tabular-nums ${isSettled ? 'text-slate-500 line-through' : group.type === 'receivable' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(item.amount)}
                              </span>
                              <button onClick={() => { setEditingItem(item); setShowItemModal(true) }}
                                className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors" title="Editar">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteItem(item)}
                                className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors" title="Excluir">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modais */}
      {showAccountModal && (
        <DebtAccountForm
          account={account}
          onClose={() => setShowAccountModal(false)}
        />
      )}

      {showItemModal && (
        <DebtItemForm
          debtAccountId={account.id!}
          accountName={account.name}
          item={editingItem || undefined}
          onClose={() => { setShowItemModal(false); setEditingItem(null) }}
        />
      )}

      {showPrintModal && (
        <DebtPrintModal
          account={account}
          items={items}
          receivable={receivable}
          payable={payable}
          balance={balance}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {settleConfirmItem && (
        <DebtSettleConfirmModal
          item={settleConfirmItem}
          accountName={account.name}
          onClose={() => setSettleConfirmItem(null)}
          onConfirm={handleConfirmSettle}
        />
      )}
    </div>
  )
}
