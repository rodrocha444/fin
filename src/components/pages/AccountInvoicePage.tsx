// src/pages/AccountInvoicePage.tsx — Página dedicada à Fatura Aberta e Faturas do Cartão
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  Clock,
  AlertCircle,
  Plus,
  ArrowDownLeft,
  Pencil,
  FileText,
} from 'lucide-react'
import { useAccount } from '@/hooks/useAccounts'
import { useAccountTransactions } from '@/hooks/useTransactions'
import { useCategoriesWithGroups } from '@/hooks/useBudget'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  getCurrentOpenInvoiceMonth,
  getInvoiceCycle,
  getInvoiceData,
} from '@/utils/invoices'
import TransactionForm from '@/components/organisms/TransactionForm'
import AccountForm from '@/components/organisms/AccountForm'
import InvoiceCycleNavigator from '@/components/molecules/InvoiceCycleNavigator'
import SearchBar from '@/components/atoms/SearchBar'

export default function AccountInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accountId = id

  const account = useAccount(accountId)
  const transactions = useAccountTransactions(accountId)
  const { categories } = useCategoriesWithGroups() ?? {}
  const categoryMap = new Map(categories?.map(c => [c.id!, c]) ?? [])

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showTxForm, setShowTxForm] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [showAccForm, setShowAccForm] = useState(false)

  if (accountId === undefined || (!account && !transactions)) {
    return (
      <div
        className="p-6 text-slate-500 text-sm flex items-center justify-center h-48"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
      >
        Carregando fatura…
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

  const closingDay = account.statementClosingDay
  const dueDay = account.paymentDueDay
  const hasClosingDay = typeof closingDay === 'number' && closingDay >= 1 && closingDay <= 31

  // Determinar o mês da fatura aberta
  const openInvoiceMonth = hasClosingDay ? getCurrentOpenInvoiceMonth(closingDay) : '2026-08'
  const activeMonth = selectedMonth ?? openInvoiceMonth

  const cycle = hasClosingDay
    ? getInvoiceCycle(activeMonth, closingDay, dueDay)
    : null

  const invoiceData = (cycle && transactions)
    ? getInvoiceData(transactions, cycle)
    : null

  const isOpenCurrent = activeMonth === openInvoiceMonth

  const filteredTxs = (invoiceData?.transactions ?? []).filter(tx => {
    if (!search) return true
    const q = search.toLowerCase()
    return tx.payee.toLowerCase().includes(q) || (tx.notes ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="fade-in">
      {/* Header com suporte a safe area */}
      <div
        className="flex items-center justify-between px-3 sm:px-6 pb-3 border-b border-slate-800 bg-slate-900"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <button
          onClick={() => navigate(`/accounts/${accountId}`)}
          className="btn-ghost inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-slate-100 py-1.5 px-2.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar para {account.name}</span>
          <span className="sm:hidden">Voltar</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-1">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: account.color }}
            />
            <span className="text-xs font-semibold text-slate-200 hidden sm:inline">{account.name}</span>
          </div>

          <button
            onClick={() => setShowAccForm(true)}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            title="Configurações do Cartão"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Configurar Cartão</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
        {/* Caso não haja dia de fechamento cadastrado */}
        {!hasClosingDay && (
          <div className="card p-6 border border-amber-500/30 bg-amber-950/20 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">Dia de fechamento não configurado</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Para calcular automaticamente a fatura aberta e agrupar as compras pelo ciclo do seu cartão, informe o dia de fechamento da fatura.
              </p>
            </div>
            <button
              onClick={() => setShowAccForm(true)}
              className="btn-primary py-2.5 px-5 text-xs font-semibold inline-flex items-center gap-2 mx-auto"
            >
              <Pencil className="w-4 h-4" />
              <span>Configurar dia de fechamento</span>
            </button>
          </div>
        )}

        {/* Seletor de Faturas */}
        {hasClosingDay && cycle && (
          <>
            {/* Navegador de ciclo / mês (Molecule) */}
            <InvoiceCycleNavigator
              cycle={cycle}
              activeMonth={activeMonth}
              onChangeMonth={setSelectedMonth}
            />

            {/* Atalhos rápidos se não estiver na fatura aberta */}
            {!isOpenCurrent && (
              <div className="flex justify-center">
                <button
                  onClick={() => setSelectedMonth(openInvoiceMonth)}
                  className="btn-ghost py-1 px-3 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 border border-indigo-800/40 rounded-full flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ir para Fatura Aberta Atual</span>
                </button>
              </div>
            )}

            {/* Card Hero da Fatura */}
            <div
              className="card p-5 sm:p-6 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${account.color}20 0%, rgba(15,23,42,0.8) 100%)`,
                borderColor: account.color + '50',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" style={{ color: account.color }} />
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      {cycle.status === 'open' ? 'Valor da Fatura Aberta' : 'Total da Fatura'}
                    </p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-100 tabular-nums mt-1.5">
                    {formatCurrency(invoiceData?.totalAmount ?? 0)}
                  </p>

                  {invoiceData && invoiceData.paymentsAmount > 0 && (
                    <p className="text-xs text-emerald-400 mt-1">
                      {formatCurrency(invoiceData.paymentsAmount)} em pagamentos/créditos recebidos
                    </p>
                  )}
                </div>

                {/* Datas de Fechamento e Vencimento */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 text-xs">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Fechamento
                    </p>
                    <p className="font-semibold text-slate-200 mt-1">{formatDate(cycle.closingDate)}</p>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Vencimento
                    </p>
                    <p className="font-semibold text-slate-200 mt-1">{formatDate(cycle.dueDate)}</p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center gap-2.5 pt-4 mt-4 border-t border-slate-800/80">
                <button
                  onClick={() => setShowPayForm(true)}
                  className="btn-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-900/30"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Pagar Fatura</span>
                </button>

                <button
                  onClick={() => setShowTxForm(true)}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lançar nesta fatura</span>
                </button>

                <Link
                  to={`/accounts/${accountId}`}
                  className="btn-ghost py-2.5 px-3 text-xs text-slate-400 hover:text-slate-200 ml-auto"
                >
                  Ver Histórico de Compras →
                </Link>
              </div>
            </div>

            {/* Detalhamento dos Lançamentos da Fatura */}
            <div className="card p-0 overflow-hidden">
              <div className="p-3 sm:p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar lançamento nesta fatura…"
                  className="max-w-md"
                />
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  {filteredTxs.length} {filteredTxs.length === 1 ? 'item' : 'itens'} nesta fatura
                </span>
              </div>

              {/* Lista */}
              <div className="divide-y divide-slate-800/60">
                {filteredTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 text-xs px-4 text-center">
                    <FileText className="w-10 h-10 text-slate-700" />
                    <p className="text-sm font-medium text-slate-400">
                      {search ? 'Nenhum lançamento encontrado' : 'Nenhum lançamento registrado nesta fatura'}
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
                  filteredTxs.map(tx => {
                    const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined
                    const isExpense = tx.type === 'expense'
                    const isIncome = tx.type === 'income' || tx.type === 'transfer'

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-200 truncate">{tx.payee}</p>
                            {tx.installmentGroupId && (
                              <span className="badge bg-violet-900/40 text-violet-300 border border-violet-700/50 text-[10px]">
                                Parcela {tx.installmentNumber} de {tx.installmentTotal}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">{formatDate(tx.date)}</span>
                            {cat && (
                              <>
                                <span className="text-slate-700 text-xs">·</span>
                                <span className="text-xs text-slate-400 truncate">{cat.name}</span>
                              </>
                            )}
                            {tx.notes && (
                              <>
                                <span className="text-slate-700 text-xs">·</span>
                                <span className="text-xs text-slate-500 truncate">{tx.notes}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className={`text-sm sm:text-base font-semibold tabular-nums ${
                              isExpense ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {isExpense ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Lançamento */}
      {showTxForm && (
        <TransactionForm
          defaultAccountId={accountId}
          onClose={() => setShowTxForm(false)}
        />
      )}

      {/* Modal de Pagamento de Fatura */}
      {showPayForm && (
        <TransactionForm
          defaultMode="transfer"
          defaultTransferAccountId={accountId}
          defaultAmount={invoiceData?.totalAmount}
          defaultPayee={`Pagamento de Fatura ${account.name}`}
          onClose={() => setShowPayForm(false)}
        />
      )}

      {/* Modal de Configuração do Cartão */}
      {showAccForm && (
        <AccountForm
          account={account}
          onClose={() => setShowAccForm(false)}
        />
      )}
    </div>
  )
}
