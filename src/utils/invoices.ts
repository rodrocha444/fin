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
 * Converte Date ou string para 'YYYY-MM-DD' de forma segura contra offsets e desvios de timezone
 */
export function toCalendarDateString(date: Date | string): string {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'yyyy-MM-dd')
}

/**
 * Filtra as transações de uma conta que pertencem ao ciclo da fatura
 * (ignora transferências/pagamentos entre contas para não abater indevidamente das compras da fatura seguinte)
 */
export function getInvoiceData(
  transactions: Transaction[],
  cycle: InvoiceCycle
): InvoiceData {
  const startStr = toCalendarDateString(cycle.startDate)
  const closeStr = toCalendarDateString(cycle.closingDate)

  const invoiceTransactions = transactions.filter(tx => {
    if (tx.type === 'transfer') return false
    const txDateStr = toCalendarDateString(tx.date)
    return txDateStr >= startStr && txDateStr <= closeStr
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
 * Verifica se uma fatura está paga através de:
 * 1. Marcação direta no paidMap (localStorage/nuvem)
 * 2. Transações com tag explícita: [invoice_paid:accountId:monthKey] ou [invoice_paid:monthKey]
 * 3. Transferências recebidas pelo cartão que mencionam o ciclo no payee (ex: "ago 2026", "2026-08")
 * 4. Transferências recebidas pelo cartão na janela de fechamento/vencimento cujo valor cubra a fatura
 */
export function isInvoicePaid(
  transactions: Transaction[] | undefined,
  accountId: string,
  cycle: InvoiceCycle,
  totalAmount: number,
  paidMap?: Record<string, boolean>
): boolean {
  if (paidMap && Boolean(paidMap[`${accountId}_${cycle.monthKey}`])) {
    return true
  }

  if (!transactions || transactions.length === 0) {
    return false
  }

  // Faturas com valor nulo ou zerado estão quitadas
  if (totalAmount <= 0.005) {
    return true
  }

  const cycleTag1 = `[invoice_paid:${accountId}:${cycle.monthKey}]`
  const cycleTag2 = `[invoice_paid:${cycle.monthKey}]`
  const cycleLabelLower = cycle.label.toLowerCase() // ex: 'ago 2026'

  const [yearStr, monthStr] = cycle.monthKey.split('-')
  const monthIdx = parseInt(monthStr, 10) - 1
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]
  const fullMonthName = monthNames[monthIdx]

  // Janela flexível de pagamento: desde 10 dias antes do fechamento até 180 dias após
  // (reconhece pagamentos atrasados mesmo após o vencimento / após o dia de pagar)
  const windowStart = new Date(cycle.closingDate.getTime() - 10 * 24 * 60 * 60 * 1000)
  const windowEnd = new Date(cycle.closingDate.getTime() + 180 * 24 * 60 * 60 * 1000)

  let totalPaymentsInWindow = 0

  for (const tx of transactions) {
    const isTargetCard = tx.accountId === accountId || tx.transferAccountId === accountId
    if (!isTargetCard) continue

    // 1. Tag explícita em notes
    if (tx.notes && (tx.notes.includes(cycleTag1) || tx.notes.includes(cycleTag2))) {
      return true
    }

    // 2. Pagamento de cartão: transferência para o cartão ou receita registrada na conta do cartão
    const isPayment =
      (tx.transferAccountId === accountId && tx.type === 'transfer') ||
      (tx.accountId === accountId && tx.type === 'income')
    if (!isPayment) continue

    const payeeLower = (tx.payee || '').toLowerCase()
    const notesLower = (tx.notes || '').toLowerCase()
    const combinedText = `${payeeLower} ${notesLower}`

    // 2a. Menção explícita ao mês ou ciclo no favorecido/notas
    if (
      combinedText.includes(cycleLabelLower) ||
      combinedText.includes(cycle.monthKey) ||
      combinedText.includes(`${monthStr}/${yearStr}`) ||
      combinedText.includes(`${monthStr}/${yearStr.slice(-2)}`) ||
      (fullMonthName && combinedText.includes(fullMonthName) && (combinedText.includes(yearStr) || combinedText.includes('fatura') || combinedText.includes('cart')))
    ) {
      return true
    }

    // 3. Verificação por janela e valor
    const txDate = new Date(tx.date)
    if (txDate >= windowStart && txDate <= windowEnd) {
      // Cobertura individual: exata ou tolerando juros/multas por atraso (até 30% + R$ 100)
      if (
        Math.abs(tx.amount - totalAmount) < 1.00 ||
        (tx.amount >= totalAmount - 1.00 && tx.amount <= totalAmount * 1.30 + 100)
      ) {
        return true
      }
      totalPaymentsInWindow += tx.amount
    }
  }

  // 4. Se a soma dos pagamentos na janela cobre o total da fatura (pagamento parcelado/múltiplo)
  if (totalPaymentsInWindow >= totalAmount - 1.00) {
    return true
  }

  return false
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
      const isPaid = isInvoicePaid(transactions, accountId, cycle, invoice.totalAmount, paidMap)

      if (invoice.totalAmount > 0 && !isPaid) {
        closedUnpaid.push(invoice)
      }
    }
  }

  return closedUnpaid
}

/**
 * Retorna o valor total das faturas de cartão de crédito cujo vencimento ocorre no mês do orçamento ('YYYY-MM')
 * Se paidMap ou transações indicarem pagamento, desconsidera faturas que já foram pagas
 */
export function getInvoiceForBudgetMonth(
  transactions: Transaction[],
  account: Account,
  budgetMonth: string,
  paidMap?: Record<string, boolean>
): number {
  if (!account.statementClosingDay || !account.id) return 0

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
      const isPaid = isInvoicePaid(transactions, account.id, cycle, data.totalAmount, paidMap)
      if (isPaid) {
        continue
      }
      totalInvoice += data.totalAmount
    }
  }

  return totalInvoice
}

/**
 * Retorna o mês contábil/efetivo de uma transação ('YYYY-MM') para efeito de Orçamento e Regime de Caixa.
 * - Para Conta Corrente (débito/dinheiro): o mês da data da transação.
 * - Para Cartão de Crédito com fechamento/vencimento: o mês de vencimento da fatura onde a compra caiu.
 */
export function getTransactionEffectiveMonth(
  tx: Transaction,
  accountMap?: Map<string, Account> | Account[]
): string {
  const dateStr = toCalendarDateString(tx.date)
  if (!tx.accountId || !accountMap) return dateStr.substring(0, 7)

  const map = Array.isArray(accountMap) ? new Map(accountMap.map(a => [a.id!, a])) : accountMap
  const account = map.get(tx.accountId)
  if (!account || account.type !== 'credit_card' || !account.statementClosingDay) {
    return dateStr.substring(0, 7)
  }

  // Cartão de crédito: calcular o mês da fatura com base no dia de fechamento
  const closingDay = account.statementClosingDay
  const dueDay = account.paymentDueDay
  const [y, m, d] = dateStr.split('-').map(Number)
  const txDay = d
  const refDate = new Date(y, m - 1, 1)

  // Se o dia da compra >= closingDay, a fatura aberta já é a do mês seguinte
  const cycleMonthDate = txDay < closingDay ? refDate : addMonths(refDate, 1)
  const cycleMonthKey = format(cycleMonthDate, 'yyyy-MM')

  // Obter o ciclo completo para saber a data de vencimento real da fatura
  const cycle = getInvoiceCycle(cycleMonthKey, closingDay, dueDay)
  return format(cycle.dueDate, 'yyyy-MM')
}
