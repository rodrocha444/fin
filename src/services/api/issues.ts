// src/services/api/issues.ts — Detecção de pendências e regras de consistência
import { toMonthKey, calculateActivityByCategory } from './budget'
import { isInitialSetupCategory } from '@/utils/format'
import type {
  Transaction,
  Category,
  CategoryGroup,
  BudgetMonth,
  ScheduledTransaction,
  PendingIssue,
} from '@/types'

export function computePendingIssues(
  transactions: Transaction[],
  categories: Category[],
  categoryGroups: CategoryGroup[],
  budgetMonths: BudgetMonth[],
  scheduledTransactions: ScheduledTransaction[]
): PendingIssue[] {
  const issues: PendingIssue[] = []

  // Regra 1: Transações sem categoria
  const uncategorized = transactions
    .filter(t => t.type !== 'transfer' && !t.categoryId)
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
        title: t.payee || (t.type === 'income' ? 'Renda' : 'Despesa'),
        subtitle: new Date(t.date).toLocaleDateString('pt-BR'),
        amount: t.amount,
        type: t.type,
        data: t,
      })),
    })
  }

  // Regra 2: Categorias estouradas no mês atual
  const currentMonth = toMonthKey(new Date())
  const activityMap = calculateActivityByCategory(transactions, currentMonth)
  const budgetByCategory = new Map(
    budgetMonths.filter(b => b.month === currentMonth).map(b => [b.categoryId, b.budgeted])
  )
  const categoryMap = new Map(categories.map(c => [c.id!, c]))
  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

  const overspent: Array<{ id: string; title: string; subtitle: string; amount: number }> = []

  for (const [catId, spent] of activityMap.entries()) {
    const budgeted = budgetByCategory.get(catId) ?? 0
    const cat = categoryMap.get(catId)
    const grp = cat ? groupMap.get(cat.groupId) : undefined
    if (cat && isInitialSetupCategory(cat.name, grp?.name)) continue
    if (spent > budgeted && cat && !cat.isHidden) {
      const excess = spent - budgeted
      overspent.push({
        id: catId,
        title: cat.name,
        subtitle: `Orçado: R$ ${budgeted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Gasto: R$ ${spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        amount: excess,
      })
    }
  }

  if (overspent.length > 0) {
    issues.push({
      id: 'overspent_categories',
      ruleId: 'overspent_categories',
      title: `${overspent.length} ${overspent.length === 1 ? 'categoria estourada' : 'categorias estouradas'} neste mês`,
      description: 'Os gastos reais ultrapassaram o valor alocado no orçamento.',
      severity: 'error',
      count: overspent.length,
      items: overspent,
    })
  }

  // Regra 3: Agendamentos vencidos
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const overdue = scheduledTransactions.filter(
    s => s.isActive && new Date(s.nextDate) <= today
  )

  if (overdue.length > 0) {
    issues.push({
      id: 'overdue_scheduled',
      ruleId: 'overdue_scheduled',
      title: `${overdue.length} ${overdue.length === 1 ? 'agendamento pendente' : 'agendamentos pendentes'}`,
      description: 'Transações recorrentes ou agendadas prontas para lançamento.',
      severity: 'info',
      count: overdue.length,
      items: overdue.map(s => ({
        id: s.id!,
        title: s.payee,
        subtitle: `Vencimento: ${new Date(s.nextDate).toLocaleDateString('pt-BR')}`,
        amount: s.amount,
        type: s.type,
        data: s,
      })),
    })
  }

  return issues
}
