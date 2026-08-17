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
}

/**
 * Converte valor numérico (ex: 12.34) para string de centavos ("1234")
 */
function formatValueToCentsStr(val?: number): string {
  if (val === undefined || val === null || isNaN(val) || val === 0) return ''
  return Math.round(val * 100).toString()
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
  },
  ref
) {
  const [centsStr, setCentsStr] = useState<string>(() => formatValueToCentsStr(value))

  // Sincronizar se o valor externo mudar
  useEffect(() => {
    const externalCents = formatValueToCentsStr(value)
    const currentCents = centsStr.replace(/^0+/, '')
    const newCents = externalCents.replace(/^0+/, '')
    if (currentCents !== newCents) {
      setCentsStr(externalCents)
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      const nextStr = centsStr.slice(0, -1)
      setCentsStr(nextStr)
      onChange?.(parseCentsStrToValue(nextStr))
      onKeyDown?.(e)
      return
    }

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      if (centsStr.length >= 10) return
      const nextStr = centsStr + e.key
      setCentsStr(nextStr)
      onChange?.(parseCentsStrToValue(nextStr))
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

  const numValue = parseCentsStrToValue(centsStr)
  const displayStr = centsStr === '' ? '' : formatCurrency(numValue)

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
