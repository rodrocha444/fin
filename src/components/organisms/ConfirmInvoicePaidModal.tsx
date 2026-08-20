// src/components/organisms/ConfirmInvoicePaidModal.tsx — Modal de confirmação para marcar/desmarcar fatura como paga
import { useState } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import Modal from '@/components/atoms/Modal'
import type { Account } from '@/types'
import type { InvoiceData } from '@/utils/invoices'

interface ConfirmInvoicePaidModalProps {
  account: Account
  invoiceData: InvoiceData
  targetStatus: boolean // true = marcar como paga, false = desmarcar
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export default function ConfirmInvoicePaidModal({
  account,
  invoiceData,
  targetStatus,
  onConfirm,
  onClose,
}: ConfirmInvoicePaidModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { cycle, totalAmount } = invoiceData

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true)
      await onConfirm()
      onClose()
    } catch (err) {
      console.error('Erro ao atualizar status da fatura:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={isSubmitting ? () => {} : onClose}
      size="md"
      icon={
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            targetStatus
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}
        >
          {targetStatus ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
        </div>
      }
      title={targetStatus ? 'Confirmar Pagamento' : 'Desmarcar Pagamento'}
      description={targetStatus ? 'Marcar fatura como quitada' : 'Voltar fatura para pendente'}
    >
      <div className="p-4 sm:p-5 space-y-4">
        <div
          className="rounded-xl p-4 border relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${account.color}15 0%, rgba(15,23,42,0.8) 100%)`,
            borderColor: account.color + '40',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: account.color }}
              />
              <span className="text-xs font-semibold text-slate-200 truncate">{account.name}</span>
            </div>
            <span className="text-xs font-bold text-slate-300 capitalize">
              Fatura {cycle.label}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xs text-slate-400 font-medium">Valor Total:</span>
            <span className="text-xl font-extrabold text-slate-100 tabular-nums">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700/40 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div>
              <span>Fechamento: </span>
              <strong className="text-slate-300">{formatDate(cycle.closingDate)}</strong>
            </div>
            <div className="text-right">
              <span>Vencimento: </span>
              <strong className="text-slate-300">{formatDate(cycle.dueDate)}</strong>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {targetStatus ? (
            <>
              Deseja marcar esta fatura de{' '}
              <strong className="text-emerald-400 font-semibold">{formatCurrency(totalAmount)}</strong> como{' '}
              <strong>paga</strong>? O status será atualizado no aplicativo.
            </>
          ) : (
            <>
              Deseja remover a marcação de paga desta fatura de{' '}
              <strong className="text-amber-400 font-semibold">{formatCurrency(totalAmount)}</strong>? Ela voltará a aparecer como{' '}
              <strong>pendente</strong>.
            </>
          )}
        </p>

        {/* Botões de Ação */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`btn-primary flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md ${
              targetStatus
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-emerald-950/30'
                : 'bg-amber-600 hover:bg-amber-500 border-amber-500 shadow-amber-950/30'
            }`}
          >
            {targetStatus ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando…' : 'Confirmar como Paga'}</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando…' : 'Voltar para Pendente'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
