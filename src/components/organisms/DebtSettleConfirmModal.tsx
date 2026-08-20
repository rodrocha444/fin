// src/components/organisms/DebtSettleConfirmModal.tsx — Modal de confirmação para quitação de pendência / parcela
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import Modal from '@/components/atoms/Modal'
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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="md"
      icon={
        isSettling ? (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center">
            <RotateCcw className="w-4 h-4" />
          </div>
        )
      }
      title={isSettling ? 'Confirmar Quitação' : 'Reabrir Pendência'}
      description={accountName}
    >
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
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isReceivable
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                }`}
              >
                {isReceivable ? 'A Receber' : 'A Pagar'}
              </span>
            </div>
            {item.notes && <p className="text-xs text-slate-500 mt-1 italic">{item.notes}</p>}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400">Valor da parcela/item:</span>
            <span
              className={`text-base font-bold tabular-nums ${
                isReceivable ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isReceivable ? '+' : '-'}{formatCurrency(item.amount)}
            </span>
          </div>

          {item.totalAmount && item.installmentTotal && item.installmentTotal > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total parcelado ({item.installmentTotal}x):</span>
              <span className="font-medium text-slate-400 tabular-nums">
                {formatCurrency(item.totalAmount)}
              </span>
            </div>
          )}

          {item.dueDate && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Vencimento:</span>
              <span className="font-medium text-slate-300">{formatDate(item.dueDate)}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {isSettling ? (
            <>
              Confirmar que este valor de{' '}
              <strong className="text-slate-200 font-semibold">{formatCurrency(item.amount)}</strong> foi{' '}
              {isReceivable ? 'recebido' : 'pago'}? A pendência sairá do saldo em aberto.
            </>
          ) : (
            <>
              Deseja reabrir esta pendência? Ela voltará para a lista de itens pendentes e somará novamente no saldo.
            </>
          )}
        </p>

        {/* Botões */}
        <div className="flex gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-xs font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm()
              onClose()
            }}
            className={`btn-primary flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md ${
              isSettling
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-emerald-950/30'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 shadow-indigo-950/30'
            }`}
          >
            {isSettling ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Quitação</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Reabrir Pendência</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
