import { getClient } from './client'
import { rowToTransaction, rowToBudgetMonth, rowToAccount, rowToInstallmentGroup } from './types'
import { createId } from '@/utils/id'
import { format, subMonths } from 'date-fns'
import { isInitialSetupCategory, currentMonth } from '@/utils/format'

import { getInvoiceCycle, getInvoiceData } from '@/utils/invoices'
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

// ─────────────────────────────────────────────────────────────────────────────
// Funções puras de cálculo (em memória)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina o mês orçamentário efetivo de uma transação de despesa.
 *
 * - Regime de Caixa (cash):
 *   • Conta corrente → mês da data da transação
 *   • Cartão de crédito → mês de **fechamento da fatura** em que a compra caiu
 *     (ex: fechamento dia 22; compra em 15/ago → fatura de ago; compra em 23/ago → fatura de set)
 *
 * - Regime de Competência (accrual):
 *   • Parcelas → mês de início do grupo
 *   • Outros → mês da data da transação
 */
function getExpenseEffectiveMonth(
  tx: Transaction,
  accountMap: Map<string, Account>,
  regime: AccountingRegime,
  groupMonthMap?: Map<string, string>
): string | null {
  const txDate = new Date(tx.date)

  if (regime === 'accrual') {
    if (tx.installmentGroupId && groupMonthMap) {
      return groupMonthMap.get(tx.installmentGroupId) ?? null
    }
    return toMonthKey(txDate)
  }

  // Regime de Caixa
  const account = tx.accountId ? accountMap.get(tx.accountId) : undefined
  if (account?.type === 'credit_card' && account.statementClosingDay) {
    // A fatura em que a compra cai é determinada pelo dia de fechamento:
    // compra no dia < closingDay → fatura do próprio mês da compra
    // compra no dia >= closingDay → fatura do mês seguinte
    const closingDay = account.statementClosingDay
    const txDay = txDate.getDate()
    const cycleMonthDate = txDay < closingDay ? txDate : new Date(txDate.getFullYear(), txDate.getMonth() + 1, 1)
    // Mês orçamentário = mês do fechamento da fatura (não o de vencimento)
    return toMonthKey(cycleMonthDate)
  }

  return toMonthKey(txDate)
}

/**
 * Calcula o mapa de atividade (gastos) por categoria para o mês selecionado.
 * Considera o regime contábil e o tipo de conta (cartão usa dia de fechamento).
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
    : new Map<string, Account>()
  const groupMonthMap = regime === 'accrual'
    ? buildGroupPurchaseMonthMap(transactions, installmentGroups)
    : undefined

  for (const tx of transactions) {
    if (isDateBeforeAccountingStart(tx.date)) continue

    let isExpense = false
    if (tx.type === 'expense') {
      const acc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      isExpense = acc?.type !== 'off_budget'
    } else if (tx.type === 'transfer') {
      const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
      // On-budget → off-budget: conta como despesa (saída do orçamento)
      isExpense = fromAcc?.type !== 'off_budget' && toAcc?.type === 'off_budget'
    }
    if (!isExpense) continue

    const effectiveMonth = getExpenseEffectiveMonth(tx, accountMap, regime, groupMonthMap)
    if (effectiveMonth !== month) continue

    if (tx.categoryId) {
      const current = map.get(tx.categoryId) ?? 0
      const updated = Math.round((current + tx.amount) * 100) / 100
      map.set(tx.categoryId, Math.abs(updated) < 0.005 ? 0 : updated)
    }
  }
  return map
}

/**
 * Calcula o mapa de receitas recebidas por categoria para o mês selecionado.
 * Receitas sempre usam a data real da transação (sem ajuste de fatura).
 */
export function calculateIncomeByCategory(
  transactions: Transaction[],
  month: string,
  accounts?: Account[] | Map<string, Account>
): Map<string, number> {
  const map = new Map<string, number>()
  const accountMap = accounts
    ? (Array.isArray(accounts) ? new Map(accounts.map(a => [a.id!, a])) : accounts)
    : new Map<string, Account>()

  for (const tx of transactions) {
    if (isDateBeforeAccountingStart(tx.date)) continue

    let isIncome = false
    if (tx.type === 'income') {
      const acc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      isIncome = acc?.type !== 'off_budget'
    } else if (tx.type === 'transfer') {
      const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
      // Off-budget → on-budget: conta como receita (entrada no orçamento)
      isIncome = fromAcc?.type === 'off_budget' && toAcc?.type !== 'off_budget'
    }
    if (!isIncome) continue

    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth !== month) continue

    if (tx.categoryId) {
      const current = map.get(tx.categoryId) ?? 0
      const updated = Math.round((current + tx.amount) * 100) / 100
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

  const expenseGroups = categoryGroups.filter(g => g.type !== 'income')
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
      const available = Math.abs(rawAvailable) < 0.005 ? 0 : Math.round(rawAvailable * 100) / 100

      catRows.push({
        category: cat,
        budgeted: Math.abs(budgeted) < 0.005 ? 0 : budgeted,
        activity: Math.abs(activity) < 0.005 ? 0 : activity,
        available,
      })
    }

    const totalBudgeted = Math.round(catRows.reduce((s, r) => s + r.budgeted, 0) * 100) / 100
    const totalActivity = Math.round(catRows.reduce((s, r) => s + r.activity, 0) * 100) / 100
    const totalAvailable = Math.round(catRows.reduce((s, r) => s + r.available, 0) * 100) / 100

    rows.push({
      group,
      categories: catRows,
      totalBudgeted: Math.abs(totalBudgeted) < 0.005 ? 0 : totalBudgeted,
      totalActivity: Math.abs(totalActivity) < 0.005 ? 0 : totalActivity,
      totalAvailable: Math.abs(totalAvailable) < 0.005 ? 0 : totalAvailable,
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
  const incomeMap = calculateIncomeByCategory(transactions, month, accounts)
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
      const difference = Math.abs(rawDiff) < 0.005 ? 0 : Math.round(rawDiff * 100) / 100

      catRows.push({
        category: cat,
        expected: Math.abs(expected) < 0.005 ? 0 : expected,
        received: Math.abs(received) < 0.005 ? 0 : received,
        difference,
      })
    }

    const totalExpected = Math.round(catRows.reduce((s, r) => s + r.expected, 0) * 100) / 100
    const totalReceived = Math.round(catRows.reduce((s, r) => s + r.received, 0) * 100) / 100
    const totalDiff = Math.round(catRows.reduce((s, r) => s + r.difference, 0) * 100) / 100

    rows.push({
      group,
      categories: catRows,
      totalExpected: Math.abs(totalExpected) < 0.005 ? 0 : totalExpected,
      totalReceived: Math.abs(totalReceived) < 0.005 ? 0 : totalReceived,
      totalDifference: Math.abs(totalDiff) < 0.005 ? 0 : totalDiff,
    })
  }

  return rows
}

/**
 * Calcula o resumo "Disponível a Orçar" (TBB — To Be Budgeted) para o mês.
 *
 * Lógica Zero-Based Budget:
 * TBB = Σ(saldo real das contas checking on-budget) − Σ(disponível positivo em todas as categorias de despesa)
 *
 * • Saldo de contas credit_card NÃO entra no TBB: o cartão é financiado pelo banco,
 *   não por dinheiro próprio. O pagamento da fatura (checking → credit_card) é
 *   que transfere dinheiro real para cobrir os gastos.
 * • Faturas de cartão aparecem como "Gasto" nas categorias no mês em que a fatura fecha,
 *   reduzindo o "Disponível" dessas categorias — o que naturalmente reduz o TBB.
 *
 * Receitas previstas (orçadas mas não recebidas) são exibidas como projeção
 * mas não aumentam o TBB real.
 */
export function calculateBudgetSummary(
  month: string,
  accounts: Account[],
  categoryGroups: CategoryGroup[],
  categories: Category[],
  budgetMonths: BudgetMonth[],
  transactions: Transaction[],
  regime: AccountingRegime = 'cash',
  installmentGroups: InstallmentGroup[] = []
): BudgetSummary {
  const accountMap = new Map(accounts.map(a => [a.id!, a]))

  // Filtra transações dentro do período contábil ativo
  const validTxs = transactions.filter(t => !isDateBeforeAccountingStart(t.date))

  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

  // Categorias que não participam do orçamento de despesas (income e setup iniciais)
  const ignoredCategoryIds = new Set<string>()
  for (const cat of categories) {
    if (!cat.id) continue
    const grp = groupMap.get(cat.groupId)
    if (grp?.type === 'income' || isInitialSetupCategory(cat.name, grp?.name)) {
      ignoredCategoryIds.add(cat.id)
    }
  }

  const curMonth = currentMonth()
  const isFutureMonth = month > curMonth

  // ── 1. Receitas recebidas no mês selecionado ─────────────────────────────
  let totalIncome = 0
  for (const tx of validTxs) {
    const txMonth = toMonthKey(new Date(tx.date))
    if (txMonth !== month) continue
    if (tx.type === 'income') {
      const acc = accountMap.get(tx.accountId)
      if (acc?.type !== 'off_budget') totalIncome += tx.amount
    } else if (tx.type === 'transfer') {
      const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
      const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
      if (fromAcc?.type === 'off_budget' && toAcc?.type !== 'off_budget') {
        totalIncome += tx.amount
      }
    }
  }

  // ── 2. Total orçado nas categorias de despesa no mês selecionado ─────────
  const expenseBudgetMap = new Map<string, number>()
  let totalBudgeted = 0
  for (const b of budgetMonths) {
    if (b.month !== month) continue
    if (isMonthBeforeAccountingStart(b.month)) continue
    if ((b.budgetType || 'cash') !== regime) continue
    if (ignoredCategoryIds.has(b.categoryId)) continue
    const val = Number(b.budgeted ?? 0)
    expenseBudgetMap.set(b.categoryId, val)
    totalBudgeted += val
  }

  // ── 3. Atividade/gastos por categoria ────────────────────────────────────
  const activityMap = calculateActivityByCategory(
    transactions, month, accounts, regime, installmentGroups
  )

  // ── 4. Receitas previstas (orçadas) para o mês selecionado ───────────────
  const incomeMap = calculateIncomeByCategory(transactions, month, accounts)
  const incomeBudgetMap = new Map(
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
    const expected = Number(incomeBudgetMap.get(cat.id)?.budgeted ?? 0)
    const received = incomeMap.get(cat.id) ?? 0
    totalExpectedIncome += expected
    if (expected > received) {
      pendingExpectedIncome += expected - received
    }
  }

  // ── 5. Saldo real das contas on-budget (apenas checking) ─────────────────
  //    Contas credit_card são financiadas pelo banco — o dinheiro real que cobre
  //    as compras no cartão só existe quando o usuário paga a fatura via checking.
  //    Portanto, apenas o saldo em checking representa dinheiro disponível real.
  let checkingBalance = 0
  for (const acc of accounts) {
    if (acc.type !== 'checking' || acc.isActive === false || !acc.id) continue
    let bal = Number(acc.initialBalance ?? 0)
    for (const tx of validTxs) {
      if (tx.accountId === acc.id) {
        if (tx.type === 'income') bal += tx.amount
        else if (tx.type === 'expense' || tx.type === 'transfer') bal -= tx.amount
      }
      if (tx.transferAccountId === acc.id && tx.type === 'transfer') {
        bal += tx.amount
      }
    }
    checkingBalance += bal
  }

  // ── 6. Total disponível positivo nas categorias de despesa ───────────────
  //    Apenas valores positivos contam: categorias no negativo já indicam
  //    que o usuário gastou mais do que orçou (overspent), o que já está
  //    refletido no saldo bancário reduzido.
  let totalPositiveAvailable = 0
  for (const cat of categories) {
    if (!cat.id) continue
    const grp = groupMap.get(cat.groupId)
    if (grp?.type === 'income' || isInitialSetupCategory(cat.name, grp?.name)) continue
    const budgeted = expenseBudgetMap.get(cat.id) ?? 0
    const spent = activityMap.get(cat.id) ?? 0
    const available = budgeted - spent
    if (available > 0.005) {
      totalPositiveAvailable += available
    }
  }

  // ── 6b. Faturas de cartão cujo fechamento cai no mês selecionado ──────────
  //    Essas faturas representam dinheiro já comprometido que ainda não saiu
  //    do checking. Precisamos descontar do TBB para que o usuário não ache
  //    que tem esse dinheiro disponível para orçar.
  //    Apenas faturas NÃO marcadas como pagas são descontadas.
  const paidMap = getPaidInvoicesMap()
  let pendingCCInvoices = 0
  const ccAccounts = accounts.filter(a => a.type === 'credit_card' && a.isActive !== false && a.id && a.statementClosingDay)

  for (const acc of ccAccounts) {
    const cycle = getInvoiceCycle(month, acc.statementClosingDay!, acc.paymentDueDay)
    const isMarkedPaid = Boolean(paidMap[`${acc.id}_${month}`])
    if (isMarkedPaid) continue
    const ccTxs = transactions.filter(t => t.accountId === acc.id)
    const invoiceData = getInvoiceData(ccTxs, cycle)
    if (invoiceData.totalAmount > 0.005) {
      pendingCCInvoices += invoiceData.totalAmount
    }
  }

  // ── 7. TBB = saldo em caixa (checking) − reservado nas categorias − fatura CC pendente
  const rawTBB = checkingBalance - totalPositiveAvailable - pendingCCInvoices
  const finalTBB = Math.abs(Math.round(rawTBB * 100) / 100) < 0.005
    ? 0
    : Math.round(rawTBB * 100) / 100

  const rawProjTBB = rawTBB + pendingExpectedIncome
  const finalProjTBB = Math.abs(Math.round(rawProjTBB * 100) / 100) < 0.005
    ? 0
    : Math.round(rawProjTBB * 100) / 100

  const round = (v: number) => {
    const r = Math.round(v * 100) / 100
    return Math.abs(r) < 0.005 ? 0 : r
  }

  return {
    month,
    isFutureMonth,
    rolloverFromPreviousMonth: 0,
    totalIncome: round(totalIncome),
    totalExpectedIncome: round(totalExpectedIncome),
    pendingExpectedIncome: round(pendingExpectedIncome),
    totalBudgeted: round(totalBudgeted),
    currentInvoicesDue: round(pendingCCInvoices),
    toBeBudgeted: finalTBB,
    projectedToBeBudgeted: finalProjTBB,
  }
}
