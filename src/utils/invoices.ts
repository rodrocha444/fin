// src/utils/invoices.ts
// ─────────────────────────────────────────────────────────────
// Utilitários de cálculo e ciclo de faturas para cartões de crédito
// ─────────────────────────────────────────────────────────────

import { format, addMonths, subMonths, getDaysInMonth, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Account, Transaction } from '@/types'

export interface InvoiceCycle {
  monthKey: string // 'YYYY-MM' do mês de fechamento
  label: string // 'ago 2026'
  startDate: Date
  closingDate: Date
  dueDate: Date
  status: 'open' | 'closed' | 'future'
}

export interface InvoiceData {
  cycle: InvoiceCycle
  transactions: Transaction[]
  totalAmount: number
  chargesAmount: number
  paymentsAmount: number
}

/**
 * Retorna o 'YYYY-MM' da fatura aberta atual com base no dia de fechamento
 */
export function getCurrentOpenInvoiceMonth(closingDay: number): string {
  const now = new Date()
  const today = now.getDate()
  if (today <= closingDay) {
    return format(now, 'yyyy-MM')
  } else {
    return format(addMonths(now, 1), 'yyyy-MM')
  }
}

/**
 * Calcula o ciclo (início, fechamento, vencimento, status) para um determinado mês e dia de fechamento
 */
export function getInvoiceCycle(
  monthKey: string,
  closingDay: number,
  dueDay?: number
): InvoiceCycle {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const monthIdx = month - 1

  // Fechamento no mês de referência
  const maxDayInMonth = getDaysInMonth(new Date(year, monthIdx, 1))
  const safeClosingDay = Math.min(closingDay, maxDayInMonth)
  const closingDate = new Date(year, monthIdx, safeClosingDay, 23, 59, 59, 999)

  // Início = dia seguinte ao fechamento do mês anterior
  const prevMonthDate = subMonths(new Date(year, monthIdx, 1), 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonthIdx = prevMonthDate.getMonth()
  const maxDayPrevMonth = getDaysInMonth(new Date(prevYear, prevMonthIdx, 1))
  const safeStartDay = Math.min(closingDay + 1, maxDayPrevMonth)
  const startDate = new Date(prevYear, prevMonthIdx, safeStartDay, 0, 0, 0, 0)

  // Vencimento
  let dueDate: Date
  if (dueDay) {
    if (dueDay > closingDay) {
      const safeDueDay = Math.min(dueDay, maxDayInMonth)
      dueDate = new Date(year, monthIdx, safeDueDay, 23, 59, 59, 999)
    } else {
      const nextMonthDate = addMonths(new Date(year, monthIdx, 1), 1)
      const nextYear = nextMonthDate.getFullYear()
      const nextMonthIdx = nextMonthDate.getMonth()
      const safeDueDay = Math.min(dueDay, getDaysInMonth(nextMonthDate))
      dueDate = new Date(nextYear, nextMonthIdx, safeDueDay, 23, 59, 59, 999)
    }
  } else {
    // Vencimento padrão: 10 dias após fechamento
    dueDate = new Date(closingDate.getTime() + 10 * 24 * 60 * 60 * 1000)
  }

  const now = new Date()
  let status: 'open' | 'closed' | 'future' = 'closed'
  if (now > closingDate) {
    status = 'closed'
  } else if (now >= startDate && now <= closingDate) {
    status = 'open'
  } else {
    status = 'future'
  }

  return {
    monthKey,
    label: format(closingDate, 'MMM yyyy', { locale: ptBR }),
    startDate,
    closingDate,
    dueDate,
    status,
  }
}

/**
 * Filtra as transações de uma conta que pertencem ao ciclo da fatura
 */
export function getInvoiceData(
  transactions: Transaction[],
  cycle: InvoiceCycle
): InvoiceData {
  const invoiceTransactions = transactions.filter(tx => {
    const d = new Date(tx.date)
    return d >= cycle.startDate && d <= cycle.closingDate
  })

  // Ordenar por data de criação decrescente (incluindo hora)
  invoiceTransactions.sort((a, b) => {
    const timeB = (b.createdAt ? new Date(b.createdAt) : new Date(b.date)).getTime()
    const timeA = (a.createdAt ? new Date(a.createdAt) : new Date(a.date)).getTime()
    if (timeB !== timeA) return timeB - timeA
    return (b.id ?? '').localeCompare(a.id ?? '')
  })

  let chargesAmount = 0
  let paymentsAmount = 0

  for (const tx of invoiceTransactions) {
    if (tx.type === 'expense') {
      chargesAmount += tx.amount
    } else if (tx.type === 'income' || tx.type === 'transfer') {
      paymentsAmount += tx.amount
    }
  }

  const totalAmount = Math.max(0, chargesAmount - paymentsAmount)

  return {
    cycle,
    transactions: invoiceTransactions,
    totalAmount,
    chargesAmount,
    paymentsAmount,
  }
}
