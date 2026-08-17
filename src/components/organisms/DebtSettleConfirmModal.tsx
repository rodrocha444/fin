// src/components/organisms/DebtSettleConfirmModal.tsx — Modal de confirmação para quitação de pendência / parcela
import { CheckCircle2, RotateCcw, X, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import Badge from '@/components/atoms/Badge'
import type { DebtItem } from '@/types'

interface DebtSettleConfirmModalProps {
  item: DebtItem
  accountName: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function DebtSettleConfirmModal({
  item,
  accountName,
  onClose,
  onConfirm,
}: DebtSettleConfirmModalProps) {
  const isSettling = item.status === 'pending'
  const isReceivable = item.type === 'receivable'

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl sheet-up sm:fade-in flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {isSettling ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="font-semibold text-slate-100 text-base">
                {isSettling ? 'Confirmar Quitação' : 'Reabrir Pendência'}
              </h2>
              <p className="text-xs text-slate-400">
                {accountName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Detalhes da Pendência */}
        <div className="p-5 space-y-4">
          <div className="card !p-4 bg-slate-950/60 border-slate-800 space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-slate-200">{item.description}</p>
                {item.installmentTotal && (
                  <Badge variant="violet">
                    {item.installmentNumber}/{item.installmentTotal}x
                  </Badge>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isReceivable
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                }`}>
                  {isReceivable ? 'A Receber' : 'A Pagar'}
                </span>
              </div>
              {item.notes && <p className="text-xs text-slate-500 mt-1 italic">{item.notes}</p>}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400">Valor da parcela/item:</span>
              <span className={`text-base font-bold tabular-nums ${
                isReceivable ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isReceivable ? '+' : '-'}{formatCurrency(item.amount)}
              </span>
            </div>

            {item.totalAmount && item.installmentTotal && item.installmentTotal > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total parcelado ({item.installmentTotal}x):</span>
                <span className="font-medium text-slate-400 tabular-nums">{formatCurrency(item.totalAmount)}</span>
              </div>
            )}

            {item.dueDate && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Data de vencimento:</span>
                <span className="text-slate-300">{formatDate(item.dueDate)}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed text-center px-2">
            {isSettling
              ? isReceivable
                ? `Deseja confirmar que você recebeu o valor de ${formatCurrency(item.amount)} de ${accountName}?`
                : `Deseja confirmar que você pagou/reembolsou o valor de ${formatCurrency(item.amount)} para ${accountName}?`
              : `Deseja reabrir esta parcela/pendência para o status em aberto?`}
          </p>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-3"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await onConfirm()
                onClose()
              }}
              className={`flex-1 py-3 font-semibold rounded-xl text-white transition-all duration-200 active:scale-95 text-sm flex items-center justify-center gap-1.5 shadow-lg ${
                isSettling
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/30'
              }`}
            >
              {isSettling ? <CheckCircle2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
              <span>{isSettling ? 'Confirmar Quitação' : 'Confirmar Reabertura'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
