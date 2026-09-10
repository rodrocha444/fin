import { getClient } from './client'
import { rowToTransaction, rowToBudgetMonth, rowToAccount, rowToInstallmentGroup } from './types'
import { createId } from '@/utils/id'
import { format, subMonths, addMonths } from 'date-fns'
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

export function getRowBudgetType(r: { id?: string; budget_type?: string | null; budgetType?: BudgetType }): BudgetType {
  if (r.budget_type === 'accrual' || r.budgetType === 'accrual' || r.id?.startsWith('accrual:')) {
    return 'accrual'
  }
  return (r.budget_type as BudgetType) || (r.budgetType as BudgetType) || 'cash'
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

  const matching = (rows || []).filter(r => getRowBudgetType(r) === budgetType)

  if (matching.length > 0) {
    const primaryId = matching[0].id
    const { error } = await client
      .from('budget_months')
      .update({ budgeted, budget_type: budgetType, updated_at: new Date().toISOString() })
      .eq('id', primaryId)

    if (error) {
      // Fallback se a coluna budget_type não existir no banco (o primaryId já identifica o regime)
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
    const id = budgetType === 'accrual' ? `accrual:${createId()}` : createId()
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
      // Fallback se a coluna budget_type não existir no banco (o prefixo 'accrual:' no ID preserva o regime)
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
        // Se ainda falhar, tenta update pelo ID gerado
        const { error: updErr } = await client
          .from('budget_months')
          .update({ budgeted, updated_at: new Date().toISOString() })
          .eq('id', id)
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

  const filtered = prevBudgets.filter(b => getRowBudgetType(b) === budgetType)

  for (const prev of filtered) {
    await setBudget(targetMonth, prev.category_id, Number(prev.budgeted || 0), false, budgetType)
  }
  notifyDataChanged('budget_months', 'upsert')
}

export async function clearMonthBudgets(month: string, budgetType: BudgetType = 'cash'): Promise<void> {
  const client = getClient()
  const { data: rows } = await client.from('budget_months').select('*').eq('month', month)
  const toClear = (rows || []).filter(r => getRowBudgetType(r) === budgetType)
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
      .filter(b => b.month === month && getRowBudgetType(b) === regime)
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
      .filter(b => b.month === month && getRowBudgetType(b) === regime)
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
 * Mês atual/passado:
 *   TBB = Σ(saldo checking) − disponível_positivo_nas_categorias − fatura_CC_fechando_no_mês
 *
 * Meses futuros — encadeamento:
 *   Semente real      = TBB(mês_atual)
 *   Semente projetada = TBB(mês_atual) + renda_pendente_mês_atual
 *   Para cada mês de curMonth+1 até M:
 *     real      += 0                  − despesas_orçadas(m) − fatura_CC(m)
 *     projetado += renda_orçada(m)    − despesas_orçadas(m) − fatura_CC(m)
 *
 * O campo rolloverFromPreviousMonth expõe o TBB real do mês atual (a semente real).
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
  const validTxs = transactions.filter(t => !isDateBeforeAccountingStart(t.date))
  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))
  const catMap = new Map(categories.map(c => [c.id!, c]))
  const curMonth = currentMonth()
  const isFutureMonth = month > curMonth
  const round = (v: number) => { const r = Math.round(v * 100) / 100; return Math.abs(r) < 0.005 ? 0 : r }

  // Categorias ignoradas no orçamento de despesas
  const ignoredCategoryIds = new Set<string>()
  for (const cat of categories) {
    if (!cat.id) continue
    const grp = groupMap.get(cat.groupId)
    if (grp?.type === 'income' || isInitialSetupCategory(cat.name, grp?.name)) {
      ignoredCategoryIds.add(cat.id)
    }
  }

  const paidMap = getPaidInvoicesMap()
  const ccAccounts = accounts.filter(
    a => a.type === 'credit_card' && a.isActive !== false && a.id && a.statementClosingDay
  )

  // ── Saldo real das contas checking (fixo — sempre calculado sobre todas as txs) ──
  let checkingBalance = 0
  for (const acc of accounts) {
    if (acc.type !== 'checking' || acc.isActive === false || !acc.id) continue
    let bal = Number(acc.initialBalance ?? 0)
    for (const tx of validTxs) {
      if (tx.accountId === acc.id) {
        if (tx.type === 'income') bal += tx.amount
        else if (tx.type === 'expense' || tx.type === 'transfer') bal -= tx.amount
      }
      if (tx.transferAccountId === acc.id && tx.type === 'transfer') bal += tx.amount
    }
    checkingBalance += bal
  }

  // ── Helper: disponível positivo nas categorias de despesa para um mês ─────
  const computePositiveAvailable = (m: string): number => {
    const expMap = new Map<string, number>()
    for (const b of budgetMonths) {
      if (b.month !== m || isMonthBeforeAccountingStart(b.month)) continue
      if (getRowBudgetType(b) !== regime || ignoredCategoryIds.has(b.categoryId)) continue
      expMap.set(b.categoryId, Number(b.budgeted ?? 0))
    }
    const actMap = calculateActivityByCategory(transactions, m, accounts, regime, installmentGroups)
    let total = 0
    for (const cat of categories) {
      if (!cat.id) continue
      const grp = groupMap.get(cat.groupId)
      if (grp?.type === 'income' || isInitialSetupCategory(cat.name, grp?.name)) continue
      const av = (expMap.get(cat.id) ?? 0) - (actMap.get(cat.id) ?? 0)
      if (av > 0.005) total += av
    }
    return total
  }

  // ── Helper: fatura CC que fecha em mês m (apenas não pagas) ───────────────
  const computeCCInvoices = (m: string): number => {
    let total = 0
    for (const acc of ccAccounts) {
      if (paidMap[`${acc.id}_${m}`]) continue
      const cycle = getInvoiceCycle(m, acc.statementClosingDay!, acc.paymentDueDay)
      const ccTxs = transactions.filter(t => t.accountId === acc.id)
      const inv = getInvoiceData(ccTxs, cycle)
      if (inv.totalAmount > 0.005) total += inv.totalAmount
    }
    return total
  }

  // ── Helper: renda orçada e renda pendente para um mês ─────────────────────
  const computeIncomeStats = (m: string) => {
    const incomeMap = calculateIncomeByCategory(transactions, m, accounts)
    const incomeBudgetMap = new Map(
      budgetMonths.filter(b => b.month === m && getRowBudgetType(b) === regime).map(b => [b.categoryId, b])
    )
    let totalExpected = 0
    let pending = 0
    let received = 0
    for (const cat of categories) {
      if (!cat.id) continue
      const grp = groupMap.get(cat.groupId)
      if (grp?.type !== 'income') continue
      const exp = Number(incomeBudgetMap.get(cat.id)?.budgeted ?? 0)
      const rec = incomeMap.get(cat.id) ?? 0
      totalExpected += exp
      received += rec
      if (exp > rec) pending += exp - rec
    }
    return { totalExpected, pending, received }
  }

  // ── Helper: despesas orçadas e renda orçada de um mês (para chaining) ─────
  const computeMonthBudgetTotals = (m: string): { income: number; expense: number } => {
    let income = 0
    let expense = 0
    for (const b of budgetMonths) {
      if (b.month !== m || isMonthBeforeAccountingStart(b.month)) continue
      if (getRowBudgetType(b) !== regime) continue
      const cat = catMap.get(b.categoryId)
      const grp = cat ? groupMap.get(cat.groupId) : undefined
      if (grp?.type === 'income') {
        income += Number(b.budgeted ?? 0)
      } else if (!ignoredCategoryIds.has(b.categoryId)) {
        expense += Number(b.budgeted ?? 0)
      }
    }
    return { income, expense }
  }

  // ── Mês atual/passado: cálculo direto ────────────────────────────────────
  if (!isFutureMonth) {
    // Receitas reais do mês
    let totalIncome = 0
    for (const tx of validTxs) {
      if (toMonthKey(new Date(tx.date)) !== month) continue
      if (tx.type === 'income') {
        const acc = accountMap.get(tx.accountId)
        if (acc?.type !== 'off_budget') totalIncome += tx.amount
      } else if (tx.type === 'transfer') {
        const fromAcc = tx.accountId ? accountMap.get(tx.accountId) : undefined
        const toAcc = tx.transferAccountId ? accountMap.get(tx.transferAccountId) : undefined
        if (fromAcc?.type === 'off_budget' && toAcc?.type !== 'off_budget') totalIncome += tx.amount
      }
    }

    // Total orçado em despesas no mês
    let totalBudgeted = 0
    for (const b of budgetMonths) {
      if (b.month !== month || isMonthBeforeAccountingStart(b.month)) continue
      if (getRowBudgetType(b) !== regime || ignoredCategoryIds.has(b.categoryId)) continue
      totalBudgeted += Number(b.budgeted ?? 0)
    }

    // Atividade/gastos reais do mês no regime ativo
    const actMap = calculateActivityByCategory(transactions, month, accounts, regime, installmentGroups)
    let totalSpent = 0
    for (const [catId, spent] of actMap.entries()) {
      if (ignoredCategoryIds.has(catId)) continue
      totalSpent += spent
    }

    const { totalExpected, pending: pendingExpected } = computeIncomeStats(month)

    // Regime de Competência: foco em resultado econômico (Receitas vs Despesas do período)
    if (regime === 'accrual') {
      const plannedNetResult = totalExpected > 0 ? totalExpected - totalBudgeted : totalIncome - totalBudgeted
      const actualNetResult = totalIncome - totalSpent

      return {
        month,
        isFutureMonth: false,
        rolloverFromPreviousMonth: 0,
        totalIncome: round(totalIncome),
        totalExpectedIncome: round(totalExpected),
        pendingExpectedIncome: round(pendingExpected),
        totalBudgeted: round(totalBudgeted),
        totalSpent: round(totalSpent),
        currentInvoicesDue: 0,
        toBeBudgeted: round(plannedNetResult),
        projectedToBeBudgeted: round(plannedNetResult),
        plannedNetResult: round(plannedNetResult),
        actualNetResult: round(actualNetResult),
      }
    }

    const positiveAvailable = computePositiveAvailable(month)
    const ccInvoices = computeCCInvoices(month)

    const rawTBB = checkingBalance - positiveAvailable - ccInvoices

    return {
      month,
      isFutureMonth: false,
      rolloverFromPreviousMonth: 0,
      totalIncome: round(totalIncome),
      totalExpectedIncome: round(totalExpected),
      pendingExpectedIncome: round(pendingExpected),
      totalBudgeted: round(totalBudgeted),
      totalSpent: round(totalSpent),
      currentInvoicesDue: round(ccInvoices),
      toBeBudgeted: round(rawTBB),
      projectedToBeBudgeted: round(rawTBB + pendingExpected),
      plannedNetResult: round(totalExpected - totalBudgeted),
      actualNetResult: round(totalIncome - totalSpent),
    }
  }

  // ── Mês futuro: encadeamento a partir do mês atual ───────────────────────
  // Semente = TBB real e projetado do mês atual
  const curPositiveAvailable = computePositiveAvailable(curMonth)
  const curCCInvoices = computeCCInvoices(curMonth)
  const { pending: curPending } = computeIncomeStats(curMonth)

  const curRealTBB = checkingBalance - curPositiveAvailable - curCCInvoices
  let realSeed = curRealTBB
  let projSeed = curRealTBB + curPending

  // Iterar de curMonth+1 até o mês selecionado (inclusive)
  const [curY, curM] = curMonth.split('-').map(Number)
  let d = addMonths(new Date(curY, curM - 1, 1), 1)
  let selectedMonthCC = 0
  let selectedMonthTotalBudgeted = 0
  let selectedMonthTotalExpectedIncome = 0

  while (format(d, 'yyyy-MM') <= month) {
    const m = format(d, 'yyyy-MM')
    const { income: mBudgetedIncome, expense: mBudgetedExpense } = computeMonthBudgetTotals(m)
    const mCC = computeCCInvoices(m)

    // real: assume 0 de renda futura (pessimista)
    realSeed -= mBudgetedExpense + mCC
    // projetado: inclui renda orçada (otimista)
    projSeed += mBudgetedIncome - mBudgetedExpense - mCC

    if (m === month) {
      selectedMonthCC = mCC
      selectedMonthTotalBudgeted = mBudgetedExpense
      selectedMonthTotalExpectedIncome = mBudgetedIncome
    }
    d = addMonths(d, 1)
  }

  return {
    month,
    isFutureMonth: true,
    rolloverFromPreviousMonth: round(curRealTBB),
    totalIncome: 0,
    totalExpectedIncome: round(selectedMonthTotalExpectedIncome),
    pendingExpectedIncome: round(selectedMonthTotalExpectedIncome), // nada recebido ainda
    totalBudgeted: round(selectedMonthTotalBudgeted),
    totalSpent: 0,
    currentInvoicesDue: round(selectedMonthCC),
    toBeBudgeted: round(realSeed),
    projectedToBeBudgeted: round(projSeed),
    plannedNetResult: round(selectedMonthTotalExpectedIncome - selectedMonthTotalBudgeted),
    actualNetResult: 0,
  }
}

