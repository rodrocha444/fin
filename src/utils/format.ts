// src/utils/format.ts
// ─────────────────────────────────────────────────────────────
// Utilitários de formatação para BRL e datas
// ─────────────────────────────────────────────────────────────

import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

/** Formata número como R$ 1.234,56 */
export function formatCurrency(value: number): string {
  return BRL.format(value)
}

/** Formata número como +R$100 ou -R$100 com sinal explícito */
export function formatCurrencySigned(value: number): string {
  const formatted = BRL.format(Math.abs(value))
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

/** Parse de string de valor BRL para número (remove R$, pontos, converte vírgula) */
export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[R$\s.]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/** Formata Date como dd/MM/yyyy */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (!isValid(d)) return '—'
  return format(d, 'dd/MM/yyyy', { locale: ptBR })
}

/** Formata a hora como HH:mm */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (!isValid(d)) return ''
  return format(d, 'HH:mm', { locale: ptBR })
}

/** Formata Date como 'ago 2025' */
export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 1)
  return format(d, "MMM yyyy", { locale: ptBR })
}

/** Retorna 'YYYY-MM' do mês atual */
export function currentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

/** Avança ou retrocede um mês a partir de 'YYYY-MM' */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 1 + delta)
  return format(d, 'yyyy-MM')
}

/** Retorna cor CSS baseada em sinal (positive = verde, negative = vermelho) */
export function amountColor(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-rose-400'
  return 'text-slate-400'
}

/** Frequência agendamento → label legível */
export function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    once: 'Uma vez',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
    yearly: 'Anual',
  }
  return map[freq] ?? freq
}

/** Tipo de conta → label legível */
export function accountTypeLabel(type: string): string {
  const map: Record<string, string> = {
    checking: 'Conta Corrente',
    savings: 'Poupança',
    credit_card: 'Cartão de Crédito',
  }
  return map[type] ?? type
}
