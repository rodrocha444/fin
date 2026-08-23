// src/utils/invoices.ts
// ─────────────────────────────────────────────────────────────
// Utilitários de cálculo e ciclo de faturas para cartões de crédito
// ─────────────────────────────────────────────────────────────

import { format, addMonths, subMonths, getDaysInMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { compareTransactionsByDate } from './format'
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
 * Retorna o 'YYYY-MM' da fatura aberta atual com base no dia de fechamento.
 * Se o fechamento é dia 22, compras no dia 22 NÃO entram na fatura deste mês, mas sim na próxima.
 * Portanto, a partir do dia de fechamento (inclusive), a fatura aberta já é a do mês seguinte.
 */
export function getCurrentOpenInvoiceMonth(closingDay: number): string {
  const now = new Date()
  const today = now.getDate()
  if (today < closingDay) {
    return format(now, 'yyyy-MM')
  } else {
    return format(addMonths(now, 1), 'yyyy-MM')
  }
}

/**
 * Calcula o ciclo (início, fechamento, vencimento, status) para um determinado mês e dia de fechamento.
 * Regra: Se o fechamento é dia 22, compras no dia 22 NÃO entram na fatura atual, mas sim na próxima.
 * 
 * Para a fatura com monthKey 'YYYY-MM':
 * - Data de Início: dia `closingDay` do mês anterior às 00:00:00.000
 * - Data de Fechamento: dia anterior ao `closingDay` deste mês às 23:59:59.999
 * 
 * Exemplo: fechamento dia 22 para a fatura de Agosto/2026:
 * - Início: 22 de Julho de 2026 às 00:00:00.000
 * - Fechamento: 21 de Agosto de 2026 às 23:59:59.999
 * - Compras em 21/08 entram na fatura de Agosto.
 * - Compras em 22/08 entram na fatura de Setembro (início 22/08 a 21/09).
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

  const refMonthDate = new Date(year, monthIdx, 1)
  const maxDayInMonth = getDaysInMonth(refMonthDate)

  // Fechamento da fatura: dia anterior ao closingDay no mês de referência
  let closingDate: Date
  if (closingDay <= 1) {
    // Se closingDay for 1, a fatura fecha no último dia do mês anterior
    const prevMonthDate = subMonths(refMonthDate, 1)
    const prevYear = prevMonthDate.getFullYear()
    const prevMonthIdx = prevMonthDate.getMonth()
    const lastDayPrevMonth = getDaysInMonth(prevMonthDate)
    closingDate = new Date(prevYear, prevMonthIdx, lastDayPrevMonth, 23, 59, 59, 999)
  } else {
    const safeClosingDay = Math.min(closingDay - 1, maxDayInMonth)
    closingDate = new Date(year, monthIdx, safeClosingDay, 23, 59, 59, 999)
  }

  // Início da fatura: dia closingDay do mês anterior
  const prevMonthDate = subMonths(refMonthDate, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonthIdx = prevMonthDate.getMonth()
  const maxDayPrevMonth = getDaysInMonth(prevMonthDate)
  const safeStartDay = Math.min(closingDay, maxDayPrevMonth)
  const startDate = new Date(prevYear, prevMonthIdx, safeStartDay, 0, 0, 0, 0)

  // Vencimento
  let dueDate: Date
  if (dueDay) {
    if (dueDay > closingDay) {
      const safeDueDay = Math.min(dueDay, maxDayInMonth)
      dueDate = new Date(year, monthIdx, safeDueDay, 23, 59, 59, 999)
    } else {
      const nextMonthDate = addMonths(refMonthDate, 1)
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
    label: format(refMonthDate, 'MMM yyyy', { locale: ptBR }),
    startDate,
    closingDate,
    dueDate,
    status,
  }
}

/**
 * Filtra as transações de uma conta que pertencem ao ciclo da fatura
 * (ignora transferências/pagamentos entre contas para não abater indevidamente das compras da fatura seguinte)
 */
export function getInvoiceData(
  transactions: Transaction[],
  cycle: InvoiceCycle
): InvoiceData {
  const invoiceTransactions = transactions.filter(tx => {
    if (tx.type === 'transfer') return false
    const d = new Date(tx.date)
    return d >= cycle.startDate && d <= cycle.closingDate
  })

  // Ordenar por data contábil/efetiva decrescente (mais recente primeiro)
  invoiceTransactions.sort(compareTransactionsByDate)

  let chargesAmount = 0
  let refundsAmount = 0

  for (const tx of invoiceTransactions) {
    if (tx.type === 'expense') {
      chargesAmount += tx.amount
    } else if (tx.type === 'income') {
      refundsAmount += tx.amount
    }
  }

  const totalAmount = Math.max(0, chargesAmount - refundsAmount)

  return {
    cycle,
    transactions: invoiceTransactions,
    totalAmount,
    chargesAmount,
    paymentsAmount: refundsAmount,
  }
}

export interface InvoicesOverview {
  openInvoice: InvoiceData
  futureInvoices: InvoiceData[]
  allInvoices: InvoiceData[]
  totalFutureCommitted: number
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, mon] = monthKey.split('-').map(Number)
  const d = addMonths(new Date(year, mon - 1, 1), delta)
  return format(d, 'yyyy-MM')
}

/**
 * Retorna visão consolidada de faturas (aberta atual + próximas faturas com parcelas / gastos futuros)
 */
export function getInvoicesOverview(
  transactions: Transaction[],
  closingDay: number,
  dueDay?: number,
  futureMonthsCount = 12
): InvoicesOverview | null {
  if (!closingDay || closingDay < 1 || closingDay > 31) return null

  const openMonthKey = getCurrentOpenInvoiceMonth(closingDay)
  const openCycle = getInvoiceCycle(openMonthKey, closingDay, dueDay)
  const openInvoice = getInvoiceData(transactions, openCycle)

  const futureInvoices: InvoiceData[] = []
  let totalFutureCommitted = 0

  for (let i = 1; i <= futureMonthsCount; i++) {
    const monthKey = shiftMonthKey(openMonthKey, i)
    const cycle = getInvoiceCycle(monthKey, closingDay, dueDay)
    const invoice = getInvoiceData(transactions, cycle)
    if (invoice.totalAmount > 0 || invoice.transactions.length > 0) {
      futureInvoices.push(invoice)
      totalFutureCommitted += invoice.totalAmount
    }
  }

  return {
    openInvoice,
    futureInvoices,
    allInvoices: [openInvoice, ...futureInvoices],
    totalFutureCommitted,
  }
}

/**
 * Retorna as faturas fechadas que possuem saldo e não foram marcadas como pagas
 */
export function getClosedUnpaidInvoices(
  transactions: Transaction[],
  closingDay: number,
  dueDay: number | undefined,
  accountId: string,
  paidMap: Record<string, boolean>,
  pastMonthsCount = 12
): InvoiceData[] {
  if (!closingDay || closingDay < 1 || closingDay > 31) return []

  const openMonthKey = getCurrentOpenInvoiceMonth(closingDay)
  const closedUnpaid: InvoiceData[] = []

  for (let i = 1; i <= pastMonthsCount; i++) {
    const monthKey = shiftMonthKey(openMonthKey, -i)
    const cycle = getInvoiceCycle(monthKey, closingDay, dueDay)

    if (cycle.status === 'closed') {
      const invoice = getInvoiceData(transactions, cycle)
      const isMarkedPaid = Boolean(paidMap[`${accountId}_${monthKey}`])

      if (invoice.totalAmount > 0 && !isMarkedPaid) {
        closedUnpaid.push(invoice)
      }
    }
  }

  return closedUnpaid
}

/**
 * Retorna o valor total das faturas de cartão de crédito cujo vencimento ocorre no mês do orçamento ('YYYY-MM')
 */
export function getInvoiceForBudgetMonth(
  transactions: Transaction[],
  account: Account,
  budgetMonth: string
): number {
  if (!account.statementClosingDay) return 0

  const closingDay = account.statementClosingDay
  const dueDay = account.paymentDueDay

  const [y, m] = budgetMonth.split('-').map(Number)
  const checkMonths = [-1, 0, 1].map(delta => {
    const d = addMonths(new Date(y, m - 1, 1), delta)
    return format(d, 'yyyy-MM')
  })

  let totalInvoice = 0

  for (const monthKey of checkMonths) {
    const cycle = getInvoiceCycle(monthKey, closingDay, dueDay)
    if (format(cycle.dueDate, 'yyyy-MM') === budgetMonth) {
      const data = getInvoiceData(transactions, cycle)
      totalInvoice += data.totalAmount
    }
  }

  return totalInvoice
}
