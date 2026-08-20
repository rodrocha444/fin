import { useState } from 'react'
import { Printer } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import Modal from '@/components/atoms/Modal'
import type { DebtAccount, DebtItem } from '@/types'

interface DebtPrintModalProps {
  account: DebtAccount
  items: DebtItem[]
  receivable: number
  payable: number
  balance: number
  onClose: () => void
}

// ── Tipos para agrupamento ───────────────────────────────────
type InstallmentGroup = {
  kind: 'group'
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
type SingleEntry = { kind: 'single'; item: DebtItem }
type PrintEntry = SingleEntry | InstallmentGroup

/** Agrupa itens parcelados (installmentGroupId) em entradas únicas */
function buildPrintEntries(items: DebtItem[]): PrintEntry[] {
  const groupMap = new Map<string, DebtItem[]>()
  const singles: DebtItem[] = []

  for (const item of items) {
    if (item.installmentGroupId) {
      const arr = groupMap.get(item.installmentGroupId) ?? []
      arr.push(item)
      groupMap.set(item.installmentGroupId, arr)
    } else {
      singles.push(item)
    }
  }

  const entries: PrintEntry[] = singles.map(item => ({ kind: 'single', item }))

  for (const [groupId, groupItems] of groupMap) {
    const rep = groupItems[0]
    const settledCount = groupItems.filter(i => i.status === 'settled').length
    const pendingCount = groupItems.filter(i => i.status === 'pending').length
    const nextDue = groupItems
      .filter(i => i.status === 'pending' && i.dueDate)
      .map(i => new Date(i.dueDate!))
      .sort((a, b) => a.getTime() - b.getTime())[0]

    entries.push({
      kind: 'group',
      groupId,
      description: rep.description.replace(/\s*\(\d+\/\d+\)$/, '').trim(),
      type: rep.type,
      totalInstallments: rep.installmentTotal ?? groupItems.length,
      settledCount,
      pendingCount,
      totalAmount: groupItems.reduce((s, i) => s + i.amount, 0),
      perInstallmentAmount: rep.amount,
      nextDueDate: nextDue,
      items: [...groupItems].sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0)),
    })
  }

  return entries
}

export default function DebtPrintModal({
  account,
  items,
  receivable,
  payable,
  balance,
  onClose,
}: DebtPrintModalProps) {
  const [includeSettled, setIncludeSettled] = useState(false)

  const allEntries = buildPrintEntries(items)
  const pendingEntries = allEntries.filter(e =>
    e.kind === 'single' ? e.item.status === 'pending' : e.pendingCount > 0
  )
  const settledEntries = allEntries.filter(e =>
    e.kind === 'single' ? e.item.status === 'settled' : e.settledCount > 0 && e.pendingCount === 0
  )

  const handlePrint = () => window.print()

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="full"
      title="Extrato / Relatório em PDF"
      description="Visualize e imprima o extrato de pendências"
      headerRight={
        <div className="flex items-center gap-3">
          {settledEntries.length > 0 && (
            <label className="hidden sm:flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={includeSettled}
                onChange={e => setIncludeSettled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Incluir quitados ({settledEntries.length})</span>
            </label>
          )}
          <button
            onClick={handlePrint}
            className="btn-primary py-2 px-3 sm:px-3.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-indigo-600/30 mr-1"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            <span className="sm:hidden">Imprimir</span>
          </button>
        </div>
      }
      contentClassName="bg-slate-950 p-4 sm:p-8 print:bg-white print:p-0 print:m-0 print:text-black print:overflow-visible"
    >
      <div id="printable-debt-container" className="bg-slate-900 print:bg-white text-slate-100 print:text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-800 print:border-none space-y-6 print:space-y-3.5 print:p-0 print:m-0">

            {/* Controle mobile para incluir quitados na tela */}
            {settledEntries.length > 0 && (
              <div className="sm:hidden flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800 print:hidden">
                <span className="text-xs text-slate-400">Incluir histórico de quitados</span>
                <input
                  type="checkbox"
                  checked={includeSettled}
                  onChange={e => setIncludeSettled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 w-4 h-4"
                />
              </div>
            )}

            {/* Cabeçalho do Extrato */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 print:border-slate-300 pb-6 print:pb-3 print-avoid-break">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">F</div>
                  <span className="font-bold text-sm text-slate-100 print:text-slate-900 tracking-tight">FinPlan</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-400 print:text-indigo-900">
                  Demonstrativo de Acerto de Contas
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                  Emitido em {formatDate(new Date())} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-400 print:text-slate-500 font-medium uppercase tracking-wider">Destinatário</p>
                <p className="text-lg font-bold text-slate-100 print:text-slate-900">{account.name}</p>
                {account.phone && <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">Tel: {account.phone}</p>}
              </div>
            </div>

            {/* Resumo Financeiro na Ótica do Destinatário */}
            <div className="grid grid-cols-3 gap-3 p-4 print:p-2.5 rounded-xl bg-slate-950/80 print:bg-slate-50 border border-slate-800 print:border-slate-300 print-avoid-break">
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">A Pagar por Você</p>
                <p className="text-sm sm:text-lg font-bold text-rose-400 print:text-rose-700 tabular-nums">{formatCurrency(receivable)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">A seu Favor (Créditos)</p>
                <p className="text-sm sm:text-lg font-bold text-emerald-400 print:text-emerald-700 tabular-nums">{formatCurrency(payable)}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500 print:text-slate-600 font-medium">Saldo do Acerto</p>
                <p className={`text-sm sm:text-lg font-bold tabular-nums ${
                  balance > 0 ? 'text-rose-400 print:text-rose-700'
                  : balance < 0 ? 'text-emerald-400 print:text-emerald-700'
                  : 'text-slate-300 print:text-slate-700'
                }`}>
                  {balance > 0
                    ? `${formatCurrency(balance)} (a pagar)`
                    : balance < 0
                    ? `${formatCurrency(Math.abs(balance))} (a seu favor)`
                    : 'Em dia (R$ 0,00)'}
                </p>
              </div>
            </div>

            {/* Pendências em Aberto */}
            <div className="space-y-3 print:space-y-1.5">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-400 print:text-slate-800 print-avoid-break">
                Pendências em Aberto ({pendingEntries.length})
              </h2>

              {pendingEntries.length === 0 ? (
                <p className="text-xs text-slate-500 print:text-slate-500 py-3 print:py-1.5 italic">Nenhuma pendência em aberto no momento.</p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible rounded-xl print:rounded-none border border-slate-800 print:border-slate-300">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Natureza</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Parcelas</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Próx. Venc.</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5 text-right">Valor Pendente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {pendingEntries.map(entry => {
                        if (entry.kind === 'single') {
                          const { item } = entry
                          const hasInstallment = !!(item.installmentTotal && item.installmentTotal > 1)
                          return (
                            <tr key={item.id} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-200 print:text-slate-900">{item.description}</td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  item.type === 'receivable'
                                    ? 'bg-rose-950/80 text-rose-300 print:bg-rose-100 print:text-rose-800'
                                    : 'bg-emerald-950/80 text-emerald-300 print:bg-emerald-100 print:text-emerald-800'
                                }`}>
                                  {item.type === 'receivable' ? 'A Pagar por você' : 'A seu favor'}
                                </span>
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                                {hasInstallment ? (
                                  <div>
                                    <span>{item.installmentNumber || 1}/{item.installmentTotal}</span>
                                    <span className="text-[10px] block text-slate-500 print:text-slate-600 font-medium">
                                      {formatCurrency(item.amount)}/parc.
                                    </span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                                {item.dueDate ? formatDate(item.dueDate) : 'A combinar'}
                              </td>
                              <td className={`py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                                item.type === 'receivable' ? 'text-rose-400 print:text-rose-700' : 'text-emerald-400 print:text-emerald-700'
                              }`}>
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          )
                        }

                        // Grupo de parcelas
                        const pendingAmount = entry.items
                          .filter(i => i.status === 'pending')
                          .reduce((s, i) => s + i.amount, 0)
                        return (
                          <tr key={entry.groupId} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-200 print:text-slate-900">
                              {entry.description}
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                entry.type === 'receivable'
                                  ? 'bg-rose-950/80 text-rose-300 print:bg-rose-100 print:text-rose-800'
                                  : 'bg-emerald-950/80 text-emerald-300 print:bg-emerald-100 print:text-emerald-800'
                              }`}>
                                {entry.type === 'receivable' ? 'A Pagar por você' : 'A seu favor'}
                              </span>
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                              <div>
                                <span>{entry.settledCount}/{entry.totalInstallments} pagas</span>
                              </div>
                              <div className="text-[10px] text-slate-500 print:text-slate-600 font-medium tabular-nums">
                                {formatCurrency(entry.perInstallmentAmount)}/parcela
                              </div>
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                              {entry.nextDueDate ? formatDate(entry.nextDueDate) : 'A combinar'}
                            </td>
                            <td className={`py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                              entry.type === 'receivable' ? 'text-rose-400 print:text-rose-700' : 'text-emerald-400 print:text-emerald-700'
                            }`}>
                              <div>{formatCurrency(pendingAmount)}</div>
                              {entry.totalAmount !== pendingAmount && (
                                <div className="text-[10px] font-normal text-slate-500 print:text-slate-600">
                                  Total: {formatCurrency(entry.totalAmount)}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Histórico de Itens Liquidados (Oculto por padrão, ativado sob demanda) */}
            {includeSettled && settledEntries.length > 0 && (
              <div className="space-y-3 print:space-y-1.5 pt-4 print:pt-2 border-t border-slate-800 print:border-slate-300">
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400 print:text-slate-700 print-avoid-break">
                  Histórico de Itens já Quitados ({settledEntries.length})
                </h2>

                <div className="overflow-x-auto print:overflow-visible rounded-xl print:rounded-none border border-slate-800 print:border-slate-300">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Natureza</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Parcelas</th>
                        <th className="py-2.5 px-3 print:py-1.5 print:px-2.5 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {settledEntries.map(entry => {
                        if (entry.kind === 'single') {
                          const { item } = entry
                          const hasInstallment = !!(item.installmentTotal && item.installmentTotal > 1)
                          return (
                            <tr key={item.id} className="print-avoid-break">
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 line-through">{item.description}</td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600">
                                {item.type === 'receivable' ? 'Pago por você' : 'Recebido por você'}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                                {hasInstallment ? (
                                  <div>
                                    <span>{item.installmentNumber || 1}/{item.installmentTotal}</span>
                                    <span className="text-[10px] block text-slate-500 print:text-slate-600 font-medium">
                                      {formatCurrency(item.amount)}/parc.
                                    </span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-medium text-slate-400 print:text-slate-700 tabular-nums">
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          )
                        }

                        // Grupo totalmente quitado
                        return (
                          <tr key={entry.groupId} className="print-avoid-break">
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 line-through">{entry.description}</td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600">
                              {entry.type === 'receivable' ? 'Pago por você' : 'Recebido por você'}
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                              <div>{entry.totalInstallments}/{entry.totalInstallments} pagas</div>
                              <div className="text-[10px] text-slate-500 print:text-slate-600 font-medium tabular-nums">
                                {formatCurrency(entry.perInstallmentAmount)}/parcela
                              </div>
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-medium text-slate-400 print:text-slate-700 tabular-nums">
                              {formatCurrency(entry.totalAmount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rodapé */}
            <div className="pt-8 print:pt-3 border-t border-slate-800 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 print:text-slate-600 gap-2 print-avoid-break">
              <p>Demonstrativo para conferência e acerto mútuo.</p>
              <p className="font-medium">FinPlan</p>
            </div>
          </div>
    </Modal>
  )
}

