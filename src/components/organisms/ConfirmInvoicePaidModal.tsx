// src/components/organisms/ConfirmInvoicePaidModal.tsx — Modal de confirmação para marcar/desmarcar fatura como paga
import { useState } from 'react'
import { CheckCircle2, RotateCcw, ArrowRightLeft, Check } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/format'
import { format } from 'date-fns'
import Modal from '@/components/atoms/Modal'
import { useAccounts } from '@/hooks/useAccounts'
import type { Account } from '@/types'
import type { InvoiceData } from '@/utils/invoices'
import type { SetInvoicePaidOptions } from '@/services/api/invoices'

interface ConfirmInvoicePaidModalProps {
  account: Account
  invoiceData: InvoiceData
  targetStatus: boolean // true = marcar como paga, false = desmarcar
  onConfirm: (options?: SetInvoicePaidOptions) => Promise<void> | void
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

  const accounts = useAccounts() ?? []
  const checkingAccounts = accounts.filter(a => a.type === 'checking' && a.id !== account.id)
  const eligibleAccounts = checkingAccounts.length > 0 ? checkingAccounts : accounts.filter(a => a.id !== account.id)

  const [paymentMode, setPaymentMode] = useState<'status_only' | 'with_transfer'>('status_only')
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState<string>(eligibleAccounts[0]?.id || '')
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true)
      if (targetStatus && paymentMode === 'with_transfer' && selectedSourceAccountId) {
        await onConfirm({
          sourceAccountId: selectedSourceAccountId,
          amount: totalAmount,
          cycleLabel: `${account.name} (${cycle.label})`,
          paymentDate: new Date(`${paymentDate}T12:00:00`),
        })
      } else {
        await onConfirm()
      }
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
      title={targetStatus ? 'Confirmar Pagamento da Fatura' : 'Desmarcar Pagamento'}
      description={targetStatus ? 'Quitar fatura no aplicativo' : 'Voltar fatura para pendente'}
    >
      <div className="p-4 sm:p-5 space-y-4">
        {/* Card resumo da fatura */}
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
            <span className="text-xs text-slate-400 font-medium">Valor da Fatura:</span>
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

        {targetStatus ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              Como deseja registrar o pagamento desta fatura?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('status_only')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMode === 'status_only'
                    ? 'border-emerald-500 bg-emerald-950/40 text-slate-100 shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Apenas Status
                  </span>
                  {paymentMode === 'status_only' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Marca a fatura como paga sem movimentar contas bancárias.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('with_transfer')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMode === 'with_transfer'
                    ? 'border-emerald-500 bg-emerald-950/40 text-slate-100 shadow-sm'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" /> Debitar de Conta
                  </span>
                  {paymentMode === 'with_transfer' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Registra transferência bancária quitando a dívida do cartão.
                </p>
              </button>
            </div>

            {paymentMode === 'with_transfer' && (
              <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Conta de Saída (Débito)
                  </label>
                  <select
                    value={selectedSourceAccountId}
                    onChange={e => setSelectedSourceAccountId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {eligibleAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type === 'checking' ? 'Conta Corrente' : a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Data do Pagamento
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-300 leading-relaxed">
            Deseja remover a marcação de paga desta fatura de{' '}
            <strong className="text-amber-400 font-semibold">{formatCurrency(totalAmount)}</strong>?
            Ela voltará a aparecer como <strong>pendente</strong> no aplicativo.
          </p>
        )}

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
                <span>{isSubmitting ? 'Salvando…' : paymentMode === 'with_transfer' ? 'Pagar Fatura' : 'Confirmar como Paga'}</span>
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
