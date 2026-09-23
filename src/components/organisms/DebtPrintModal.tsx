import { useState, useMemo } from 'react'
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

type InstallmentGroup = {
  kind: 'group'
  groupId: string
  description: string
  type: DebtItem['type']
  totalInstallments: number
  settledCount: number
  pendingCount: number
  totalAmount: number
  pendingAmount: number
  settledAmount: number
  perInstallmentAmount: number
  nextDueDate?: Date
  pendingItems: DebtItem[]
  settledItems: DebtItem[]
  items: DebtItem[]
}

type SingleEntry = { kind: 'single'; item: DebtItem }
type PrintEntry = SingleEntry | InstallmentGroup

function buildGroupedEntries(items: DebtItem[]): PrintEntry[] {
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
    const sorted = [...groupItems].sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0))
    const rep = sorted[0]
    const pendingItems = sorted.filter(i => i.status === 'pending')
    const settledItems = sorted.filter(i => i.status === 'settled')
    const nextDue = pendingItems
      .filter(i => i.dueDate)
      .map(i => new Date(i.dueDate!))
      .sort((a, b) => a.getTime() - b.getTime())[0]

    entries.push({
      kind: 'group',
      groupId,
      description: rep.description.replace(/\s*\(\d+\/\d+\)$/, '').trim(),
      type: rep.type,
      totalInstallments: rep.installmentTotal ?? groupItems.length,
      settledCount: settledItems.length,
      pendingCount: pendingItems.length,
      totalAmount: groupItems.reduce((s, i) => s + i.amount, 0),
      pendingAmount: pendingItems.reduce((s, i) => s + i.amount, 0),
      settledAmount: settledItems.reduce((s, i) => s + i.amount, 0),
      perInstallmentAmount: rep.amount,
      nextDueDate: nextDue,
      pendingItems,
      settledItems,
      items: sorted,
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
  const [detailedInstallments, setDetailedInstallments] = useState(true)

  const hasInstallments = useMemo(() => {
    return items.some(i => !!i.installmentGroupId || ((i.installmentTotal ?? 0) > 1))
  }, [items])

  const settledCount = useMemo(() => {
    return items.filter(i => i.status === 'settled').length
  }, [items])

  const detailedPendingItems = useMemo(() => {
    return items
      .filter(i => i.status === 'pending')
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        }
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0)
      })
  }, [items])

  const detailedSettledItems = useMemo(() => {
    return items
      .filter(i => i.status === 'settled')
      .sort((a, b) => {
        const dateA = a.settledDate || a.dueDate || a.createdAt
        const dateB = b.settledDate || b.dueDate || b.createdAt
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
  }, [items])

  const groupedEntries = useMemo(() => buildGroupedEntries(items), [items])

  const pendingGroupedEntries = useMemo(() => {
    return groupedEntries
      .filter(e => (e.kind === 'single' ? e.item.status === 'pending' : e.pendingCount > 0))
      .sort((a, b) => {
        const dateA = a.kind === 'single' ? a.item.dueDate : a.nextDueDate
        const dateB = b.kind === 'single' ? b.item.dueDate : b.nextDueDate
        if (dateA && dateB) return new Date(dateA).getTime() - new Date(dateB).getTime()
        if (dateA) return -1
        if (dateB) return 1
        return 0
      })
  }, [groupedEntries])

  const settledGroupedEntries = useMemo(() => {
    return groupedEntries.filter(e =>
      e.kind === 'single' ? e.item.status === 'settled' : e.settledCount > 0
    )
  }, [groupedEntries])

  // Ótica do destinatário (responsável pela conta):
  // O que é 'receivable' no Fin = dinheiro a receber de 'account', logo é 'A Pagar' pelo destinatário.
  // O que é 'payable' no Fin = dinheiro a pagar a 'account', logo é 'A Receber' pelo destinatário.
  const hasToPay = receivable > 0.005
  const hasToReceive = payable > 0.005

  const pendingTotal = detailedPendingItems.reduce((acc, item) => acc + item.amount, 0)
  const settledTotal = detailedSettledItems.reduce((acc, item) => acc + item.amount, 0)

  const handlePrint = () => window.print()

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="full"
      title="Extrato de Contas"
      description="Visualização e impressão de contas a receber e pagar"
      headerRight={
        <div className="flex items-center gap-3">
          {hasInstallments && (
            <label className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={detailedInstallments}
                onChange={e => setDetailedInstallments(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Detalhar parcelas</span>
            </label>
          )}
          {settledCount > 0 && (
            <label className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={includeSettled}
                onChange={e => setIncludeSettled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Incluir quitados ({settledCount})</span>
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
      {/* Controles mobile para visualização */}
      {(hasInstallments || settledCount > 0) && (
        <div className="sm:hidden flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 rounded-xl border border-slate-800 print:hidden mb-4">
          {hasInstallments && (
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={detailedInstallments}
                onChange={e => setDetailedInstallments(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 w-4 h-4"
              />
              <span>Detalhar parcelas</span>
            </label>
          )}
          {settledCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={includeSettled}
                onChange={e => setIncludeSettled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 w-4 h-4"
              />
              <span>Incluir quitados ({settledCount})</span>
            </label>
          )}
        </div>
      )}

      <div
        id="printable-debt-container"
        className="bg-slate-900 print:bg-white text-slate-100 print:text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-800 print:border-none space-y-5 print:space-y-3.5 print:p-0 print:m-0"
      >
        {/* Cabeçalho do Extrato */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-800 print:border-slate-300 pb-4 print:pb-2.5 print-avoid-break">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-indigo-400 print:text-indigo-900">
              Contas a Receber e Pagar
            </h1>
            <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
              Emissão: {formatDate(new Date())}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-base font-bold text-slate-100 print:text-slate-900">{account.name}</p>
            {account.phone && (
              <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5">Tel: {account.phone}</p>
            )}
          </div>
        </div>

        {/* Resumo financeiro discreto na ótica do destinatário */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 py-2.5 px-3.5 rounded-lg bg-slate-950/60 print:bg-slate-50 border border-slate-800/80 print:border-slate-200 text-xs print-avoid-break">
          <div className="flex items-center gap-5 flex-wrap">
            {hasToPay && (
              <span className="text-slate-400 print:text-slate-600">
                A Pagar:{' '}
                <strong className="text-rose-400 print:text-rose-700 font-bold tabular-nums">
                  {formatCurrency(receivable)}
                </strong>
              </span>
            )}
            {hasToReceive && (
              <span className="text-slate-400 print:text-slate-600">
                A Receber:{' '}
                <strong className="text-emerald-400 print:text-emerald-700 font-bold tabular-nums">
                  {formatCurrency(payable)}
                </strong>
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-slate-400 print:text-slate-600">
              Saldo:{' '}
              <strong
                className={`font-bold tabular-nums ${
                  balance > 0.005
                    ? 'text-rose-400 print:text-rose-700'
                    : balance < -0.005
                    ? 'text-emerald-400 print:text-emerald-700'
                    : 'text-slate-200 print:text-slate-800'
                }`}
              >
                {balance > 0.005
                  ? `${formatCurrency(balance)} a pagar`
                  : balance < -0.005
                  ? `${formatCurrency(Math.abs(balance))} a receber`
                  : 'Quitado'}
              </strong>
            </span>
          </div>
        </div>

        {/* Pendências em Aberto */}
        <div className="space-y-2.5 print:space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 print:text-indigo-900 print-avoid-break">
            Pendências em Aberto ({detailedInstallments ? detailedPendingItems.length : pendingGroupedEntries.length})
          </h2>

          {(detailedInstallments ? detailedPendingItems.length : pendingGroupedEntries.length) === 0 ? (
            <p className="text-xs text-slate-500 py-3 print:py-1.5 italic">
              Nenhuma pendência em aberto no momento.
            </p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible rounded-xl print:rounded-none border border-slate-800 print:border-slate-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Parcela</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Vencimento</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Tipo</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {detailedInstallments
                    ? detailedPendingItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-200 print:text-slate-900">
                            {item.description}
                            {item.notes && (
                              <span className="block text-[10px] text-slate-500 print:text-slate-500 font-normal">
                                {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 whitespace-nowrap">
                            {item.installmentTotal && item.installmentTotal > 1 ? (
                              <span className="font-semibold text-indigo-300 print:text-indigo-900">
                                {item.installmentNumber || 1}/{item.installmentTotal}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                            {item.dueDate ? formatDate(item.dueDate) : 'A combinar'}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                item.type === 'receivable'
                                  ? 'bg-rose-950/60 print:bg-rose-50 text-rose-300 print:text-rose-800 border-rose-800/40 print:border-rose-300'
                                  : 'bg-emerald-950/60 print:bg-emerald-50 text-emerald-300 print:text-emerald-800 border-emerald-800/40 print:border-emerald-300'
                              }`}
                            >
                              {item.type === 'receivable' ? 'A Pagar' : 'A Receber'}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                              item.type === 'receivable'
                                ? 'text-rose-400 print:text-rose-700'
                                : 'text-emerald-400 print:text-emerald-700'
                            }`}
                          >
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))
                    : pendingGroupedEntries.map(entry => {
                        if (entry.kind === 'single') {
                          const { item } = entry
                          return (
                            <tr key={item.id} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-200 print:text-slate-900">
                                {item.description}
                                {item.notes && (
                                  <span className="block text-[10px] text-slate-500 print:text-slate-500 font-normal">
                                    {item.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 whitespace-nowrap">
                                {item.installmentTotal && item.installmentTotal > 1 ? (
                                  <span className="font-semibold text-indigo-300 print:text-indigo-900">
                                    {item.installmentNumber || 1}/{item.installmentTotal}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                                {item.dueDate ? formatDate(item.dueDate) : 'A combinar'}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    item.type === 'receivable'
                                      ? 'bg-rose-950/60 print:bg-rose-50 text-rose-300 print:text-rose-800 border-rose-800/40 print:border-rose-300'
                                      : 'bg-emerald-950/60 print:bg-emerald-50 text-emerald-300 print:text-emerald-800 border-emerald-800/40 print:border-emerald-300'
                                  }`}
                                >
                                  {item.type === 'receivable' ? 'A Pagar' : 'A Receber'}
                                </span>
                              </td>
                              <td
                                className={`py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                                  item.type === 'receivable'
                                    ? 'text-rose-400 print:text-rose-700'
                                    : 'text-emerald-400 print:text-emerald-700'
                                }`}
                              >
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          )
                        }

                        const pendingNums = entry.pendingItems.map(i => i.installmentNumber ?? 0).filter(Boolean)
                        const firstNum = pendingNums[0]
                        const lastNum = pendingNums[pendingNums.length - 1]
                        const parcelLabel =
                          entry.pendingCount === 1
                            ? `Parc. ${firstNum}/${entry.totalInstallments}`
                            : `${entry.pendingCount}x de ${formatCurrency(entry.perInstallmentAmount)} (${firstNum} a ${lastNum}/${entry.totalInstallments})`

                        return (
                          <tr key={entry.groupId} className="hover:bg-slate-800/30 print:hover:bg-transparent print-avoid-break">
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 font-medium text-slate-200 print:text-slate-900">
                              {entry.description}
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 whitespace-nowrap">
                              <span className="font-semibold text-indigo-300 print:text-indigo-900">
                                {parcelLabel}
                              </span>
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                              {entry.nextDueDate ? formatDate(entry.nextDueDate) : 'A combinar'}
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  entry.type === 'receivable'
                                    ? 'bg-rose-950/60 print:bg-rose-50 text-rose-300 print:text-rose-800 border-rose-800/40 print:border-rose-300'
                                    : 'bg-emerald-950/60 print:bg-emerald-50 text-emerald-300 print:text-emerald-800 border-emerald-800/40 print:border-emerald-300'
                                }`}
                              >
                                {entry.type === 'receivable' ? 'A Pagar' : 'A Receber'}
                              </span>
                            </td>
                            <td
                              className={`py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                                entry.type === 'receivable'
                                  ? 'text-rose-400 print:text-rose-700'
                                  : 'text-emerald-400 print:text-emerald-700'
                              }`}
                            >
                              {formatCurrency(entry.pendingAmount)}
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 print:border-slate-300 text-xs font-semibold text-slate-300 print:text-slate-800">
                    <td colSpan={4} className="py-2 px-3 print:py-1.5 print:px-2.5 text-right text-slate-400 print:text-slate-600">
                      Total Pendente:
                    </td>
                    <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums text-slate-100 print:text-slate-900">
                      {formatCurrency(pendingTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Histórico de Itens Quitados */}
        {includeSettled && settledCount > 0 && (
          <div className="space-y-2.5 print:space-y-1.5 pt-3 print:pt-2 border-t border-slate-800 print:border-slate-300">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-700 print-avoid-break">
              Itens Quitados ({detailedInstallments ? detailedSettledItems.length : settledGroupedEntries.length})
            </h2>

            <div className="overflow-x-auto print:overflow-visible rounded-xl print:rounded-none border border-slate-800 print:border-slate-300">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-400 print:text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Descrição</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Parcela</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Vencimento / Pgto</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5">Tipo</th>
                    <th className="py-2.5 px-3 print:py-1.5 print:px-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {detailedInstallments
                    ? detailedSettledItems.map(item => (
                        <tr key={item.id} className="print-avoid-break opacity-75">
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 line-through">
                            {item.description}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                            {item.installmentTotal && item.installmentTotal > 1
                              ? `${item.installmentNumber || 1}/${item.installmentTotal}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                            {item.settledDate ? formatDate(item.settledDate) : item.dueDate ? formatDate(item.dueDate) : '—'}
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                item.type === 'receivable'
                                  ? 'bg-rose-950/40 print:bg-rose-50/70 text-rose-400 print:text-rose-800 border-rose-800/30 print:border-rose-200'
                                  : 'bg-emerald-950/40 print:bg-emerald-50/70 text-emerald-400 print:text-emerald-800 border-emerald-800/30 print:border-emerald-200'
                              }`}
                            >
                              {item.type === 'receivable' ? 'Pago' : 'Recebido'}
                            </span>
                          </td>
                          <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-medium text-slate-400 print:text-slate-600 tabular-nums whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))
                    : settledGroupedEntries.map(entry => {
                        if (entry.kind === 'single') {
                          const { item } = entry
                          return (
                            <tr key={item.id} className="print-avoid-break opacity-75">
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 line-through">
                                {item.description}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                                {item.installmentTotal && item.installmentTotal > 1
                                  ? `${item.installmentNumber || 1}/${item.installmentTotal}`
                                  : '—'}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                                {item.settledDate ? formatDate(item.settledDate) : item.dueDate ? formatDate(item.dueDate) : '—'}
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    item.type === 'receivable'
                                      ? 'bg-rose-950/40 print:bg-rose-50/70 text-rose-400 print:text-rose-800 border-rose-800/30 print:border-rose-200'
                                      : 'bg-emerald-950/40 print:bg-emerald-50/70 text-emerald-400 print:text-emerald-800 border-emerald-800/30 print:border-emerald-200'
                                  }`}
                                >
                                  {item.type === 'receivable' ? 'Pago' : 'Recebido'}
                                </span>
                              </td>
                              <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-medium text-slate-400 print:text-slate-600 tabular-nums whitespace-nowrap">
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          )
                        }

                        const settledNums = entry.settledItems.map(i => i.installmentNumber ?? 0).filter(Boolean)
                        const firstNum = settledNums[0]
                        const lastNum = settledNums[settledNums.length - 1]
                        const parcelLabel =
                          entry.settledCount === 1
                            ? `Parc. ${firstNum}/${entry.totalInstallments}`
                            : `${entry.settledCount}x de ${formatCurrency(entry.perInstallmentAmount)} (${firstNum} a ${lastNum}/${entry.totalInstallments})`

                        return (
                          <tr key={entry.groupId} className="print-avoid-break opacity-75">
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-700 line-through">
                              {entry.description}
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                              {parcelLabel}
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-slate-400 print:text-slate-600 whitespace-nowrap">
                              —
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  entry.type === 'receivable'
                                    ? 'bg-rose-950/40 print:bg-rose-50/70 text-rose-400 print:text-rose-800 border-rose-800/30 print:border-rose-200'
                                    : 'bg-emerald-950/40 print:bg-emerald-50/70 text-emerald-400 print:text-emerald-800 border-emerald-800/30 print:border-emerald-200'
                                }`}
                              >
                                {entry.type === 'receivable' ? 'Pago' : 'Recebido'}
                              </span>
                            </td>
                            <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-medium text-slate-400 print:text-slate-600 tabular-nums whitespace-nowrap">
                              {formatCurrency(entry.settledAmount)}
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 print:border-slate-300 text-xs font-semibold text-slate-300 print:text-slate-800">
                    <td colSpan={4} className="py-2 px-3 print:py-1.5 print:px-2.5 text-right text-slate-400 print:text-slate-600">
                      Total Quitado:
                    </td>
                    <td className="py-2 px-3 print:py-1.5 print:px-2.5 text-right font-bold tabular-nums text-slate-400 print:text-slate-700">
                      {formatCurrency(settledTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="pt-4 print:pt-2 border-t border-slate-800 print:border-slate-300 flex items-center justify-between text-[11px] text-slate-500 print:text-slate-600 print-avoid-break">
          <p>Extrato emitido para simples conferência.</p>
          <p className="font-medium">Fin</p>
        </div>
      </div>
    </Modal>
  )
}
