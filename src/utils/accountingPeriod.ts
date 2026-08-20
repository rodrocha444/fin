// src/utils/accountingPeriod.ts — Gerenciamento e utilitários do Início do Período Contábil
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

const STORAGE_KEY = 'fin_accounting_start_date'
const EVENT_KEY = 'finplan_accounting_period_changed'

/**
 * Obtém a data configurada como início do período contábil (formato YYYY-MM-DD) ou null
 */
export function getAccountingStartDate(): string | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(STORAGE_KEY)
  if (!val || val.trim() === '') return null
  return val.trim()
}

/**
 * Salva ou remove a data de início do período contábil e notifica ouvintes
 */
export function setAccountingStartDate(date: string | null): void {
  if (typeof window === 'undefined') return
  if (!date || date.trim() === '') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, date.trim())
  }
  window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: { date: date?.trim() || null } }))
}

/**
 * Retorna o mês inicial (YYYY-MM) a partir da data de início contábil, ou null se não configurado
 */
export function getAccountingStartMonth(): string | null {
  const dateStr = getAccountingStartDate()
  if (!dateStr) return null
  // Espera formato YYYY-MM-DD
  return dateStr.substring(0, 7)
}

/**
 * Verifica se uma data específica é anterior ao início do período contábil
 */
export function isDateBeforeAccountingStart(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const startStr = getAccountingStartDate()
  if (!startStr) return false

  const targetStr = typeof date === 'string'
    ? (date.length >= 10 ? date.substring(0, 10) : format(new Date(date), 'yyyy-MM-dd'))
    : format(date, 'yyyy-MM-dd')

  return targetStr < startStr
}

/**
 * Verifica se um mês (YYYY-MM) é anterior ao mês do início contábil
 */
export function isMonthBeforeAccountingStart(monthKey: string): boolean {
  const startMonth = getAccountingStartMonth()
  if (!startMonth) return false
  return monthKey < startMonth
}

/**
 * Hook React reativo para ler e atualizar a data de início do período contábil
 */
export function useAccountingPeriod() {
  const [startDate, setStartDateState] = useState<string | null>(() => getAccountingStartDate())

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ date: string | null }>
      setStartDateState(customEvent.detail?.date ?? getAccountingStartDate())
    }

    window.addEventListener(EVENT_KEY, handleUpdate)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        setStartDateState(getAccountingStartDate())
      }
    })

    return () => {
      window.removeEventListener(EVENT_KEY, handleUpdate)
    }
  }, [])

  const updateStartDate = (newDate: string | null) => {
    setAccountingStartDate(newDate)
    setStartDateState(newDate ? newDate.trim() : null)
  }

  return {
    startDate,
    startMonth: startDate ? startDate.substring(0, 7) : null,
    hasRestriction: Boolean(startDate),
    setStartDate: updateStartDate,
  }
}
