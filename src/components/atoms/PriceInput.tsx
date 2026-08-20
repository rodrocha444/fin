// src/components/atoms/PriceInput.tsx — Input de valor monetário formatado para BRL
import { useState, useEffect, forwardRef } from 'react'
import { formatCurrency } from '@/utils/format'

interface PriceInputProps {
  value?: number
  onChange?: (value: number) => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
  allowNegative?: boolean
}

/**
 * Converte valor numérico (ex: 12.34 ou -12.34) para string de centavos ("1234")
 */
function formatValueToCentsStr(val?: number): string {
  if (val === undefined || val === null || isNaN(val) || val === 0) return ''
  return Math.round(Math.abs(val) * 100).toString()
}

/**
 * Converte string de centavos (ex: "1234") para número em reais (12.34)
 */
function parseCentsStrToValue(centsStr: string): number {
  if (!centsStr) return 0
  const num = parseInt(centsStr, 10)
  return isNaN(num) ? 0 : num / 100
}

const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(function PriceInput(
  {
    value,
    onChange,
    onBlur,
    onKeyDown,
    placeholder = 'R$ 0,00',
    className = 'input-base text-right font-mono text-base font-semibold',
    autoFocus = false,
    disabled = false,
    allowNegative = false,
  },
  ref
) {
  const [centsStr, setCentsStr] = useState<string>(() => formatValueToCentsStr(value))
  const [isNegative, setIsNegative] = useState<boolean>(() => (value ?? 0) < 0)

  // Sincronizar se o valor externo mudar
  useEffect(() => {
    const externalCents = formatValueToCentsStr(value)
    setCentsStr(prev => {
      const currentCents = prev.replace(/^0+/, '')
      const newCents = externalCents.replace(/^0+/, '')
      return currentCents !== newCents ? externalCents : prev
    })
    if (value !== undefined && value !== 0) {
      setIsNegative(value < 0)
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (allowNegative && (e.key === '-' || e.key === '_')) {
      e.preventDefault()
      setIsNegative(true)
      const absVal = parseCentsStrToValue(centsStr)
      onChange?.(-absVal)
      return
    }

    if (allowNegative && (e.key === '+' || e.key === '=')) {
      e.preventDefault()
      setIsNegative(false)
      const absVal = parseCentsStrToValue(centsStr)
      onChange?.(absVal)
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      const nextStr = centsStr.slice(0, -1)
      setCentsStr(nextStr)
      const absVal = parseCentsStrToValue(nextStr)
      onChange?.(isNegative ? -absVal : absVal)
      onKeyDown?.(e)
      return
    }

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      if (centsStr.length >= 10) return
      const nextStr = centsStr + e.key
      setCentsStr(nextStr)
      const absVal = parseCentsStrToValue(nextStr)
      onChange?.(isNegative ? -absVal : absVal)
      onKeyDown?.(e)
      return
    }

    if (['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      onKeyDown?.(e)
      return
    }

    if (e.ctrlKey || e.metaKey) {
      onKeyDown?.(e)
      return
    }

    e.preventDefault()
    onKeyDown?.(e)
  }

  const setSign = (negative: boolean) => {
    if (disabled) return
    setIsNegative(negative)
    const absVal = parseCentsStrToValue(centsStr)
    onChange?.(negative ? -absVal : absVal)
  }

  const absNum = parseCentsStrToValue(centsStr)
  const displayStr = centsStr === '' ? '' : (isNegative ? '-' : '') + formatCurrency(absNum)

  if (allowNegative) {
    return (
      <div className="relative flex items-center gap-2">
        <div className="flex bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 flex-shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSign(false)}
            className={`w-9 h-9 rounded-lg text-base font-bold flex items-center justify-center transition-all ${
              !isNegative
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            title="Saldo Positivo (+)"
          >
            +
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSign(true)}
            className={`w-9 h-9 rounded-lg text-base font-bold flex items-center justify-center transition-all ${
              isNegative
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            title="Saldo Negativo / Devedor (−)"
          >
            −
          </button>
        </div>

        <div className="relative flex-1">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={displayStr}
            placeholder={placeholder}
            onKeyDown={handleKeyDown}
            onBlur={onBlur}
            onChange={() => {}}
            autoFocus={autoFocus}
            disabled={disabled}
            className={`${className} ${isNegative && centsStr !== '' ? 'text-rose-400 font-semibold' : ''}`}
            autoComplete="off"
          />
        </div>
      </div>
    )
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={displayStr}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      onChange={() => {}}
      autoFocus={autoFocus}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  )
})

export default PriceInput
