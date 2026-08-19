// src/components/organisms/ConfirmInvoicePaidModal.tsx — Modal de confirmação para marcar/desmarcar fatura como paga
import { useState } from 'react'
import { CheckCircle2, AlertCircle, RotateCcw, X, CreditCard, Calendar, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
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
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      }}
      onClick={e => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
        {/* Header do modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              targetStatus
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}>
              {targetStatus ? <CheckCircle2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                {targetStatus ? 'Confirmar Pagamento' : 'Desmarcar Pagamento'}
              </h3>
              <p className="text-xs text-slate-400">
                {targetStatus ? 'Marcar fatura como quitada' : 'Voltar fatura para pendente'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo com detalhes da fatura */}
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
              <span className="text-xl sm:text-2xl font-black text-slate-100 tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block">Fechamento:</span>
                <span className="text-slate-300 font-medium">{formatDate(cycle.closingDate)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Vencimento:</span>
                <span className="text-amber-400 font-semibold">{formatDate(cycle.dueDate)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {targetStatus ? (
              <>
                Deseja marcar a fatura de <strong className="text-slate-200 capitalize">{cycle.label}</strong> do cartão <strong className="text-slate-200">{account.name}</strong> como <strong className="text-emerald-400">Paga</strong>? Ela deixará de aparecer como pendência na tela inicial do cartão.
              </>
            ) : (
              <>
                Deseja <strong className="text-amber-400">desmarcar o pagamento</strong> da fatura de <strong className="text-slate-200 capitalize">{cycle.label}</strong>? Ela voltará a constar como pendência.
              </>
            )}
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 bg-slate-950/60 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary py-2 px-4 text-xs font-semibold"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`py-2 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-lg ${
              targetStatus
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
            } disabled:opacity-50`}
          >
            {targetStatus ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando…' : 'Confirmar como Paga'}</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando…' : 'Desmarcar Pagamento'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
