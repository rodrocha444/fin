// src/components/organisms/ReplicateBudgetModal.tsx — Modal para replicar orçamento atual em lote para meses futuros
import React, { useState } from 'react'
import { Sparkles, Calendar, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/atoms/Modal'
import { formatMonthLabel, shiftMonth } from '@/utils/format'
import { replicateBudget } from '@/services/api/budget'
import { useAlert } from '@/context/ConfirmContext'
import type { AccountingRegime } from '@/utils/accountingRegime'

export interface ReplicateBudgetModalProps {
  isOpen: boolean
  onClose: () => void
  sourceMonth: string
  budgetRegime?: AccountingRegime
  onSuccess?: () => void
}

export default function ReplicateBudgetModal({
  isOpen,
  onClose,
  sourceMonth,
  budgetRegime = 'cash',
  onSuccess,
}: ReplicateBudgetModalProps) {
  const alert = useAlert()
  const [monthsCount, setMonthsCount] = useState<number>(6)
  const [isReplicating, setIsReplicating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const startTargetMonth = shiftMonth(sourceMonth, 1)
  const endTargetMonth = shiftMonth(sourceMonth, monthsCount)

  const handleReplicate = async () => {
    try {
      setIsReplicating(true)
      setErrorMessage(null)

      const result = await replicateBudget(sourceMonth, monthsCount, budgetRegime)

      if (!result.success || result.replicatedMonths.length === 0) {
        setErrorMessage('Nenhum orçamento configurado no mês de origem para replicar.')
        return
      }

      onClose()
      onSuccess?.()

      await alert({
        title: 'Orçamento Replicado com Sucesso!',
        message: `O orçamento de ${formatMonthLabel(sourceMonth)} foi replicado para os próximos ${monthsCount} meses (de ${formatMonthLabel(startTargetMonth)} até ${formatMonthLabel(endTargetMonth)}).`,
        variant: 'success',
      })
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado ao replicar o orçamento.')
    } finally {
      setIsReplicating(false)
    }
  }

  const presets = [
    { count: 3, label: '3 Meses', desc: 'Trimestre' },
    { count: 6, label: '6 Meses', desc: 'Semestre' },
    { count: 12, label: '12 Meses', desc: '1 Ano' },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base leading-tight">Replicar para Meses Futuros</h3>
            <p className="text-xs text-slate-400 mt-0.5">Propagar orçamento em lote para planejamento</p>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {/* Card de Resumo de Intervalo */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Mês Modelo:</span>
            <span className="font-bold text-slate-200 capitalize">{formatMonthLabel(sourceMonth)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            <span className="font-medium">Período de Destino:</span>
            <div className="flex items-center gap-1.5 font-bold text-indigo-300 capitalize text-right">
              <span>{formatMonthLabel(startTargetMonth)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatMonthLabel(endTargetMonth)}</span>
            </div>
          </div>
        </div>

        {/* Seleção de Horizonte */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Quantos meses à frente deseja projetar?</span>
            <span className="text-indigo-400 font-mono font-bold">{monthsCount} {monthsCount === 1 ? 'mês' : 'meses'}</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {presets.map(p => {
              const isSelected = monthsCount === p.count
              return (
                <button
                  key={p.count}
                  type="button"
                  onClick={() => setMonthsCount(p.count)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all text-center ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-950/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold">{p.label}</span>
                  <span className="text-[10px] text-slate-500">{p.desc}</span>
                </button>
              )
            })}
          </div>

          {/* Stepper customizado */}
          <div className="flex items-center justify-between gap-3 pt-2 bg-slate-900/60 border border-slate-800/70 rounded-xl px-3 py-2">
            <span className="text-xs text-slate-400">Personalizado:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthsCount(m => Math.max(1, m - 1))}
                disabled={monthsCount <= 1}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm"
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-sm text-slate-100 font-mono">
                {monthsCount}
              </span>
              <button
                type="button"
                onClick={() => setMonthsCount(m => Math.min(24, m + 1))}
                disabled={monthsCount >= 24}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Informativo */}
        <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40">
          💡 Os valores de despesas e receitas deste mês serão gravados em cada um dos meses selecionados, garantindo que o cálculo de <strong>Projeção Otimista</strong> e <strong>Disponível a Orçar</strong> reflita o seu plano completo mês a mês.
        </p>

        {errorMessage && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2.5 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isReplicating}
            className="btn-secondary flex-1 py-2.5 text-xs sm:text-sm font-medium"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleReplicate}
            disabled={isReplicating}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReplicating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Replicando…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Replicar ({monthsCount}M)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
