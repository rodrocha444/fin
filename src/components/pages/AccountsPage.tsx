import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  CreditCard,
  Landmark,
  HandCoins,
  Pencil,
  Trash2,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useAccounts, useAllBalances } from '@/hooks/useAccounts'
import { useDebtAccounts, useDebtsSummary } from '@/hooks/useDebts'
import { deleteAccount } from '@/db/repositories/accounts'
import { deleteDebtAccount } from '@/db/repositories/debts'
import { formatCurrency, accountTypeLabel } from '@/utils/format'
import AccountForm from '@/components/organisms/AccountForm'
import SyncStatusBadge from '@/components/atoms/SyncStatusBadge'
import type { Account, DebtAccount } from '@/types'

function accountIcon(type: string) {
  if (type === 'credit_card') return <CreditCard className="w-5 h-5" />
  if (type === 'off_budget') return <TrendingUp className="w-5 h-5" />
  return <Landmark className="w-5 h-5" />
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const accounts = useAccounts()
  const balances = useAllBalances()
  const debtAccounts = useDebtAccounts() ?? []
  const debtSummary = useDebtsSummary()

  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | undefined>()
  const [editingDebtAccount, setEditingDebtAccount] = useState<DebtAccount | undefined>()
  const [formCategory, setFormCategory] = useState<'on_budget' | 'off_budget'>('on_budget')

  const handleDeleteOnBudget = async (acc: Account) => {
    if (!acc.id) return
    if (!confirm(`Excluir a conta "${acc.name}"?`)) return
    try {
      await deleteAccount(acc.id)
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir conta.')
    }
  }

  const handleDeleteOffBudget = async (debtAcc: DebtAccount) => {
    if (!debtAcc.id) return
    if (!confirm(`Excluir a conta "${debtAcc.name}" e todas as suas pendências associadas?`)) return
    try {
      await deleteDebtAccount(debtAcc.id)
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir conta de cobrança.')
    }
  }

  const handleOpenNew = (category: 'on_budget' | 'off_budget' = 'on_budget') => {
    setEditingAccount(undefined)
    setEditingDebtAccount(undefined)
    setFormCategory(category)
    setShowForm(true)
  }

  const handleEditAccount = (acc: Account) => {
    setEditingAccount(acc)
    setEditingDebtAccount(undefined)
    setFormCategory(acc.type === 'off_budget' ? 'off_budget' : 'on_budget')
    setShowForm(true)
  }

  const handleEditOffBudget = (debtAcc: DebtAccount) => {
    setEditingAccount(undefined)
    setEditingDebtAccount(debtAcc)
    setFormCategory('off_budget')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingAccount(undefined)
    setEditingDebtAccount(undefined)
  }

  // ── Cálculos de Saldos e Patrimônio ─────────────────────────
  const checkingAccounts = accounts?.filter(a => a.type === 'checking') ?? []
  const creditCardAccounts = accounts?.filter(a => a.type === 'credit_card') ?? []
  const onBudgetAccounts = [...checkingAccounts, ...creditCardAccounts]
  const offBudgetBankAccounts = accounts?.filter(a => a.type === 'off_budget') ?? []

  const onBudgetBalance = onBudgetAccounts.reduce((s, a) => s + (balances?.get(a.id!) ?? 0), 0)
  const offBudgetBankBalance = offBudgetBankAccounts.reduce((s, a) => s + (balances?.get(a.id!) ?? 0), 0)

  const offBudgetReceivable = debtSummary?.totalReceivable ?? 0
  const offBudgetPayable = debtSummary?.totalPayable ?? 0
  const offBudgetDebtNet = debtSummary?.netBalance ?? (offBudgetReceivable - offBudgetPayable)

  const totalOffBudget = offBudgetBankBalance + offBudgetDebtNet
  const totalNetWorth = onBudgetBalance + totalOffBudget

  return (
    <div className="fade-in">
      {/* Header */}
      <div
        className="px-3 sm:px-6 pb-4 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-100">Contas</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
              <span>
                Patrimônio Geral:{' '}
                <strong className={`font-bold tabular-nums ${totalNetWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(totalNetWorth)}
                </strong>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400">
                No Orçamento:{' '}
                <span className={`font-medium tabular-nums ${onBudgetBalance >= 0 ? 'text-slate-200' : 'text-rose-300'}`}>
                  {formatCurrency(onBudgetBalance)}
                </span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-400">
                Fora do Orçamento:{' '}
                <span className={`font-medium tabular-nums ${totalOffBudget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalOffBudget > 0 ? '+' : ''}{formatCurrency(totalOffBudget)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="lg:hidden">
              <SyncStatusBadge compact={true} />
            </div>
            <button
              onClick={() => handleOpenNew('on_budget')}
              className="btn-primary flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold shadow-md shadow-indigo-600/20"
              title="Cadastrar nova conta"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Conta</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-6 max-w-4xl mx-auto">
        {/* ════════════════════════════════════════════════════════════════
            1. SEÇÃO: DENTRO DO ORÇAMENTO (No Orçamento)
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide">
                No Orçamento
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Saldo no Orçamento</span>
              <span className={`text-sm sm:text-base font-bold tabular-nums ${onBudgetBalance >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                {formatCurrency(onBudgetBalance)}
              </span>
            </div>
          </div>

          {!accounts ? (
            <p className="text-slate-600 text-sm">Carregando contas…</p>
          ) : onBudgetAccounts.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-8 gap-3 bg-slate-900/60 border-dashed border-slate-800">
              <Landmark className="w-8 h-8 text-slate-700" />
              <p className="text-slate-500 text-xs">Nenhuma conta no orçamento cadastrada</p>
              <button
                onClick={() => handleOpenNew('on_budget')}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                + Adicionar Conta no Orçamento
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contas Correntes */}
              {checkingAccounts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Contas Correntes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {checkingAccounts.map(acc => {
                      const balance = balances?.get(acc.id!) ?? 0
                      const isNeg = balance < 0
                      return (
                        <div
                          key={acc.id}
                          onClick={() => navigate(`/accounts/${acc.id}`)}
                          className="card cursor-pointer hover:border-slate-600 transition-all active:scale-[0.99] select-none p-3.5"
                          style={{
                            background: `linear-gradient(135deg, ${acc.color}12 0%, transparent 65%)`,
                            borderColor: acc.color + '35',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: acc.color + '25', color: acc.color }}
                            >
                              {accountIcon(acc.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-100 text-sm truncate">{acc.name}</p>
                              <p className="text-[10px] text-slate-500">Conta Corrente</p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <p className={`text-sm sm:text-base font-bold tabular-nums ${isNeg ? 'text-rose-400' : 'text-slate-100'}`}>
                                  {formatCurrency(balance)}
                                </p>
                              </div>
                              <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEditAccount(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                                  title="Editar conta"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOnBudget(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                                  title="Excluir conta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Cartões de Crédito */}
              {creditCardAccounts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Cartões de Crédito
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {creditCardAccounts.map(acc => {
                      const balance = balances?.get(acc.id!) ?? 0
                      const isNeg = balance < 0
                      return (
                        <div
                          key={acc.id}
                          onClick={() => navigate(`/accounts/${acc.id}`)}
                          className="card cursor-pointer hover:border-slate-600 transition-all active:scale-[0.99] select-none p-3.5"
                          style={{
                            background: `linear-gradient(135deg, ${acc.color}12 0%, transparent 65%)`,
                            borderColor: acc.color + '35',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: acc.color + '25', color: acc.color }}
                            >
                              {accountIcon(acc.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-100 text-sm truncate">{acc.name}</p>
                              {acc.creditLimit ? (
                                <p className="text-[10px] text-slate-400 truncate">
                                  Limite: {formatCurrency(acc.creditLimit)}
                                  {acc.statementClosingDay && ` · Fecha d.${acc.statementClosingDay}`}
                                </p>
                              ) : (
                                <p className="text-[10px] text-slate-500">Cartão de Crédito</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <p className={`text-sm sm:text-base font-bold tabular-nums ${isNeg ? 'text-rose-400' : 'text-slate-100'}`}>
                                  {formatCurrency(balance)}
                                </p>
                                {acc.creditLimit && (
                                  <p className="text-[10px] text-slate-500 hidden sm:block">
                                    Disp: {formatCurrency(acc.creditLimit + balance)}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEditAccount(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                                  title="Editar cartão"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOnBudget(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                                  title="Excluir cartão"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            2. SEÇÃO: FORA DO ORÇAMENTO (Contas Fora do Orçamento e Cobranças)
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide">
                Fora do Orçamento
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Saldo Fora do Orçamento</span>
              <span className={`text-sm sm:text-base font-bold tabular-nums ${
                totalOffBudget > 0 ? 'text-emerald-400' : totalOffBudget < 0 ? 'text-rose-400' : 'text-slate-100'
              }`}>
                {totalOffBudget > 0 ? '+' : ''}{formatCurrency(totalOffBudget)}
              </span>
            </div>
          </div>

          {/* Mini-resumo de A Receber vs A Pagar se houver pendências de terceiros */}
          {(offBudgetReceivable > 0 || offBudgetPayable > 0 || debtAccounts.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold uppercase">
                  <span>A Receber</span>
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 tabular-nums">
                  {formatCurrency(offBudgetReceivable)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/30">
                <div className="flex items-center justify-between text-[10px] text-rose-400 font-semibold uppercase">
                  <span>A Pagar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm sm:text-base font-bold text-rose-400 mt-0.5 tabular-nums">
                  {formatCurrency(offBudgetPayable)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
                  <span>Contatos / Cobranças</span>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <p className="text-sm sm:text-base font-bold text-slate-200 mt-0.5 tabular-nums">
                  {debtAccounts.length} <span className="text-xs font-normal text-slate-500">({debtSummary?.pendingCount ?? 0} pendentes)</span>
                </p>
              </div>
            </div>
          )}

          {offBudgetBankAccounts.length === 0 && debtAccounts.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-8 gap-3 bg-slate-900/60 border-dashed border-slate-800">
              <HandCoins className="w-8 h-8 text-slate-700" />
              <p className="text-slate-500 text-xs">Nenhuma conta fora do orçamento cadastrada</p>
              <button
                onClick={() => handleOpenNew('off_budget')}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                + Adicionar Conta Fora do Orçamento
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contas Bancárias / Dívidas e Investimentos Fora do Orçamento */}
              {offBudgetBankAccounts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Dívidas e Investimentos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {offBudgetBankAccounts.map(acc => {
                      const balance = balances?.get(acc.id!) ?? 0
                      const isNeg = balance < 0
                      return (
                        <div
                          key={acc.id}
                          onClick={() => navigate(`/accounts/${acc.id}`)}
                          className="card cursor-pointer hover:border-slate-600 transition-all active:scale-[0.99] select-none p-3.5"
                          style={{
                            background: `linear-gradient(135deg, ${acc.color}12 0%, transparent 65%)`,
                            borderColor: acc.color + '35',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: acc.color + '25', color: acc.color }}
                            >
                              {accountIcon(acc.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-100 text-sm truncate">{acc.name}</p>
                              <p className="text-[10px] text-slate-500">Dívida / Investimento</p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <p className={`text-sm sm:text-base font-bold tabular-nums ${isNeg ? 'text-rose-400' : 'text-slate-100'}`}>
                                  {formatCurrency(balance)}
                                </p>
                              </div>
                              <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEditAccount(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                                  title="Editar conta"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOnBudget(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                                  title="Excluir conta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Contas a Receber / Pagar com Terceiros */}
              {debtAccounts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Contas a Receber / Pagar (Terceiros)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {debtAccounts.map(acc => {
                      const balance = acc.balance
                      const isPos = balance > 0
                      const isNeg = balance < 0
                      return (
                        <div
                          key={acc.id}
                          onClick={() => navigate(`/debts/${acc.id}`)}
                          className="card cursor-pointer hover:border-slate-600 transition-all active:scale-[0.99] select-none p-3.5"
                          style={{
                            background: `linear-gradient(135deg, ${(acc.color || '#6366f1')}12 0%, transparent 65%)`,
                            borderColor: (acc.color || '#6366f1') + '35',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                              style={{
                                backgroundColor: (acc.color || '#6366f1') + '25',
                                color: acc.color || '#6366f1',
                              }}
                            >
                              {acc.name.charAt(0).toUpperCase()}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-100 text-sm truncate">{acc.name}</p>
                                {acc.pendingCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                                    {acc.pendingCount}
                                  </span>
                                )}
                              </div>
                              {acc.phone ? (
                                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                                  {acc.phone}
                                </p>
                              ) : acc.notes ? (
                                <p className="text-[10px] text-slate-500 truncate">{acc.notes}</p>
                              ) : (
                                <p className="text-[10px] text-slate-500">Conta de Terceiro</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <p className={`text-sm sm:text-base font-bold tabular-nums ${
                                  isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-slate-400'
                                }`}>
                                  {isPos ? '+' : ''}{formatCurrency(balance)}
                                </p>
                                <span className="text-[10px] text-slate-500 block">
                                  {isPos ? 'a receber' : isNeg ? 'a pagar' : 'zerado'}
                                </span>
                              </div>
                              <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEditOffBudget(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                                  title="Editar contato"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOffBudget(acc)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                                  title="Excluir contato"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulário de conta unificado */}
      {showForm && (
        <AccountForm
          account={editingAccount}
          debtAccount={editingDebtAccount}
          initialCategory={formCategory}
          onClose={closeForm}
        />
      )}
    </div>
  )
}
