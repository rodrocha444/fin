// src/components/organisms/AdjustEnvelopeModal.tsx — Modal direto para definir quanto deve ficar disponível na categoria
import React, { useState } from 'react'
import { Wallet, Loader2 } from 'lucide-react'
import Modal from '@/components/atoms/Modal'
import PriceInput from '@/components/atoms/PriceInput'
import { formatCurrency, formatMonthLabel } from '@/utils/format'
import { setBudget } from '@/services/api/budget'
import type { Category } from '@/types'
import type { AccountingRegime } from '@/utils/accountingRegime'

export interface AdjustEnvelopeModalProps {
  isOpen: boolean
  onClose: () => void
  category: Category
  month: string
  currentBudgeted?: number
  currentActivity: number
  currentAvailable: number
  budgetRegime?: AccountingRegime
  isIncome?: boolean
  onSave?: (newBudgeted: number) => Promise<void>
}

export default function AdjustEnvelopeModal({
  isOpen,
  onClose,
  category,
  month,
  currentActivity,
  currentAvailable,
  budgetRegime = 'cash',
  isIncome = false,
  onSave,
}: AdjustEnvelopeModalProps) {
  // Inicializa com o valor disponível atual (se positivo) ou 0 (se estava negativo/estourado)
  const [targetAvailable, setTargetAvailable] = useState<number>(() =>
    Math.max(0, Math.round(currentAvailable * 100) / 100)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Orçado = Gasto + Disponível Desejado (não permite valor negativo)
  const safeTargetAvailable = Math.max(0, targetAvailable || 0)
  const calculatedBudgeted = Math.max(
    0,
    Math.round((currentActivity + safeTargetAvailable) * 100) / 100
  )

  const handleSave = async () => {
    if (isSaving || !category.id) return
    try {
      setIsSaving(true)
      setErrorMessage(null)
      if (onSave) {
        await onSave(calculatedBudgeted)
      } else {
        await setBudget(month, category.id, calculatedBudgeted, true, budgetRegime)
      }
      onClose()
    } catch (err: any) {
      console.error('Erro ao ajustar disponível:', err)
      setErrorMessage(err?.message || 'Erro ao salvar alteração.')
    } finally {
      setIsSaving(false)
    }
  }

  const labelTitle = isIncome ? 'Meta a Receber' : 'Disponível'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Definir ${labelTitle}`}
      description={`${category.name} • ${formatMonthLabel(month)}`}
      icon={<Wallet className="w-5 h-5 text-indigo-400" />}
      size="sm"
      footer={
        <div className="flex items-center justify-end w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="btn-secondary py-2 px-3 sm:px-4 text-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 min-w-[100px] justify-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando…</span>
              </>
            ) : (
              <span>Confirmar</span>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Resumo simples da situação atual */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{labelTitle} atual:</span>
          <span
            className={`font-semibold tabular-nums ${
              currentAvailable < -0.005
                ? 'text-rose-400 font-bold'
                : currentAvailable > 0.005
                ? 'text-emerald-400'
                : 'text-slate-300'
            }`}
          >
            {currentAvailable < -0.005
              ? `-${formatCurrency(Math.abs(currentAvailable))}`
              : formatCurrency(currentAvailable)}
          </span>
        </div>

        {/* Input direto: quanto deve ficar disponível */}
        <div>
          <label className="text-xs font-medium text-slate-200 mb-1.5 block">
            Quanto deve ficar {labelTitle.toLowerCase()}?
          </label>
          <PriceInput
            autoFocus
            value={safeTargetAvailable}
            onChange={v => setTargetAvailable(Math.max(0, v))}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') handleSave()
            }}
            placeholder="R$ 0,00"
            allowNegative={false}
            className="input-base text-right text-xl font-bold py-2.5 bg-slate-900/90 border-slate-700 focus:border-indigo-500 tabular-nums"
          />
        </div>

        {/* Informação sutil do orçamento resultante */}
        <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
          {isIncome ? 'Meta prevista: ' : 'Orçado ajustado para '}
          <strong className="text-slate-200 tabular-nums">
            {formatCurrency(calculatedBudgeted)}
          </strong>
          {currentActivity > 0 && (
            <span className="text-slate-500">
              {' '}(cobre {formatCurrency(currentActivity)} de {isIncome ? 'recebido' : 'gasto'})
            </span>
          )}
        </p>
      </div>
    </Modal>
  )
}
