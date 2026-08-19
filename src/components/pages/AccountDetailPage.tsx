// src/pages/AccountDetailPage.tsx — Página dedicada ao histórico e detalhes da conta
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  CreditCard,
  Landmark,
  PiggyBank,
  Pencil,
  FileText,
  Receipt,
  ArrowUpRight,
  Calendar,
  Printer,
} from 'lucide-react'
import { useAccount, useAccountBalance } from '@/hooks/useAccounts'
import {
  useAccountTransactions,
  useCreditCardPurchases,
  type CreditCardPurchase,
} from '@/hooks/useTransactions'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { deleteTransaction, deleteInstallmentGroup } from '@/db/repositories/transactions'
import { deleteAccount } from '@/db/repositories/accounts'
import { formatCurrency, formatDate, accountTypeLabel } from '@/utils/format'
import {
  getCurrentOpenInvoiceMonth,
  getInvoiceCycle,
  getInvoiceData,
  getInvoicesOverview,
  type InvoiceData,
} from '@/utils/invoices'
import TransactionForm from '@/components/organisms/TransactionForm'
import AccountForm from '@/components/organisms/AccountForm'
import InvoicePrintModal from '@/components/organisms/InvoicePrintModal'
import SearchBar from '@/components/atoms/SearchBar'
import CreditCardPurchaseItem from '@/components/molecules/CreditCardPurchaseItem'
import TransactionItem from '@/components/molecules/TransactionItem'
import type { Transaction } from '@/types'

function accountIcon(type: string) {
  if (type === 'credit_card') return <CreditCard className="w-5 h-5" />
  if (type === 'savings') return <PiggyBank className="w-5 h-5" />
  return <Landmark className="w-5 h-5" />
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accountId = id

  const account = useAccount(accountId)
  const balance = useAccountBalance(accountId) ?? 0
  const isCreditCard = account?.type === 'credit_card'

  const transactions = useAccountTransactions(accountId)
  const ccPurchases = useCreditCardPurchases(accountId)
  const { categories } = useCategoriesWithGroups() ?? {}
  const categoryMap = new Map(categories?.map(c => [c.id!, c]) ?? [])

  const [search, setSearch] = useState('')
  const [showTxForm, setShowTxForm] = useState(false)
  const [showAccForm, setShowAccForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceData | null>(null)

  if (accountId === undefined || (account === undefined && transactions === undefined)) {
    return (
      <div
        className="p-6 text-slate-500 text-sm flex items-center justify-center h-48"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
      >
        Carregando conta…
      </div>
    )
  }

  if (!account) {
    return (
      <div
        className="p-4 sm:p-6 space-y-4 fade-in max-w-5xl mx-auto"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <Link to="/accounts" className="btn-ghost inline-flex items-center gap-2 text-xs">
          <ArrowLeft className="w-4 h-4" /> Voltar para Contas
        </Link>
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Conta não encontrada.</p>
        </div>
      </div>
    )
  }

  const isNeg = balance < 0

  // Cálculo da fatura aberta para cartão de crédito
  const openInvoiceData = (() => {
    if (!isCreditCard || !account.statementClosingDay || !transactions) return null
    const openMonth = getCurrentOpenInvoiceMonth(account.statementClosingDay)
    const cycle = getInvoiceCycle(openMonth, account.statementClosingDay, account.paymentDueDay)
    return getInvoiceData(transactions, cycle)
  })()

  // Visão geral das faturas futuras (parcelamentos)
  const invoicesOverview = (() => {
    if (!isCreditCard || !account.statementClosingDay || !transactions) return null
    return getInvoicesOverview(transactions, account.statementClosingDay, account.paymentDueDay, 12)
  })()

  // Filtragem de lista
  const filteredTxs = [...(transactions ?? [])]
    .filter(tx => {
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

  const filteredPurchases = (ccPurchases ?? []).filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.payee.toLowerCase().includes(q) || (p.notes ?? '').toLowerCase().includes(q)
  })

  const handleDeleteTx = async (tx: Transaction) => {
    if (!tx.id) return
    if (!confirm(tx.installmentGroupId ? 'Excluir esta parcela?' : 'Excluir esta transação?')) return
    await deleteTransaction(tx.id)
  }

  const handleDeletePurchase = async (p: CreditCardPurchase) => {
    if (p.isInstallment && p.groupId) {
      if (!confirm(`Excluir a compra parcelada "${p.payee}" (${p.installmentCount} parcelas)? Todas as parcelas serão removidas.`)) return
      await deleteInstallmentGroup(p.groupId)
    } else if (p.transactionId) {
      if (!confirm(`Excluir a transação "${p.payee}"?`)) return
      await deleteTransaction(p.transactionId)
    }
  }

  const handleDeleteAccount = async () => {
    if (!account.id) return
    if (!confirm(`Excluir a conta "${account.name}"?`)) return
    try {
      await deleteAccount(account.id)
      navigate('/accounts')
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="fade-in">
      {/* Header com suporte à statusbar / safe-area */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <button
          onClick={() => navigate('/accounts')}
          className="btn-ghost inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-slate-100 py-1.5 px-2.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Contas</span>
        </button>

        <div className="flex items-center gap-2">
          {isCreditCard && (
            <Link
              to={`/accounts/${accountId}/invoice`}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 border-indigo-500"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ver Fatura</span>
            </Link>
          )}

          <button
            onClick={() => setShowAccForm(true)}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            title="Editar conta"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Editar</span>
          </button>
          <button
            onClick={handleDeleteAccount}
            className="btn-danger py-1.5 px-3 text-xs flex items-center gap-1.5"
            title="Excluir conta"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
        {/* Card principal com detalhes da conta */}
        <div
          className="card p-4 sm:p-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${account.color}15 0%, transparent 70%)`,
            borderColor: account.color + '40',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ backgroundColor: account.color + '30', color: account.color }}
              >
                {accountIcon(account.type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-slate-100 text-lg sm:text-xl">{account.name}</h1>
                  <span className="badge bg-slate-800/80 text-slate-300 border border-slate-700/80 text-[10px]">
                    {accountTypeLabel(account.type)}
                  </span>
                </div>
                {account.type === 'credit_card' && (
                  <p className="text-xs text-slate-400 mt-1">
                    {account.creditLimit && (
                      <>Limite: <span className="font-semibold text-slate-200">{formatCurrency(account.creditLimit)}</span></>
                    )}
                    {account.statementClosingDay && ` · Fecha dia ${account.statementClosingDay}`}
                    {account.paymentDueDay && ` · Vence dia ${account.paymentDueDay}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Saldo Atual</p>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums ${isNeg ? 'text-rose-400' : 'text-slate-100'}`}>
                  {formatCurrency(balance)}
                </p>
                {account.type === 'credit_card' && account.creditLimit && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Disponível: <span className="font-medium text-emerald-400">{formatCurrency(account.creditLimit + balance)}</span>
                  </p>
                )}
              </div>

              <button
                onClick={() => setShowTxForm(true)}
                className="btn-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Nova transação</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card de Acesso Rápido à Fatura Aberta (para Cartão de Crédito) */}
        {isCreditCard && (
          <div className="space-y-3">
            <div className="card p-4 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-200">Fatura Aberta do Cartão</p>
                    <span className="badge bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px]">
                      Aberta
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {openInvoiceData ? (
                      <>
                        Valor atual:{' '}
                        <span className="font-bold text-slate-200">{formatCurrency(openInvoiceData.totalAmount)}</span>
                        {account.statementClosingDay && ` · Fecha em ${formatDate(openInvoiceData.cycle.closingDate)}`}
                      </>
                    ) : (
                      account.statementClosingDay
                        ? `Fechamento dia ${account.statementClosingDay}`
                        : 'Configure o dia de fechamento para cálculo automático'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                {openInvoiceData && (
                  <button
                    onClick={() => setPrintingInvoice(openInvoiceData)}
                    className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                    title="Imprimir fatura aberta"
                  >
                    <Printer className="w-4 h-4 text-indigo-400" />
                    <span>Imprimir</span>
                  </button>
                )}

                <Link
                  to={`/accounts/${accountId}/invoice`}
                  className="btn-secondary py-2 px-3.5 text-xs font-semibold flex items-center justify-center gap-1.5 flex-1 sm:flex-initial hover:border-indigo-500 hover:text-indigo-300 transition-colors"
                >
                  <span>Acessar Fatura</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Projeção de Faturas Futuras (Parcelamentos) */}
            {invoicesOverview && invoicesOverview.futureInvoices.length > 0 && (
              <div className="card p-4 bg-slate-900 border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-violet-400" />
                    <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Próximas Faturas (Parcelamentos)
                    </p>
                  </div>
                  <span className="text-xs font-bold text-violet-300 tabular-nums">
                    Total futuro comprometido: {formatCurrency(invoicesOverview.totalFutureCommitted)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {invoicesOverview.futureInvoices.map(fut => (
                    <Link
                      key={fut.cycle.monthKey}
                      to={`/accounts/${accountId}/invoice?month=${fut.cycle.monthKey}`}
                      className="p-3 bg-slate-950/70 border border-slate-800 hover:border-violet-500/50 rounded-xl transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-300 capitalize group-hover:text-violet-300 transition-colors">
                          {fut.cycle.label}
                        </span>
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/40">
                          {fut.transactions.length}x
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-100 tabular-nums mt-1 group-hover:text-violet-200">
                        {formatCurrency(fut.totalAmount)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Vence {formatDate(fut.cycle.dueDate)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seção de histórico (Compras para Cartão, Transações para demais contas) */}
        <div className="card p-0 overflow-hidden">
          {/* Barra de busca e título */}
          <div className="p-3 sm:p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={isCreditCard ? 'Buscar compra no cartão…' : 'Buscar favorecido ou nota nesta conta…'}
              className="max-w-md"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                {isCreditCard ? 'Histórico de Compras' : 'Transações'}:
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {isCreditCard ? filteredPurchases.length : filteredTxs.length} {((isCreditCard ? filteredPurchases.length : filteredTxs.length) === 1 ? 'item' : 'itens')}
              </span>
            </div>
          </div>

          {/* Lista de Compras (Cartão de Crédito) ou Transações (Contas) */}
          <div className="divide-y divide-slate-800/60">
            {isCreditCard ? (
              // Modo Cartão de Crédito: Histórico consolidado de compras
              filteredPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 text-xs px-4 text-center">
                  <CreditCard className="w-10 h-10 text-slate-700" />
                  <p className="text-sm font-medium text-slate-400">
                    {search ? 'Nenhuma compra encontrada' : 'Nenhuma compra registrada neste cartão'}
                  </p>
                  <button
                    onClick={() => setShowTxForm(true)}
                    className="btn-secondary text-xs mt-1 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar compra
                  </button>
                </div>
              ) : (
                filteredPurchases.map(p => (
                  <CreditCardPurchaseItem
                    key={p.id}
                    purchase={p}
                    categoryName={p.categoryId ? categoryMap.get(p.categoryId)?.name : undefined}
                    onDelete={() => handleDeletePurchase(p)}
                  />
                ))
              )
            ) : (
              // Modo Padrão: Transações normais de conta corrente/poupança
              filteredTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 text-xs px-4 text-center">
                  <CreditCard className="w-10 h-10 text-slate-700" />
                  <p className="text-sm font-medium text-slate-400">
                    {search ? 'Nenhuma transação encontrada' : 'Nenhuma transação registrada nesta conta'}
                  </p>
                  <button
                    onClick={() => setShowTxForm(true)}
                    className="btn-secondary text-xs mt-1 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Lançar transação
                  </button>
                </div>
              ) : (
                filteredTxs.map(tx => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    accountName={account.name}
                    categoryName={tx.categoryId ? categoryMap.get(tx.categoryId)?.name : undefined}
                    onEdit={() => setEditingTx(tx)}
                    onDelete={() => handleDeleteTx(tx)}
                  />
                ))
              )
            )}
          </div>
        </div>

        {/* Form de nova transação */}
        {showTxForm && (
          <TransactionForm
            defaultAccountId={accountId}
            onClose={() => setShowTxForm(false)}
          />
        )}

        {/* Form de edição de transação */}
        {editingTx && (
          <TransactionForm
            transaction={editingTx}
            onClose={() => setEditingTx(null)}
          />
        )}

        {/* Form de edição de conta */}
        {showAccForm && <AccountForm account={account} onClose={() => setShowAccForm(false)} />}

        {/* Modal de Impressão de Fatura */}
        {printingInvoice && (
          <InvoicePrintModal
            account={account}
            invoiceData={printingInvoice}
            categories={categories}
            onClose={() => setPrintingInvoice(null)}
          />
        )}
      </div>
    </div>
  )
}
