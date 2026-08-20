import { getClient } from './client'
import { createId } from '@/utils/id'
import { format, subMonths } from 'date-fns'
import { isInitialSetupCategory } from '@/utils/format'
import { getInvoiceForBudgetMonth } from '@/utils/invoices'
import { notifyDataChanged } from './events'
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  Transaction,
  GroupBudgetRow,
  CategoryBudgetRow,
  IncomeGroupBudgetRow,
  IncomeCategoryBudgetRow,
  InvoiceGroupBudgetRow,
  InvoiceCategoryBudgetRow,
  BudgetSummary,
} from '@/types'

export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

export async function setBudget(month: string, categoryId: string, budgeted: number): Promise<void> {
  const client = getClient()
  const { data: existing } = await client
    .from('budget_months')
    .select('id')
    .eq('month', month)
    .eq('category_id', categoryId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await client
      .from('budget_months')
      .update({ budgeted, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw new Error(`Erro ao salvar orçamento: ${error.message}`)
  } else {
    const id = createId()
    const { error } = await client.from('budget_months').insert({
      id,
      month,
      category_id: categoryId,
      budgeted,
      activity: 0,
      available: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`Erro ao criar orçamento: ${error.message}`)
  }
  notifyDataChanged('budget_months', 'upsert')
}

export async function copyFromPreviousMonth(targetMonth: string): Promise<void> {
  const client = getClient()
  const [year, mon] = targetMonth.split('-').map(Number)
  const prevDate = subMonths(new Date(year, mon - 1), 1)
  const prevMonth = format(prevDate, 'yyyy-MM')

  const { data: prevBudgets } = await client.from('budget_months').select('*').eq('month', prevMonth)
  if (!prevBudgets || prevBudgets.length === 0) return

  for (const prev of prevBudgets) {
    await setBudget(targetMonth, prev.category_id, Number(prev.budgeted || 0))
  }
  notifyDataChanged('budget_months', 'upsert')
}

export async function clearMonthBudgets(month: string): Promise<void> {
  const client = getClient()
  await client.from('budget_months').update({ budgeted: 0, updated_at: new Date().toISOString() }).eq('month', month)
  notifyDataChanged('budget_months', 'update')
}

/**
 * Funções puras de cálculo de orçamento (instantâneas com dados em memória)
 */

export function calculateActivityByCategory(transactions: Transaction[], month: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth !== month) continue
    if (tx.categoryId) {
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount)
    }
  }
  return map
}

export function calculateIncomeByCategory(transactions: Transaction[], month: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== 'income') continue
    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth !== month) continue
    if (tx.categoryId) {
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount)
    }
  }
  return map
}

export function calculateBudgetRows(
  month: string,
  categoryGroups: CategoryGroup[],
  categories: Category[],
  budgetMonths: BudgetMonth[],
  transactions: Transaction[]
): GroupBudgetRow[] {
  const activityMap = calculateActivityByCategory(transactions, month)
  const budgetByCategory = new Map(
    budgetMonths.filter(b => b.month === month).map(b => [b.categoryId, b])
  )

  const expenseGroups = categoryGroups.filter(
    g => g.type !== 'income' && g.name !== 'Faturas Atuais' && g.name !== 'Faturas de Cartão'
  )

  const rows: GroupBudgetRow[] = []

  for (const group of expenseGroups) {
    if (group.isHidden || isInitialSetupCategory(undefined, group.name)) continue
    const groupCategories = categories.filter(
      c => c.groupId === group.id && !c.isHidden && !isInitialSetupCategory(c.name, group.name)
    )
    if (groupCategories.length === 0) continue

    const catRows: CategoryBudgetRow[] = []

    for (const cat of groupCategories) {
      if (!cat.id) continue
      const budgetRec = budgetByCategory.get(cat.id)
      const budgeted = budgetRec?.budgeted ?? 0
      const activity = activityMap.get(cat.id) ?? 0
      const available = budgeted - activity

      catRows.push({ category: cat, budgeted, activity, available })
    }

    rows.push({
      group,
      categories: catRows,
      totalBudgeted: catRows.reduce((s, r) => s + r.budgeted, 0),
      totalActivity: catRows.reduce((s, r) => s + r.activity, 0),
      totalAvailable: catRows.reduce((s, r) => s + r.available, 0),
    })
  }

  return rows
}

export function calculateIncomeBudgetRows(
  month: string,
  categoryGroups: CategoryGroup[],
  categories: Category[],
  transactions: Transaction[]
): IncomeGroupBudgetRow[] {
  const incomeMap = calculateIncomeByCategory(transactions, month)
  const incomeGroups = categoryGroups.filter(g => g.type === 'income')
  const rows: IncomeGroupBudgetRow[] = []

  for (const group of incomeGroups) {
    if (group.isHidden) continue
    const groupCategories = categories.filter(c => c.groupId === group.id && !c.isHidden)
    if (groupCategories.length === 0) continue

    const catRows: IncomeCategoryBudgetRow[] = []

    for (const cat of groupCategories) {
      if (!cat.id) continue
      const received = incomeMap.get(cat.id) ?? 0
      catRows.push({ category: cat, received })
    }

    rows.push({
      group,
      categories: catRows,
      totalReceived: catRows.reduce((s, r) => s + r.received, 0),
    })
  }

  return rows
}

export function calculateInvoiceBudgetRows(
  month: string,
  accounts: Account[],
  transactions: Transaction[]
): InvoiceGroupBudgetRow[] {
  const activityMap = calculateActivityByCategory(transactions, month)
  const ccAccounts = accounts.filter(a => a.type === 'credit_card')
  if (ccAccounts.length === 0) return []

  const faturasGroup = {
    id: 'system_cc_invoices',
    name: 'Faturas de Cartão',
    type: 'expense' as const,
    sortOrder: -1,
    isHidden: false,
    isSystem: true,
  }

  const faturasCatRows: InvoiceCategoryBudgetRow[] = []

  for (const acc of ccAccounts) {
    if (!acc.id) continue
    const catId = `cc_invoice_${acc.id}`
    const catName = `Fatura ${acc.name}`

    const accTxs = transactions.filter(t => t.accountId === acc.id)
    const invoiceActivity = getInvoiceForBudgetMonth(accTxs, acc, month)
    const directActivity = activityMap.get(catId) ?? 0
    const activity = invoiceActivity + directActivity

    faturasCatRows.push({
      category: {
        id: catId,
        groupId: 'system_cc_invoices',
        name: catName,
        sortOrder: 0,
        isHidden: false,
      },
      activity,
    })
  }

  return [
    {
      group: faturasGroup,
      categories: faturasCatRows,
      totalActivity: faturasCatRows.reduce((s, r) => s + r.activity, 0),
    },
  ]
}

export function calculateBudgetSummary(
  month: string,
  accounts: Account[],
  categoryGroups: CategoryGroup[],
  categories: Category[],
  budgetMonths: BudgetMonth[],
  transactions: Transaction[]
): BudgetSummary {
  const accountMap = new Map(accounts.map(a => [a.id!, a]))
  const allIncomeTxs = transactions.filter(t => t.type === 'income' && accountMap.get(t.accountId)?.type !== 'off_budget')
  const allExpenseTxs = transactions.filter(t => t.type === 'expense' && accountMap.get(t.accountId)?.type !== 'off_budget')
  const ccAccounts = accounts.filter(a => a.type === 'credit_card')

  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

  const ignoredCategoryIds = new Set<string>()
  for (const cat of categories) {
    if (!cat.id) continue
    const grp = groupMap.get(cat.groupId)
    if (grp?.type === 'income' || isInitialSetupCategory(cat.name, grp?.name)) {
      ignoredCategoryIds.add(cat.id)
    }
  }

  const initialFunds = accounts
    .filter(a => a.type === 'checking')
    .reduce((sum, a) => sum + (a.initialBalance || 0), 0)

  let totalIncome = 0
  let priorIncome = 0

  for (const tx of allIncomeTxs) {
    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth === month) {
      totalIncome += tx.amount
    } else if (txMonth < month) {
      priorIncome += tx.amount
    }
  }

  const expensesByMonthCategory = new Map<string, number>()
  const uncategorizedExpensesByMonth = new Map<string, number>()

  for (const tx of allExpenseTxs) {
    const txMonth = toMonthKey(new Date(tx.date))
    if (tx.categoryId && ignoredCategoryIds.has(tx.categoryId)) continue
    if (tx.categoryId) {
      const key = `${txMonth}:${tx.categoryId}`
      expensesByMonthCategory.set(key, (expensesByMonthCategory.get(key) || 0) + tx.amount)
    } else {
      uncategorizedExpensesByMonth.set(
        txMonth,
        (uncategorizedExpensesByMonth.get(txMonth) || 0) + tx.amount
      )
    }
  }

  const allMonthsSet = new Set<string>()
  for (const tx of transactions) allMonthsSet.add(toMonthKey(new Date(tx.date)))
  for (const b of budgetMonths) allMonthsSet.add(b.month)
  allMonthsSet.add(month)

  const priorMonths = Array.from(allMonthsSet).filter(m => m < month).sort()

  let totalBudgeted = 0
  let totalAllTimeBudgeted = 0
  let priorTotalBudgeted = 0

  for (const b of budgetMonths) {
    if (ignoredCategoryIds.has(b.categoryId)) continue
    if (b.month === month) totalBudgeted += b.budgeted
    else if (b.month < month) priorTotalBudgeted += b.budgeted
    totalAllTimeBudgeted += b.budgeted
  }

  let priorOverspending = 0
  for (const pMonth of priorMonths) {
    const pBudgets = budgetMonths.filter(b => b.month === pMonth && !ignoredCategoryIds.has(b.categoryId))
    for (const b of pBudgets) {
      const exp = expensesByMonthCategory.get(`${pMonth}:${b.categoryId}`) || 0
      if (exp > b.budgeted) priorOverspending += (exp - b.budgeted)
    }
    const pBudgetCatIds = new Set(pBudgets.map(b => b.categoryId))
    for (const [key, exp] of expensesByMonthCategory.entries()) {
      const [mKey, cId] = key.split(':')
      if (mKey === pMonth && !pBudgetCatIds.has(cId)) priorOverspending += exp
    }
    priorOverspending += (uncategorizedExpensesByMonth.get(pMonth) || 0)
  }

  let priorInvoicesPaid = 0
  let currentInvoicesDue = 0

  for (const acc of ccAccounts) {
    if (!acc.id || !acc.statementClosingDay) continue
    const accTxs = transactions.filter(t => t.accountId === acc.id)

    for (const pMonth of priorMonths) {
      const invoiceAmt = getInvoiceForBudgetMonth(accTxs, acc, pMonth)
      priorInvoicesPaid += invoiceAmt
    }

    const currInvoiceAmt = getInvoiceForBudgetMonth(accTxs, acc, month)
    currentInvoicesDue += currInvoiceAmt
  }

  const previousMonthSurplus = initialFunds + priorIncome - priorTotalBudgeted - priorOverspending - priorInvoicesPaid
  const toBeBudgeted = previousMonthSurplus + totalIncome - totalBudgeted - currentInvoicesDue

  return {
    month,
    initialFunds,
    totalIncome,
    totalBudgeted,
    currentInvoicesDue,
    previousMonthSurplus,
    priorOverspending,
    totalAllTimeBudgeted,
    toBeBudgeted,
  }
}
