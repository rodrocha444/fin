// src/components/organisms/DebtPrintModal.tsx — Visualização e impressão de extrato em PDF de cobranças/pendências
import { Printer, X, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import type { DebtAccount, DebtItem } from '@/types'

interface DebtPrintModalProps {
  account: DebtAccount
  items: DebtItem[]
  receivable: number
  payable: number
  balance: number
  onClose: () => void
}

export default function DebtPrintModal({
  account,
  items,
  receivable,
  payable,
  balance,
  onClose,
}: DebtPrintModalProps) {
  const pendingItems = items.filter(i => i.status === 'pending')
  const settledItems = items.filter(i => i.status === 'settled')

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-6 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header da modal (oculto na impressão) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0 print:hidden">
          <div>
            <h2 className="font-semibold text-slate-100 text-base sm:text-lg">Extrato / Relatório em PDF</h2>
            <p className="text-xs text-slate-400 mt-0.5">Visualize e imprima o extrato de pendências</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary py-2 px-3.5 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Documento Formatado (Folha A4 / Extrato) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 print:bg-white print:p-0 print:m-0 print:text-black print:overflow-visible">
          <div id="printable-debt-container" className="bg-slate-900 print:bg-white text-slate-100 print:text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-800 print:border-none space-y-6 print:space-y-3.5 print:p-0 print:m-0">

            {/* Cabeçalho do Extrato */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 print:border-slate-300 pb-6 print:pb-2.5 print-avoid-break">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 print:bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                    F
                  </div>
                  <span className="font-bold text-sm text-slate-100 print:text-slate-900 tracking-tight">FinPlan</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-400 print:text-indigo-900">
                  Extrato de Contas e Pendências
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                  Gerado em {formatDate(new Date())} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-400 print:text-slate-500 font-medium uppercase tracking-wider">Conta / Contato</p>
                <p className="text-lg font-bold text-slate-100 print:text-slate-900">{account.name}</p>
                {account.phone && <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">{account.phone}</p>}
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="grid grid-cols-3 gap-3 p-4 print:p-2.5 rounded-xl bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 print-avoid-break">
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">A Receber Pendente</p>
                <p className="text-sm sm:text-lg font-bold text-emerald-400 print:text-emerald-700 tabular-nums">
                  {formatCurrency(receivable)}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">A Pagar Pendente</p>
                <p className="text-sm sm:text-lg font-bold text-rose-400 print:text-rose-700 tabular-nums">
                  {formatCurrency(payable)}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">Saldo Líquido</p>
                <p className={`text-sm sm:text-lg font-bold tabular-nums ${
                  balance > 0 ? 'text-emerald-400 print:text-emerald-700' : balance < 0 ? 'text-rose-400 print:text-rose-700' : 'text-slate-300 print:text-slate-700'
                }`}>
                  {balance > 0 ? `+${formatCurrency(balance)}` : formatCurrency(balance)}
                </p>
              </div>
            </div>

            {/* Tabela de Pendências Abertas */}
            <div className="space-y-3 print:space-y-1.5">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-400 print:text-amber-800 flex items-center justify-between print-avoid-break">
                <span>Pendências em Aberto ({pendingItems.length})</span>
              </h2>

              {pendingItems.length === 0 ? (
                <p className="text-xs text-slate-500 print:text-slate-500 py-3 print:py-1.5 italic">Nenhuma pendência em aberto.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Data</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Tipo</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Prazo / Vencimento</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {pendingItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-200 print:text-slate-900">
                            {item.description}
                            {item.installmentTotal && (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-950/80 text-violet-300 print:bg-slate-200 print:text-slate-800">
                                {item.installmentNumber}/{item.installmentTotal}x
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.type === 'receivable'
                                ? 'bg-emerald-950/80 text-emerald-300 print:bg-emerald-100 print:text-emerald-800'
                                : 'bg-rose-950/80 text-rose-300 print:bg-rose-100 print:text-rose-800'
                            }`}>
                              {item.type === 'receivable' ? 'A Receber' : 'A Pagar'}
                            </span>
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                            {item.dueDate ? formatDate(item.dueDate) : '—'}
                          </td>
                          <td className={`py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                            item.type === 'receivable' ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'
                          }`}>
                            {item.type === 'receivable' ? '+' : '-'}{formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Histórico de Itens Liquidados / Pagos */}
            {settledItems.length > 0 && (
              <div className="space-y-3 print:space-y-1.5 pt-4 print:pt-2 border-t border-slate-800 print:border-slate-300">
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400 print:text-slate-700 print-avoid-break">
                  Histórico de Itens Quitados ({settledItems.length})
                </h2>

                <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-slate-300">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Tipo</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Quitado em</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {settledItems.map(item => (
                        <tr key={item.id} className="print-avoid-break">
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 line-through">
                            {item.description}
                            {item.installmentTotal && ` (${item.installmentNumber}/${item.installmentTotal}x)`}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600">{item.type === 'receivable' ? 'A Receber' : 'A Pagar'}</td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600">{item.settledDate ? formatDate(item.settledDate) : '—'}</td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-medium text-slate-400 print:text-slate-700 tabular-nums">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Assinatura / Rodapé */}
            <div className="pt-8 print:pt-3 border-t border-slate-800 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 print:text-slate-600 gap-4 print:gap-1 print-avoid-break">
              <p>FinPlan — Gestão Financeira Pessoal e Familiar</p>
              <p>Documento gerado automaticamente para conferência de dívidas e acertos.</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
