// src/components/atoms/CalculatorModal.tsx — Modal de calculadora para inputs monetários
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calculator, Delete, Check } from 'lucide-react'
import Modal from '@/components/atoms/Modal'
import { formatCurrency } from '@/utils/format'
import type { MathOperator } from '@/utils/calculator'
import {
  evaluateMathExpression,
  appendDigit,
  appendDecimal,
  appendOperator,
  backspace,
  toggleSign,
  applyPercentage,
} from '@/utils/calculator'

export interface CalculatorModalProps {
  isOpen: boolean
  onClose: () => void
  initialValue?: number
  allowNegative?: boolean
  onApply: (value: number) => void
}

function formatInitialValue(val?: number): string {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0'
  return val.toString().replace('.', ',')
}

export default function CalculatorModal({
  isOpen,
  onClose,
  initialValue,
  allowNegative = false,
  onApply,
}: CalculatorModalProps) {
  const [expression, setExpression] = useState<string>(() => formatInitialValue(initialValue))
  const [hasCalculated, setHasCalculated] = useState<boolean>(false)
  const [isNewEntry, setIsNewEntry] = useState<boolean>(() => (initialValue ?? 0) !== 0)

  // Reseta ao abrir o modal com o valor inicial
  useEffect(() => {
    if (isOpen) {
      setExpression(formatInitialValue(initialValue))
      setHasCalculated(false)
      setIsNewEntry((initialValue ?? 0) !== 0)
    }
  }, [isOpen, initialValue])

  // Avaliação em tempo real da expressão
  const livePreview = useMemo(() => {
    return evaluateMathExpression(expression)
  }, [expression])

  const hasOperators = useMemo(() => {
    return /[+−×÷*/-]/.test(expression.replace(/^-/, ''))
  }, [expression])

  const isDivisionByZero = useMemo(() => {
    return /\/\s*0(?![.\d])|÷\s*0(?![.\d])/.test(expression)
  }, [expression])

  const displayResultNumber = useMemo(() => {
    if (isDivisionByZero) return null
    if (livePreview !== null) return livePreview
    return 0
  }, [livePreview, isDivisionByZero])

  // Manipuladores de ação
  const handleDigit = useCallback(
    (digit: string) => {
      setExpression(prev => appendDigit(prev, digit, isNewEntry || hasCalculated))
      setIsNewEntry(false)
      setHasCalculated(false)
    },
    [isNewEntry, hasCalculated]
  )

  const handleDecimal = useCallback(() => {
    setExpression(prev => appendDecimal(prev, isNewEntry || hasCalculated))
    setIsNewEntry(false)
    setHasCalculated(false)
  }, [isNewEntry, hasCalculated])

  const handleOperator = useCallback((op: MathOperator) => {
    setExpression(prev => appendOperator(prev, op))
    setIsNewEntry(false)
    setHasCalculated(false)
  }, [])

  const handlePercentage = useCallback(() => {
    setExpression(prev => applyPercentage(prev))
    setIsNewEntry(false)
    setHasCalculated(false)
  }, [])

  const handleToggleSign = useCallback(() => {
    setExpression(prev => toggleSign(prev))
    setIsNewEntry(false)
    setHasCalculated(false)
  }, [])

  const handleBackspace = useCallback(() => {
    if (hasCalculated || isNewEntry) {
      setExpression('0')
      setIsNewEntry(false)
      setHasCalculated(false)
      return
    }
    setExpression(prev => backspace(prev))
  }, [hasCalculated, isNewEntry])

  const handleClear = useCallback(() => {
    setExpression('0')
    setIsNewEntry(false)
    setHasCalculated(false)
  }, [])

  const handleEquals = useCallback(() => {
    const res = evaluateMathExpression(expression)
    if (res !== null) {
      const rounded = Math.round(res * 100) / 100
      setExpression(rounded.toString().replace('.', ','))
      setHasCalculated(true)
      setIsNewEntry(false)
    }
  }, [expression])

  const handleApply = useCallback(() => {
    if (isDivisionByZero) return
    let finalVal = evaluateMathExpression(expression)
    if (finalVal === null) return
    finalVal = Math.round(finalVal * 100) / 100
    if (!allowNegative) {
      finalVal = Math.max(0, finalVal)
    }
    onApply(finalVal)
  }, [expression, isDivisionByZero, allowNegative, onApply])

  // Suporte a teclado físico (Desktop)
  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleDigit(e.key)
        return
      }

      if (e.key === '+') {
        e.preventDefault()
        handleOperator('+')
        return
      }

      if (e.key === '-') {
        e.preventDefault()
        handleOperator('−')
        return
      }

      if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        handleOperator('×')
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        handleOperator('÷')
        return
      }

      if (e.key === ',' || e.key === '.') {
        e.preventDefault()
        handleDecimal()
        return
      }

      if (e.key === '%') {
        e.preventDefault()
        handlePercentage()
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
        return
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        handleClear()
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (hasCalculated || !hasOperators) {
          handleApply()
        } else {
          handleEquals()
        }
        return
      }

      if (e.key === '=') {
        e.preventDefault()
        handleEquals()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isOpen,
    hasCalculated,
    hasOperators,
    handleDigit,
    handleOperator,
    handleDecimal,
    handlePercentage,
    handleBackspace,
    handleClear,
    handleEquals,
    handleApply,
  ])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Calculadora"
      description="Calcule e aplique o valor ao campo"
      icon={<Calculator className="w-5 h-5 text-indigo-400" />}
      size="sm"
      closeOnEsc={true}
      closeOnOverlayClick={true}
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 py-2.5 text-xs sm:text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={displayResultNumber === null || isDivisionByZero}
            className="btn-primary flex-1 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              Aplicar {displayResultNumber !== null && !isDivisionByZero ? formatCurrency(displayResultNumber) : ''}
            </span>
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3.5">
        {/* Visor digital da calculadora */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col justify-between min-h-[96px] relative overflow-hidden">
          {/* Linha superior: Expressão */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 min-h-[1.25rem]">
            <span className="text-[10px] text-slate-500 uppercase font-sans tracking-wider font-semibold">
              Expressão
            </span>
            <span className="truncate ml-2 max-w-[80%] text-right font-semibold select-all text-slate-300">
              {expression}
            </span>
          </div>

          {/* Linha inferior: Valor calculado / Preview em destaque */}
          <div className="flex items-baseline justify-end gap-2 mt-2">
            {hasOperators && livePreview !== null && !hasCalculated && (
              <span className="text-xs font-mono text-slate-500">=</span>
            )}
            {isDivisionByZero ? (
              <span className="text-rose-400 text-base sm:text-lg font-semibold font-mono">
                Divisão por zero
              </span>
            ) : (
              <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tabular-nums">
                {displayResultNumber !== null ? formatCurrency(displayResultNumber) : 'R$ 0,00'}
              </span>
            )}
          </div>
        </div>

        {/* Teclado da Calculadora */}
        <div className="grid grid-cols-4 gap-2">
          {/* Linha 1 */}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/50 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/50 font-bold text-base transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Limpar tudo (C)"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Apagar último caractere (Backspace)"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handlePercentage}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 font-bold text-base transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Porcentagem (%)"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleOperator('÷')}
            className="h-12 sm:h-13 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 font-bold text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Dividir (÷)"
          >
            ÷
          </button>

          {/* Linha 2 */}
          <button
            type="button"
            onClick={() => handleDigit('7')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleDigit('8')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleDigit('9')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleOperator('×')}
            className="h-12 sm:h-13 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 font-bold text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Multiplicar (×)"
          >
            ×
          </button>

          {/* Linha 3 */}
          <button
            type="button"
            onClick={() => handleDigit('4')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleDigit('5')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleDigit('6')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleOperator('−')}
            className="h-12 sm:h-13 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 font-bold text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Subtrair (−)"
          >
            −
          </button>

          {/* Linha 4 */}
          <button
            type="button"
            onClick={() => handleDigit('1')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleDigit('2')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleDigit('3')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleOperator('+')}
            className="h-12 sm:h-13 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/50 font-bold text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Somar (+)"
          >
            +
          </button>

          {/* Linha 5 */}
          <button
            type="button"
            onClick={handleToggleSign}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 font-semibold text-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Inverter sinal (±)"
          >
            ±
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-lg sm:text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDecimal}
            className="h-12 sm:h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-100 border border-slate-700/40 font-mono font-bold text-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            title="Vírgula (,)"
          >
            ,
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="h-12 sm:h-13 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-2xl transition-all active:scale-95 flex items-center justify-center shadow-md shadow-indigo-900/40 cursor-pointer"
            title="Calcular (=)"
          >
            =
          </button>
        </div>
      </div>
    </Modal>
  )
}
