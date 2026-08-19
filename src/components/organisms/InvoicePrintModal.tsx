// src/components/organisms/InvoicePrintModal.tsx — Visualização e impressão de fatura do cartão em PDF/A4
import { Printer, X, CreditCard, Calendar, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import type { Account, Category } from '@/types'
import type { InvoiceData } from '@/utils/invoices'

interface InvoicePrintModalProps {
  account: Account
  invoiceData: InvoiceData
  categories?: Category[]
  onClose: () => void
}

export default function InvoicePrintModal({
  account,
  invoiceData,
  categories = [],
  onClose,
}: InvoicePrintModalProps) {
  const { cycle, transactions, totalAmount, chargesAmount, paymentsAmount } = invoiceData
  const categoryMap = new Map(categories.map(c => [c.id!, c.name]))

  const handlePrint = () => window.print()

  const expenses = transactions.filter(t => t.type === 'expense')
  const payments = transactions.filter(t => t.type === 'income' || t.type === 'transfer')

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-6 overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.5rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-full sm:max-h-[95vh] overflow-hidden">
        
        {/* Header do modal (oculto na impressão) */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex-shrink-0 print:hidden gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-100 text-sm sm:text-lg truncate">
              Fatura em PDF — {cycle.label}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Visualização para impressão e exportação em PDF da fatura
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="btn-primary py-2 px-3 sm:px-3.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
              <span className="sm:hidden">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Documento Formatado para Impressão */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 print:bg-white print:p-0 print:m-0 print:text-black print:overflow-visible">
          <div
            id="printable-invoice-container"
            className="bg-slate-900 print:bg-white text-slate-100 print:text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-800 print:border-none space-y-6 print:space-y-4 print:p-0 print:m-0"
          >

            {/* Cabeçalho do Extrato da Fatura */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 print:border-slate-300 pb-5 print:pb-3 print-avoid-break">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                    F
                  </div>
                  <span className="font-bold text-sm text-slate-100 print:text-slate-900 tracking-tight">FinPlan</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-400 print:text-indigo-900">
                  Fatura do Cartão de Crédito
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                  Emitido em {formatDate(new Date())} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-400 print:text-slate-500 font-medium uppercase tracking-wider">Cartão</p>
                <p className="text-lg font-bold text-slate-100 print:text-slate-900">{account.name}</p>
                <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5 flex sm:justify-end items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    cycle.status === 'open' ? 'bg-emerald-500' : cycle.status === 'future' ? 'bg-violet-500' : 'bg-amber-500'
                  }`} />
                  <span className="capitalize font-medium">
                    Fatura {cycle.label} ({cycle.status === 'open' ? 'Aberta' : cycle.status === 'future' ? 'Futura' : 'Fechada'})
                  </span>
                </div>
              </div>
            </div>

            {/* Resumo Financeiro da Fatura */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 print:p-3 rounded-xl bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 print-avoid-break">
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">Total da Fatura</p>
                <p className="text-base sm:text-xl font-bold text-slate-100 print:text-slate-900 tabular-nums">
                  {formatCurrency(totalAmount)}
                </p>
              </div>

              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">Fechamento</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-200 print:text-slate-800 mt-0.5">
                  {formatDate(cycle.closingDate)}
                </p>
              </div>

              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">Vencimento</p>
                <p className="text-xs sm:text-sm font-semibold text-amber-400 print:text-amber-700 mt-0.5">
                  {formatDate(cycle.dueDate)}
                </p>
              </div>

              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">Período de Compras</p>
                <p className="text-[11px] font-medium text-slate-300 print:text-slate-700 mt-0.5">
                  {formatDate(cycle.startDate)} a {formatDate(cycle.closingDate)}
                </p>
              </div>
            </div>

            {/* Lançamentos de Despesas / Compras */}
            <div className="space-y-2.5 print:space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-1.5 print-avoid-break">
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-rose-400 print:text-slate-800">
                  Lançamentos & Compras ({expenses.length})
                </h2>
                <span className="text-xs font-bold text-rose-400 print:text-slate-900 tabular-nums">
                  Subtotal: {formatCurrency(chargesAmount)}
                </span>
              </div>

              {expenses.length === 0 ? (
                <p className="text-xs text-slate-500 print:text-slate-500 py-3 italic">
                  Nenhuma compra registrada nesta fatura.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5">Data</th>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5">Descrição / Favorecido</th>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5">Categoria</th>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5">Parcela</th>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {expenses.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {formatDate(tx.date)}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-100 print:text-slate-900">
                            <div>
                              <span>{tx.payee}</span>
                              {tx.notes && (
                                <p className="text-[10px] text-slate-500 print:text-slate-500 font-normal truncate">
                                  {tx.notes}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600">
                            {tx.categoryId ? categoryMap.get(tx.categoryId) ?? 'Sem categoria' : 'Sem categoria'}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                            {tx.installmentGroupId ? (
                              <span className="font-semibold text-violet-400 print:text-indigo-900">
                                {tx.installmentNumber}/{tx.installmentTotal}
                              </span>
                            ) : (
                              'À vista'
                            )}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-semibold text-rose-400 print:text-slate-900 tabular-nums whitespace-nowrap">
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagamentos / Créditos no ciclo */}
            {payments.length > 0 && (
              <div className="space-y-2.5 print:space-y-2 print-avoid-break">
                <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-1.5">
                  <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-400 print:text-emerald-800">
                    Pagamentos & Créditos Realizados ({payments.length})
                  </h2>
                  <span className="text-xs font-bold text-emerald-400 print:text-emerald-800 tabular-nums">
                    Total: -{formatCurrency(paymentsAmount)}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5">Data</th>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                        <th className="py-2 px-3 print:py-1.5 print:px-2.5 text-right">Valor Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {payments.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {formatDate(tx.date)}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-100 print:text-slate-900">
                            {tx.payee || 'Pagamento de Fatura'}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-semibold text-emerald-400 print:text-emerald-800 tabular-nums whitespace-nowrap">
                            -{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total Final da Fatura */}
            <div className="p-4 print:p-3 rounded-xl bg-indigo-950/40 print:bg-slate-100 border border-indigo-800/40 print:border-slate-300 flex items-center justify-between print-avoid-break">
              <div>
                <p className="text-xs text-indigo-300 print:text-slate-600 font-semibold uppercase tracking-wider">
                  Valor Final da Fatura {cycle.label}
                </p>
                <p className="text-[11px] text-slate-400 print:text-slate-500 mt-0.5">
                  Vencimento em {formatDate(cycle.dueDate)}
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-indigo-300 print:text-slate-900 tabular-nums">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {/* Rodapé institucional para impressão */}
            <div className="pt-4 border-t border-slate-800 print:border-slate-300 text-center text-[10px] text-slate-500 print:text-slate-500 print-avoid-break">
              <p>Extrato gerado pelo FinPlan — Gestão Financeira Pessoal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
