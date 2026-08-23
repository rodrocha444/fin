import { getClient } from './client'
import { createId } from '@/utils/id'
import { format, subMonths } from 'date-fns'
import { isInitialSetupCategory, currentMonth, shiftMonth } from '@/utils/format'
import { getInvoiceForBudgetMonth } from '@/utils/invoices'
import { getPaidInvoicesMap } from '@/services/api/invoices'
import { isDateBeforeAccountingStart, isMonthBeforeAccountingStart } from '@/utils/accountingPeriod'
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
    g => g.type !== 'income'
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
  budgetMonths: BudgetMonth[],
  transactions: Transaction[]
): IncomeGroupBudgetRow[] {
  const incomeMap = calculateIncomeByCategory(transactions, month)
  const budgetByCategory = new Map(
    budgetMonths.filter(b => b.month === month).map(b => [b.categoryId, b])
  )
  const incomeGroups = categoryGroups.filter(g => g.type === 'income')
  const rows: IncomeGroupBudgetRow[] = []

  for (const group of incomeGroups) {
    if (group.isHidden) continue
    const groupCategories = categories.filter(c => c.groupId === group.id && !c.isHidden)
    if (groupCategories.length === 0) continue

    const catRows: IncomeCategoryBudgetRow[] = []

    for (const cat of groupCategories) {
      if (!cat.id) continue
      const budgetRec = budgetByCategory.get(cat.id)
      const expected = budgetRec?.budgeted ?? 0
      const received = incomeMap.get(cat.id) ?? 0
      const difference = expected - received

      catRows.push({ category: cat, expected, received, difference })
    }

    rows.push({
      group,
      categories: catRows,
      totalExpected: catRows.reduce((s, r) => s + r.expected, 0),
      totalReceived: catRows.reduce((s, r) => s + r.received, 0),
      totalDifference: catRows.reduce((s, r) => s + r.difference, 0),
    })
  }

  return rows
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
  
  // Filtra apenas transações dentro do período contábil ativo
  const validTxs = transactions.filter(t => !isDateBeforeAccountingStart(t.date))
  const allIncomeTxs = validTxs.filter(t => t.type === 'income' && accountMap.get(t.accountId)?.type !== 'off_budget')
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

  // Receitas do mês selecionado
  let totalIncome = 0
  for (const tx of allIncomeTxs) {
    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth === month) {
      totalIncome += tx.amount
    }
  }

  // Total orçado nas categorias de despesa no mês selecionado
  let totalBudgeted = 0
  for (const b of budgetMonths) {
    if (isMonthBeforeAccountingStart(b.month)) continue
    if (ignoredCategoryIds.has(b.categoryId)) continue
    if (b.month === month) totalBudgeted += b.budgeted
  }

  // Saldo real consolidado das contas correntes/caixa no período até o mês selecionado
  let totalCheckingCash = 0
  for (const acc of accounts) {
    if (acc.type !== 'checking' || acc.isActive === false) continue
    let bal = Number(acc.initialBalance || 0)
    for (const tx of validTxs) {
      const txMonth = toMonthKey(new Date(tx.date))
      if (txMonth > month) continue

      if (tx.accountId === acc.id) {
        const amt = Number(tx.amount || 0)
        if (tx.type === 'income') bal += amt
        else if (tx.type === 'expense' || tx.type === 'transfer') bal -= amt
      }
      if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
        bal += Number(tx.amount || 0)
      }
    }
    totalCheckingCash += bal
  }

  const paidMap = getPaidInvoicesMap()

  // Faturas de cartão de crédito a vencer no mês selecionado (apenas as NÃO pagas)
  let currentInvoicesDue = 0
  for (const acc of ccAccounts) {
    if (!acc.id || !acc.statementClosingDay) continue
    const accTxs = transactions.filter(t => t.accountId === acc.id)
    const currInvoiceAmt = getInvoiceForBudgetMonth(accTxs, acc, month, paidMap)
    currentInvoicesDue += currInvoiceAmt
  }

  const curMonth = currentMonth()
  const isFutureMonth = month > curMonth

  // ── MODO PROJEÇÃO EM CASCATA PARA MESES FUTUROS ──────────────
  if (isFutureMonth) {
    // 1. Saldo real consolidado em conta corrente até o mês atual
    let checkingCashNow = 0
    for (const acc of accounts) {
      if (acc.type !== 'checking' || acc.isActive === false) continue
      let bal = Number(acc.initialBalance || 0)
      for (const tx of validTxs) {
        const txMonth = toMonthKey(new Date(tx.date))
        if (txMonth > curMonth) continue

        if (tx.accountId === acc.id) {
          const amt = Number(tx.amount || 0)
          if (tx.type === 'income') bal += amt
          else if (tx.type === 'expense' || tx.type === 'transfer') bal -= amt
        }
        if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
          bal += Number(tx.amount || 0)
        }
      }
      checkingCashNow += bal
    }

    // 2. Despesas orçadas e receitas pendentes do mês atual
    let nowBudgeted = 0
    for (const b of budgetMonths) {
      if (isMonthBeforeAccountingStart(b.month)) continue
      if (ignoredCategoryIds.has(b.categoryId)) continue
      if (b.month === curMonth) nowBudgeted += b.budgeted
    }

    const nowIncomeMap = calculateIncomeByCategory(transactions, curMonth)
    const nowBudgetMap = new Map(
      budgetMonths.filter(b => b.month === curMonth).map(b => [b.categoryId, b])
    )
    let nowPendingIncome = 0
    for (const cat of categories) {
      if (!cat.id) continue
      const grp = groupMap.get(cat.groupId)
      if (grp?.type !== 'income') continue
      const expected = nowBudgetMap.get(cat.id)?.budgeted ?? 0
      const received = nowIncomeMap.get(cat.id) ?? 0
      if (expected > received) {
        nowPendingIncome += (expected - received)
      }
    }

    // Sobra projetada do mês atual que transborda para o planejamento
    let runningSurplus = checkingCashNow - nowBudgeted + nowPendingIncome

    // 3. Iterar pelos meses futuros intermediários até o mês selecionado
    let mCursor = shiftMonth(curMonth, 1)
    let rolloverForSelectedMonth = runningSurplus

    while (mCursor <= month) {
      const cursorBudgetMap = new Map(
        budgetMonths.filter(b => b.month === mCursor).map(b => [b.categoryId, b])
      )
      const cursorIncomeMap = calculateIncomeByCategory(transactions, mCursor)

      let cursorExpectedIncome = 0
      for (const cat of categories) {
        if (!cat.id) continue
        const grp = groupMap.get(cat.groupId)
        if (grp?.type !== 'income') continue
        const expected = cursorBudgetMap.get(cat.id)?.budgeted ?? 0
        const received = cursorIncomeMap.get(cat.id) ?? 0
        cursorExpectedIncome += Math.max(expected, received)
      }

      let cursorBudgetedExpenses = 0
      for (const b of budgetMonths) {
        if (isMonthBeforeAccountingStart(b.month)) continue
        if (ignoredCategoryIds.has(b.categoryId)) continue
        if (b.month === mCursor) cursorBudgetedExpenses += b.budgeted
      }

      if (mCursor === month) {
        rolloverForSelectedMonth = runningSurplus
        const futureToBeBudgeted = rolloverForSelectedMonth + cursorExpectedIncome - cursorBudgetedExpenses

        return {
          month,
          isFutureMonth: true,
          rolloverFromPreviousMonth: rolloverForSelectedMonth,
          totalIncome,
          totalExpectedIncome: cursorExpectedIncome,
          pendingExpectedIncome: cursorExpectedIncome,
          totalBudgeted: cursorBudgetedExpenses,
          currentInvoicesDue,
          toBeBudgeted: futureToBeBudgeted,
          projectedToBeBudgeted: futureToBeBudgeted,
        }
      }

      runningSurplus = runningSurplus + cursorExpectedIncome - cursorBudgetedExpenses
      mCursor = shiftMonth(mCursor, 1)
    }
  }

  // ── MODO CAIXA REAL (MÊS ATUAL OU PASSADO) ─────────────────────
  // Previsão de receitas orçadas para o mês selecionado
  const incomeMap = calculateIncomeByCategory(transactions, month)
  const budgetMap = new Map(
    budgetMonths.filter(b => b.month === month).map(b => [b.categoryId, b])
  )
  let totalExpectedIncome = 0
  let pendingExpectedIncome = 0

  for (const cat of categories) {
    if (!cat.id) continue
    const grp = groupMap.get(cat.groupId)
    if (grp?.type !== 'income') continue
    const expected = budgetMap.get(cat.id)?.budgeted ?? 0
    const received = incomeMap.get(cat.id) ?? 0
    totalExpectedIncome += expected
    if (expected > received) {
      pendingExpectedIncome += (expected - received)
    }
  }

  // Disponível a Orçar (Caixa Real): Dinheiro total disponível em conta corrente menos o valor alocado nas categorias do mês
  const toBeBudgeted = totalCheckingCash - totalBudgeted
  // Disponível a Orçar Projetado: Saldo a orçar somado às receitas previstas que ainda faltam entrar
  const projectedToBeBudgeted = toBeBudgeted + pendingExpectedIncome

  return {
    month,
    isFutureMonth: false,
    rolloverFromPreviousMonth: 0,
    totalIncome,
    totalExpectedIncome,
    pendingExpectedIncome,
    totalBudgeted,
    currentInvoicesDue,
    toBeBudgeted,
    projectedToBeBudgeted,
  }
}
