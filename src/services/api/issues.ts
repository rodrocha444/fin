import { toMonthKey, calculateActivityByCategory } from './budget'
import { isInitialSetupCategory, formatCurrency } from '@/utils/format'
import type { AccountingRegime } from '@/utils/accountingRegime'
import type {
  Transaction,
  Category,
  CategoryGroup,
  BudgetMonth,
  PendingIssue,
  Account,
  InstallmentGroup,
} from '@/types'

export function computePendingIssues(
  transactions: Transaction[],
  categories: Category[],
  categoryGroups: CategoryGroup[],
  budgetMonths: BudgetMonth[],
  accounts?: Account[],
  targetMonth?: string,
  regime: AccountingRegime = 'cash',
  installmentGroups: InstallmentGroup[] = []
): PendingIssue[] {
  const issues: PendingIssue[] = []

  const accountMap = accounts ? new Map(accounts.map(a => [a.id!, a])) : undefined

  // Regra 1: Transações sem categoria (inclui receitas, despesas e transferências entre contas on-budget e off-budget)
  const uncategorized = transactions
    .filter(t => {
      if (t.categoryId) return false
      if (t.type === 'transfer') {
        if (!accountMap) return false
        const fromAcc = t.accountId ? accountMap.get(t.accountId) : undefined
        const toAcc = t.transferAccountId ? accountMap.get(t.transferAccountId) : undefined
        const isFromOnBudget = fromAcc && fromAcc.type !== 'off_budget'
        const isToOnBudget = toAcc && toAcc.type !== 'off_budget'
        // Transferência entre on-budget e off-budget afeta o orçamento e requer categoria
        const affectsBudget = (isFromOnBudget && !isToOnBudget) || (!isFromOnBudget && isToOnBudget)
        return affectsBudget
      }
      // Se for receita ou despesa em conta off-budget, NÃO requer categoria (apenas rastreamento patrimonial)
      if (accountMap && t.accountId) {
        const acc = accountMap.get(t.accountId)
        if (acc?.type === 'off_budget') {
          return false
        }
      }
      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (uncategorized.length > 0) {
    issues.push({
      id: 'uncategorized_txs',
      ruleId: 'uncategorized_transactions',
      title: `${uncategorized.length} ${uncategorized.length === 1 ? 'transação sem categoria' : 'transações sem categoria'}`,
      description: 'Defina a categoria para manter seus relatórios e orçamento precisos.',
      severity: 'warning',
      count: uncategorized.length,
      items: uncategorized.map(t => ({
        id: t.id!,
        title: t.payee || (t.type === 'transfer' ? 'Transferência' : t.type === 'income' ? 'Renda' : 'Despesa'),
        subtitle: new Date(t.date).toLocaleDateString('pt-BR'),
        amount: t.amount,
        type: t.type,
        data: t,
      })),
    })
  }

  // Regra 2: Categorias estouradas / sem cobertura no mês ativo
  const activeMonth = targetMonth || toMonthKey(new Date())
  const activityMap = calculateActivityByCategory(transactions, activeMonth, accounts, regime, installmentGroups)
  const budgetByCategory = new Map(
    budgetMonths
      .filter(b => b.month === activeMonth && (b.budgetType || 'cash') === regime)
      .map(b => [b.categoryId, b.budgeted])
  )
  const categoryMap = new Map(categories.map(c => [c.id!, c]))
  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

  const overspent: Array<{ id: string; title: string; subtitle: string; amount: number }> = []

  for (const [catId, spent] of activityMap.entries()) {
    const budgeted = budgetByCategory.get(catId) ?? 0
    const cat = categoryMap.get(catId)
    const grp = cat ? groupMap.get(cat.groupId) : undefined
    if (cat && isInitialSetupCategory(cat.name, grp?.name)) continue
    if (spent > budgeted + 0.005 && cat && !cat.isHidden) {
      const excess = Math.round((spent - budgeted) * 100) / 100
      overspent.push({
        id: catId,
        title: cat.name,
        subtitle: `Orçado: ${formatCurrency(budgeted)} | Gasto: ${formatCurrency(spent)} (Falta cobrir ${formatCurrency(excess)})`,
        amount: excess,
      })
    }
  }

  if (overspent.length > 0) {
    issues.push({
      id: 'overspent_categories',
      ruleId: 'overspent_categories',
      title: `${overspent.length} ${overspent.length === 1 ? 'categoria estourada' : 'categorias estouradas'} neste mês`,
      description: `Os gastos da fatura/mês ultrapassaram o valor orçado (${regime === 'accrual' ? 'Competência' : 'Faturas/Caixa'}).`,
      severity: 'error',
      count: overspent.length,
      items: overspent,
    })
  }

  return issues
}
