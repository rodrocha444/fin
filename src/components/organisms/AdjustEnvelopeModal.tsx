// src/components/organisms/AdjustEnvelopeModal.tsx — Modal para adicionar valor ou ajustar o envelope de uma categoria
import React, { useState, useMemo } from 'react'
import {
  Wallet,
  Receipt,
  Plus,
  Minus,
  Equal,
  ShieldAlert,
  Coins,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react'
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
  currentBudgeted: number
  currentActivity: number
  currentAvailable: number
  toBeBudgeted?: number
  budgetRegime?: AccountingRegime
  isIncome?: boolean
  onOpenTransactions?: () => void
}

type AdjustMode = 'add' | 'subtract' | 'set'

export default function AdjustEnvelopeModal({
  isOpen,
  onClose,
  category,
  month,
  currentBudgeted,
  currentActivity,
  currentAvailable,
  toBeBudgeted = 0,
  budgetRegime = 'cash',
  isIncome = false,
  onOpenTransactions,
}: AdjustEnvelopeModalProps) {
  const [mode, setMode] = useState<AdjustMode>('add')
  const [inputValue, setInputValue] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Cálculo do novo valor orçado baseado no modo selecionado
  const calculatedBudgeted = useMemo(() => {
    const val = inputValue || 0
    if (mode === 'add') {
      return Math.round((currentBudgeted + val) * 100) / 100
    }
    if (mode === 'subtract') {
      return Math.max(0, Math.round((currentBudgeted - val) * 100) / 100)
    }
    return Math.max(0, Math.round(val * 100) / 100)
  }, [mode, currentBudgeted, inputValue])

  // Cálculo da nova projeção de disponível
  const calculatedAvailable = useMemo(() => {
    return Math.round((calculatedBudgeted - currentActivity) * 100) / 100
  }, [calculatedBudgeted, currentActivity])

  const diffBudgeted = Math.round((calculatedBudgeted - currentBudgeted) * 100) / 100
  const isDeficit = !isIncome && currentAvailable < -0.005
  const deficitAmount = Math.abs(currentAvailable)

  // Salvar no banco
  const handleSave = async () => {
    if (isSaving || !category.id) return
    try {
      setIsSaving(true)
      setErrorMessage(null)
      await setBudget(month, category.id, calculatedBudgeted, true, budgetRegime)
      onClose()
    } catch (err: any) {
      console.error('Erro ao ajustar envelope de orçamento:', err)
      setErrorMessage(err?.message || 'Ocorreu um erro ao salvar o novo orçamento.')
    } finally {
      setIsSaving(false)
    }
  }

  // Atalho rápido: somar quantia fixa ao input
  const handleAddQuickValue = (val: number) => {
    if (mode !== 'add') {
      setMode('add')
      setInputValue(val)
    } else {
      setInputValue(prev => Math.round((prev + val) * 100) / 100)
    }
  }

  // Atalho rápido: Cobrir Rombo exato
  const handleCoverDeficit = () => {
    setMode('add')
    setInputValue(deficitAmount)
  }

  // Atalho rápido: Alocar todo o "A Orçar"
  const handleAllocateToBeBudgeted = () => {
    setMode('add')
    setInputValue(Math.max(0, toBeBudgeted))
  }

  const modalTitle = isIncome ? 'Ajustar Meta de Receita' : 'Ajustar Envelope'
  const modalDescription = `${category.name} • ${formatMonthLabel(month)}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      icon={<Wallet className="w-5 h-5 text-indigo-400" />}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          {onOpenTransactions ? (
            <button
              type="button"
              onClick={onOpenTransactions}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-slate-300 hover:text-indigo-300"
              title="Ver todas as transações deste mês"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Transações</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
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
              className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 min-w-[110px] justify-center"
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
        </div>
      }
    >
      <div className="space-y-4 p-1">
        {/* Alerta de erro se houver */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Card do Envelope Atual */}
        <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Situação Atual do Envelope
            </span>
            {isDeficit ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/50">
                <ShieldAlert className="w-3 h-3 text-rose-400" /> Rombo de {formatCurrency(deficitAmount)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                {isIncome ? 'Previsão' : 'Orçamento Base Zero'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60 text-center">
            <div>
              <p className="text-[10px] text-slate-500 font-medium">
                {isIncome ? 'Previsto' : 'Orçado'}
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-200 tabular-nums">
                {formatCurrency(currentBudgeted)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium">
                {isIncome ? 'Recebido' : 'Gasto'}
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-300 tabular-nums">
                {formatCurrency(currentActivity)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium">
                {isIncome ? 'Diferença' : 'Disponível'}
              </p>
              <p
                className={`text-xs sm:text-sm font-bold tabular-nums ${
                  currentAvailable > 0.005
                    ? 'text-emerald-400'
                    : currentAvailable < -0.005
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {currentAvailable < -0.005
                  ? `-${formatCurrency(deficitAmount)}`
                  : formatCurrency(currentAvailable)}
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Modo (Abas de Operação) */}
        <div>
          <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">
            O que você deseja fazer?
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                mode === 'add'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Adicionar</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('subtract')}
              className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                mode === 'subtract'
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Minus className="w-3.5 h-3.5 text-amber-400" />
              <span>Retirar</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('set')}
              className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                mode === 'set'
                  ? 'bg-slate-700/60 text-slate-100 border border-slate-600 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Equal className="w-3.5 h-3.5 text-slate-400" />
              <span>Definir</span>
            </button>
          </div>
        </div>

        {/* Input de Valor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300">
              {mode === 'add'
                ? 'Valor a Adicionar ao Orçado'
                : mode === 'subtract'
                ? 'Valor a Retirar do Orçado'
                : 'Novo Valor Total Orçado'}
            </label>
            {inputValue > 0 && (
              <button
                type="button"
                onClick={() => setInputValue(0)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Limpar
              </button>
            )}
          </div>
          <PriceInput
            autoFocus
            value={inputValue}
            onChange={v => setInputValue(v)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') handleSave()
            }}
            placeholder="R$ 0,00"
            className="input-base text-right text-lg sm:text-xl font-bold py-2.5 bg-slate-900/90 border-slate-700 focus:border-indigo-500 tabular-nums"
          />
        </div>

        {/* Atalhos Rápidos Contextuais */}
        <div className="space-y-2">
          {/* Se estiver estourado / rombo */}
          {isDeficit && (
            <button
              type="button"
              onClick={handleCoverDeficit}
              className="w-full p-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-950/50 border border-rose-800/60 text-xs font-medium text-rose-200 flex items-center justify-between transition-all group active:scale-[0.99]"
            >
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>Cobrir rombo desta categoria:</span>
              </span>
              <span className="font-bold text-rose-300 tabular-nums">
                +{formatCurrency(deficitAmount)}
              </span>
            </button>
          )}

          {/* Se houver saldo livre no Disponível a Orçar */}
          {!isIncome && toBeBudgeted > 0.005 && (
            <button
              type="button"
              onClick={handleAllocateToBeBudgeted}
              className="w-full p-2 rounded-xl bg-indigo-950/30 hover:bg-indigo-950/50 border border-indigo-800/40 text-xs font-medium text-indigo-200 flex items-center justify-between transition-all group active:scale-[0.99]"
            >
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Usar todo o Disponível a Orçar:</span>
              </span>
              <span className="font-bold text-indigo-300 tabular-nums">
                +{formatCurrency(toBeBudgeted)}
              </span>
            </button>
          )}

          {/* Chips de Adição Rápida */}
          {mode === 'add' && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mr-0.5">
                Rápido:
              </span>
              {[20, 50, 100, 200, 500].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddQuickValue(val)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 active:scale-95 transition-all"
                >
                  +{val}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card de Pré-visualização do Resultado Final */}
        <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Resultado após o Ajuste</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-indigo-900/30">
            <div>
              <p className="text-[10px] text-slate-400 font-medium">
                {isIncome ? 'Nova Meta Prevista' : 'Novo Total Orçado'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 line-through tabular-nums">
                  {formatCurrency(currentBudgeted)}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="text-sm font-bold text-slate-100 tabular-nums">
                  {formatCurrency(calculatedBudgeted)}
                </span>
              </div>
              {diffBudgeted !== 0 && (
                <span
                  className={`text-[10px] font-semibold ${
                    diffBudgeted > 0 ? 'text-indigo-400' : 'text-amber-400'
                  }`}
                >
                  {diffBudgeted > 0 ? `+${formatCurrency(diffBudgeted)}` : formatCurrency(diffBudgeted)}
                </span>
              )}
            </div>

            <div>
              <p className="text-[10px] text-slate-400 font-medium">
                {isIncome ? 'Nova Diferença' : 'Novo Saldo Disponível'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 line-through tabular-nums">
                  {formatCurrency(currentAvailable)}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span
                  className={`text-sm font-bold tabular-nums ${
                    calculatedAvailable > 0.005
                      ? 'text-emerald-400'
                      : calculatedAvailable < -0.005
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {formatCurrency(calculatedAvailable)}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                {calculatedAvailable >= 0.005
                  ? 'Envelope com sobra positiva'
                  : calculatedAvailable < -0.005
                  ? 'Ainda faltam fundos'
                  : 'Envelope equilibrado (R$ 0,00)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
