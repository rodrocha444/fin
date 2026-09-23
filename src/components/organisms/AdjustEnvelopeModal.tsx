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
  currentBudgeted = 0,
  currentActivity,
  currentAvailable,
  budgetRegime = 'cash',
  isIncome = false,
  onSave,
}: AdjustEnvelopeModalProps) {
  const [mode, setMode] = useState<'available' | 'budgeted'>('available')

  // Inicializa com o valor disponível atual (se positivo) ou 0
  const [targetAvailable, setTargetAvailable] = useState<number>(() =>
    Math.max(0, Math.round(currentAvailable * 100) / 100)
  )

  // Inicializa com o valor orçado atual
  const [targetBudgeted, setTargetBudgeted] = useState<number>(() =>
    Math.max(0, Math.round(currentBudgeted * 100) / 100)
  )

  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Orçado final calculado para persistência
  const safeTargetAvailable = Math.max(0, targetAvailable || 0)
  const safeTargetBudgeted = Math.max(0, targetBudgeted || 0)

  const calculatedBudgeted = isIncome
    ? safeTargetBudgeted
    : mode === 'available'
    ? Math.max(0, Math.round((currentActivity + safeTargetAvailable) * 100) / 100)
    : safeTargetBudgeted

  const resultingAvailable = isIncome
    ? Math.round((calculatedBudgeted - currentActivity) * 100) / 100
    : mode === 'available'
    ? safeTargetAvailable
    : Math.round((calculatedBudgeted - currentActivity) * 100) / 100

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
      console.error('Erro ao ajustar envelope:', err)
      setErrorMessage(err?.message || 'Erro ao salvar alteração.')
    } finally {
      setIsSaving(false)
    }
  }

  const labelTitle = isIncome ? 'Meta de Receita' : 'Envelope de Despesa'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ajustar ${labelTitle}`}
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

        {/* Alternador de Modo: Disponível vs Orçado (Apenas despesas) */}
        {!isIncome && (
          <div className="flex p-0.5 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('available')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'available'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Saldo Disponível
            </button>
            <button
              type="button"
              onClick={() => setMode('budgeted')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'budgeted'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Teto Orçado
            </button>
          </div>
        )}

        {/* Resumo da situação atual */}
        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              {isIncome ? 'Recebido' : 'Gasto'}
            </span>
            <span className="font-semibold text-slate-200 tabular-nums">
              {formatCurrency(currentActivity)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-medium">
              {isIncome ? 'A Receber Atual' : 'Disponível Atual'}
            </span>
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
        </div>

        {/* Input principal conforme o modo selecionado */}
        <div>
          <label className="text-xs font-medium text-slate-200 mb-1.5 block">
            {isIncome
              ? 'Qual a meta prevista a receber?'
              : mode === 'available'
              ? 'Quanto deve ficar disponível no envelope?'
              : 'Qual o valor total orçado para este mês?'}
          </label>
          {isIncome || mode === 'budgeted' ? (
            <PriceInput
              autoFocus
              value={safeTargetBudgeted}
              onChange={v => setTargetBudgeted(Math.max(0, v))}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') handleSave()
              }}
              placeholder="R$ 0,00"
              allowNegative={false}
              className="input-base text-right text-xl font-bold py-2.5 bg-slate-900/90 border-slate-700 focus:border-indigo-500 tabular-nums"
            />
          ) : (
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
          )}
        </div>

        {/* Informação do resultado */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>{isIncome ? 'Meta prevista:' : 'Orçado ajustado:'}</span>
            <strong className="text-slate-200 tabular-nums font-semibold">
              {formatCurrency(calculatedBudgeted)}
            </strong>
          </div>
          {!isIncome && (
            <div className="flex items-center justify-between">
              <span>Disponível resultante:</span>
              <strong
                className={`tabular-nums font-semibold ${
                  resultingAvailable < -0.005
                    ? 'text-rose-400'
                    : resultingAvailable > 0.005
                    ? 'text-emerald-400'
                    : 'text-slate-300'
                }`}
              >
                {resultingAvailable < -0.005
                  ? `-${formatCurrency(Math.abs(resultingAvailable))}`
                  : formatCurrency(resultingAvailable)}
              </strong>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
