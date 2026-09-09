import { getClient } from './client'
import { rowToTransaction, rowToBudgetMonth, rowToAccount, rowToInstallmentGroup } from './types'
import { createId } from '@/utils/id'
import { format, subMonths } from 'date-fns'
import { isInitialSetupCategory, currentMonth } from '@/utils/format'
import { getInvoiceForBudgetMonth, getTransactionEffectiveMonth } from '@/utils/invoices'
import { getPaidInvoicesMap } from '@/services/api/invoices'
import { isDateBeforeAccountingStart, isMonthBeforeAccountingStart } from '@/utils/accountingPeriod'
import { buildGroupPurchaseMonthMap, type AccountingRegime } from '@/utils/accountingRegime'
import { notifyDataChanged } from './events'
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  BudgetType,
  Transaction,
  InstallmentGroup,
  GroupBudgetRow,
  CategoryBudgetRow,
  IncomeGroupBudgetRow,
  IncomeCategoryBudgetRow,
  BudgetSummary,
} from '@/types'

export async function getBudgetMonths(): Promise<BudgetMonth[]> {
  const client = getClient()
  const { data, error } = await client.from('budget_months').select('*')
  if (error) throw new Error(`Erro ao buscar orçamentos: ${error.message}`)
  return (data || []).map(rowToBudgetMonth)
}

export async function getBudgetMonth(month: string): Promise<BudgetMonth[]> {
  const client = getClient()
  const { data, error } = await client.from('budget_months').select('*').eq('month', month)
  if (error) throw new Error(`Erro ao buscar orçamento do mês: ${error.message}`)
  return (data || []).map(rowToBudgetMonth)
}

export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

export async function setBudget(
  month: string,
  categoryId: string,
  budgeted: number,
  notify: boolean = true,
  budgetType: BudgetType = 'cash'
): Promise<void> {
  const client = getClient()
  const { data: rows } = await client
    .from('budget_months')
    .select('*')
    .eq('month', month)
    .eq('category_id', categoryId)

  const matching = (rows || []).filter(r => (r.budget_type || 'cash') === budgetType)

  if (matching.length > 0) {
    const primaryId = matching[0].id
    const { error } = await client
      .from('budget_months')
      .update({ budgeted, budget_type: budgetType, updated_at: new Date().toISOString() })
      .eq('id', primaryId)

    if (error) {
      // Fallback se a coluna budget_type não existir no banco
      const { error: fbErr } = await client
        .from('budget_months')
        .update({ budgeted, updated_at: new Date().toISOString() })
        .eq('id', primaryId)
      if (fbErr) throw new Error(`Erro ao salvar orçamento: ${fbErr.message}`)
    }

    // Deletar duplicatas excedentes se existirem
    if (matching.length > 1) {
      const duplicateIds = matching.slice(1).map(r => r.id).filter(Boolean)
      if (duplicateIds.length > 0) {
        await client.from('budget_months').delete().in('id', duplicateIds)
      }
    }
  } else {
    const id = createId()
    const { error } = await client.from('budget_months').insert({
      id,
      month,
      category_id: categoryId,
      budget_type: budgetType,
      budgeted,
      activity: 0,
      available: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      // Fallback se a coluna budget_type não existir no banco
      const { error: fbErr } = await client.from('budget_months').insert({
        id,
        month,
        category_id: categoryId,
        budgeted,
        activity: 0,
        available: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (fbErr) {
        // Se ainda falhar (ex: duplicate key por constraint unique antiga), tenta update
        const { error: updErr } = await client
          .from('budget_months')
          .update({ budgeted, updated_at: new Date().toISOString() })
          .eq('month', month)
          .eq('category_id', categoryId)
        if (updErr) throw new Error(`Erro ao salvar orçamento: ${updErr.message}`)
      }
    }
  }
  if (notify) {
    notifyDataChanged('budget_months', 'upsert')
  }
}

export async function copyFromPreviousMonth(targetMonth: string, budgetType: BudgetType = 'cash'): Promise<void> {
  const client = getClient()
  const [year, mon] = targetMonth.split('-').map(Number)
  const prevDate = subMonths(new Date(year, mon - 1), 1)
  const prevMonth = format(prevDate, 'yyyy-MM')

  const { data: prevBudgets } = await client.from('budget_months').select('*').eq('month', prevMonth)
  if (!prevBudgets || prevBudgets.length === 0) return

  const filtered = prevBudgets.filter(b => (b.budget_type || 'cash') === budgetType)

  for (const prev of filtered) {
    await setBudget(targetMonth, prev.category_id, Number(prev.budgeted || 0), false, budgetType)
  }
  notifyDataChanged('budget_months', 'upsert')
}

export async function clearMonthBudgets(month: string, budgetType: BudgetType = 'cash'): Promise<void> {
  const client = getClient()
  const { data: rows } = await client.from('budget_months').select('*').eq('month', month)
  const toClear = (rows || []).filter(r => (r.budget_type || 'cash') === budgetType)
  for (const r of toClear) {
    await client.from('budget_months').update({ budgeted: 0, updated_at: new Date().toISOString() }).eq('id', r.id)
  }
  notifyDataChanged('budget_months', 'update')
}

export async function coverMonthSpent(
  month: string,
  rows?: GroupBudgetRow[],
  budgetType: BudgetType = 'cash'
): Promise<void> {
  if (rows && rows.length > 0) {
    for (const groupRow of rows) {
      for (const catRow of groupRow.categories) {
        if (catRow.category.id) {
          await setBudget(month, catRow.category.id, catRow.activity, false, budgetType)
        }
      }
    }
    notifyDataChanged('budget_months', 'upsert')
    return
  }

  const client = getClient()
  const { data: txsData, error: txsErr } = await client.from('transactions').select('*')
  if (txsErr) throw new Error(`Erro ao buscar transações: ${txsErr.message}`)
  const { data: accsData } = await client.from('accounts').select('*')
  const { data: grpData } = await client.from('installment_groups').select('*')
  const txs = (txsData || []).map(rowToTransaction)
  const accounts = (accsData || []).map(rowToAccount)
  const instGroups = (grpData || []).map(rowToInstallmentGroup)
  const activityMap = calculateActivityByCategory(txs, month, accounts, budgetType, instGroups)

  for (const [catId, spent] of activityMap.entries()) {
    await setBudget(month, catId, spent, false, budgetType)
  }

  notifyDataChanged('budget_months', 'upsert')
}

/**
 * Funções puras de cálculo de orçamento (instantâneas com dados em memória)
 */

export function calculateActivityByCategory(
  transactions: Transaction[],
  month: string,
  accounts?: Account[] | Map<string, Account>,
  regime: AccountingRegime = 'cash',
  installmentGroups: InstallmentGroup[] = []
): Map<string, number> {
  const map = new Map<string, number>()
  const accountMap = accounts
    ? (Array.isArray(accounts) ? new Map(accounts.map(a => [a.id!, a])) : accounts)
    : undefined
  const groupMonthMap = regime === 'accrual'
    ? buildGroupPurchaseMonthMap(transactions, installmentGroups)
    : undefined

  for (const tx of transactions) {
    if (isDateBeforeAccountingStart(tx.date)) continue

    let isExpense = tx.type === 'expense' && (accountMap && tx.accountId ? accountMap.get(tx.accountId)?.type !== 'off_budget' : true)
    if (tx.type === 'transfer' && accountMap) {
      const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
      // Saída do orçamento para conta off-budget conta como despesa no orçamento
      if (fromAcc?.type !== 'off_budget' && toAcc?.type === 'off_budget') {
        isExpense = true
      }
    }
    if (!isExpense) continue

    if (regime === 'accrual') {
      if (tx.installmentGroupId) {
        const purchaseMonth = groupMonthMap?.get(tx.installmentGroupId)
        if (purchaseMonth !== month) continue
      } else {
        const txMonth = toMonthKey(new Date(tx.date))
        if (txMonth !== month) continue
      }
    } else {
      const effectiveMonth = accountMap
        ? getTransactionEffectiveMonth(tx, accountMap)
        : toMonthKey(new Date(tx.date))
      if (effectiveMonth !== month) continue
    }

    if (tx.categoryId) {
      const current = map.get(tx.categoryId) || 0
      const updated = Math.round((current + Number(tx.amount || 0)) * 100) / 100
      map.set(tx.categoryId, Math.abs(updated) < 0.005 ? 0 : updated)
    }
  }
  return map
}

export function calculateIncomeByCategory(
  transactions: Transaction[],
  month: string,
  accounts?: Account[] | Map<string, Account>,
  _regime: AccountingRegime = 'cash'
): Map<string, number> {
  const map = new Map<string, number>()
  const accountMap = accounts
    ? (Array.isArray(accounts) ? new Map(accounts.map(a => [a.id!, a])) : accounts)
    : undefined

  for (const tx of transactions) {
    if (isDateBeforeAccountingStart(tx.date)) continue

    let isIncome = tx.type === 'income' && (accountMap && tx.accountId ? accountMap.get(tx.accountId)?.type !== 'off_budget' : true)
    if (tx.type === 'transfer' && accountMap) {
      const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
      // Entrada no orçamento vinda de conta off-budget conta como renda no orçamento
      if (fromAcc?.type === 'off_budget' && toAcc?.type !== 'off_budget') {
        isIncome = true
      }
    }
    if (!isIncome) continue

    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth !== month) continue
    if (tx.categoryId) {
      const current = map.get(tx.categoryId) || 0
      const updated = Math.round((current + Number(tx.amount || 0)) * 100) / 100
      map.set(tx.categoryId, Math.abs(updated) < 0.005 ? 0 : updated)
    }
  }
  return map
}

export function calculateBudgetRows(
  month: string,
  categoryGroups: CategoryGroup[],
  categories: Category[],
  budgetMonths: BudgetMonth[],
  transactions: Transaction[],
  accounts?: Account[],
  regime: AccountingRegime = 'cash',
  installmentGroups: InstallmentGroup[] = []
): GroupBudgetRow[] {
  const activityMap = calculateActivityByCategory(transactions, month, accounts, regime, installmentGroups)
  const budgetByCategory = new Map(
    budgetMonths
      .filter(b => b.month === month && (b.budgetType || 'cash') === regime)
      .map(b => [b.categoryId, b])
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
      const budgeted = Math.round(Number(budgetRec?.budgeted ?? 0) * 100) / 100
      const activity = Math.round(Number(activityMap.get(cat.id) ?? 0) * 100) / 100
      const rawAvailable = budgeted - activity
      const roundedAvailable = Math.round(rawAvailable * 100) / 100
      const available = Math.abs(roundedAvailable) < 0.005 ? 0 : roundedAvailable

      catRows.push({
        category: cat,
        budgeted: Math.abs(budgeted) < 0.005 ? 0 : budgeted,
        activity: Math.abs(activity) < 0.005 ? 0 : activity,
        available,
      })
    }

    const rawTotalBudgeted = catRows.reduce((s, r) => s + r.budgeted, 0)
    const rawTotalActivity = catRows.reduce((s, r) => s + r.activity, 0)
    const rawTotalAvailable = catRows.reduce((s, r) => s + r.available, 0)

    const roundedTotalBudgeted = Math.round(rawTotalBudgeted * 100) / 100
    const roundedTotalActivity = Math.round(rawTotalActivity * 100) / 100
    const roundedTotalAvailable = Math.round(rawTotalAvailable * 100) / 100

    rows.push({
      group,
      categories: catRows,
      totalBudgeted: Math.abs(roundedTotalBudgeted) < 0.005 ? 0 : roundedTotalBudgeted,
      totalActivity: Math.abs(roundedTotalActivity) < 0.005 ? 0 : roundedTotalActivity,
      totalAvailable: Math.abs(roundedTotalAvailable) < 0.005 ? 0 : roundedTotalAvailable,
    })
  }

  return rows
}

export function calculateIncomeBudgetRows(
  month: string,
  categoryGroups: CategoryGroup[],
  categories: Category[],
  budgetMonths: BudgetMonth[],
  transactions: Transaction[],
  accounts?: Account[],
  regime: AccountingRegime = 'cash'
): IncomeGroupBudgetRow[] {
  const incomeMap = calculateIncomeByCategory(transactions, month, accounts, regime)
  const budgetByCategory = new Map(
    budgetMonths
      .filter(b => b.month === month && (b.budgetType || 'cash') === regime)
      .map(b => [b.categoryId, b])
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
      const expected = Math.round(Number(budgetRec?.budgeted ?? 0) * 100) / 100
      const received = Math.round(Number(incomeMap.get(cat.id) ?? 0) * 100) / 100
      const rawDiff = expected - received
      const roundedDiff = Math.round(rawDiff * 100) / 100
      const difference = Math.abs(roundedDiff) < 0.005 ? 0 : roundedDiff

      catRows.push({
        category: cat,
        expected: Math.abs(expected) < 0.005 ? 0 : expected,
        received: Math.abs(received) < 0.005 ? 0 : received,
        difference,
      })
    }

    const rawTotalExpected = catRows.reduce((s, r) => s + r.expected, 0)
    const rawTotalReceived = catRows.reduce((s, r) => s + r.received, 0)
    const rawTotalDiff = catRows.reduce((s, r) => s + r.difference, 0)

    const roundedTotalExpected = Math.round(rawTotalExpected * 100) / 100
    const roundedTotalReceived = Math.round(rawTotalReceived * 100) / 100
    const roundedTotalDiff = Math.round(rawTotalDiff * 100) / 100

    rows.push({
      group,
      categories: catRows,
      totalExpected: Math.abs(roundedTotalExpected) < 0.005 ? 0 : roundedTotalExpected,
      totalReceived: Math.abs(roundedTotalReceived) < 0.005 ? 0 : roundedTotalReceived,
      totalDifference: Math.abs(roundedTotalDiff) < 0.005 ? 0 : roundedTotalDiff,
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
  transactions: Transaction[],
  regime: AccountingRegime = 'cash',
  _installmentGroups: InstallmentGroup[] = []
): BudgetSummary {
  const accountMap = new Map(accounts.map(a => [a.id!, a]))
  
  // Filtra apenas transações dentro do período contábil ativo
  const validTxs = transactions.filter(t => !isDateBeforeAccountingStart(t.date))
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

  // Receitas recebidas/realizadas única e exclusivamente no mês selecionado
  let totalIncome = 0
  for (const tx of validTxs) {
    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth !== month) continue
    if (tx.type === 'income' && accountMap.get(tx.accountId)?.type !== 'off_budget') {
      totalIncome += tx.amount
    } else if (tx.type === 'transfer') {
      const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
      if (fromAcc?.type === 'off_budget' && toAcc?.type !== 'off_budget') {
        totalIncome += tx.amount
      }
    }
  }

  // Total orçado nas categorias de despesa única e exclusivamente no mês selecionado para o regime ativo
  let totalBudgeted = 0
  for (const b of budgetMonths) {
    if (b.month !== month) continue
    if (isMonthBeforeAccountingStart(b.month)) continue
    if ((b.budgetType || 'cash') !== regime) continue
    if (ignoredCategoryIds.has(b.categoryId)) continue
    totalBudgeted += Number(b.budgeted || 0)
  }

  // Receitas orçadas/esperadas única e exclusivamente para o mês selecionado
  const incomeMap = calculateIncomeByCategory(transactions, month, accounts, regime)
  const budgetMap = new Map(
    budgetMonths
      .filter(b => b.month === month && (b.budgetType || 'cash') === regime)
      .map(b => [b.categoryId, b])
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

  // Disponível a Orçar:
  // Se for mês futuro e o usuário definiu receitas previstas (ou não recebeu renda ainda):
  // o saldo a orçar baseia-se na renda prevista do próprio mês menos as despesas orçadas do próprio mês.
  // No mês atual/passado:
  // toBeBudgeted = receitas recebidas no mês - despesas orçadas no mês.
  // projectedToBeBudgeted = (receitas recebidas + receitas previstas pendentes) - despesas orçadas no mês.
  
  let rawToBeBudgeted: number
  let rawProjToBeBudgeted: number

  if (isFutureMonth) {
    const plannedIncome = totalExpectedIncome > 0 ? totalExpectedIncome : totalIncome
    rawToBeBudgeted = plannedIncome - totalBudgeted
    rawProjToBeBudgeted = (totalIncome + pendingExpectedIncome) > 0 
      ? (totalIncome + pendingExpectedIncome) - totalBudgeted 
      : plannedIncome - totalBudgeted
  } else {
    rawToBeBudgeted = totalIncome - totalBudgeted
    rawProjToBeBudgeted = (totalIncome + pendingExpectedIncome) - totalBudgeted
  }

  const roundedTBB = Math.round(rawToBeBudgeted * 100) / 100
  const finalTBB = Math.abs(roundedTBB) < 0.005 ? 0 : roundedTBB

  const roundedProjTBB = Math.round(rawProjToBeBudgeted * 100) / 100
  const finalProjTBB = Math.abs(roundedProjTBB) < 0.005 ? 0 : roundedProjTBB

  const roundedIncome = Math.round(totalIncome * 100) / 100
  const finalIncome = Math.abs(roundedIncome) < 0.005 ? 0 : roundedIncome

  const roundedExpected = Math.round(totalExpectedIncome * 100) / 100
  const finalExpected = Math.abs(roundedExpected) < 0.005 ? 0 : roundedExpected

  const roundedPending = Math.round(pendingExpectedIncome * 100) / 100
  const finalPending = Math.abs(roundedPending) < 0.005 ? 0 : roundedPending

  const roundedBudgeted = Math.round(totalBudgeted * 100) / 100
  const finalBudgeted = Math.abs(roundedBudgeted) < 0.005 ? 0 : roundedBudgeted

  const roundedInvoices = Math.round(currentInvoicesDue * 100) / 100
  const finalInvoices = Math.abs(roundedInvoices) < 0.005 ? 0 : roundedInvoices

  return {
    month,
    isFutureMonth,
    rolloverFromPreviousMonth: 0,
    totalIncome: finalIncome,
    totalExpectedIncome: finalExpected,
    pendingExpectedIncome: finalPending,
    totalBudgeted: finalBudgeted,
    currentInvoicesDue: finalInvoices,
    toBeBudgeted: finalTBB,
    projectedToBeBudgeted: finalProjTBB,
  }
}
