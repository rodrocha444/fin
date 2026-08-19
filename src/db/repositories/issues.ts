// src/db/repositories/issues.ts
// ─────────────────────────────────────────────────────────────
// Motor modular de regras e detecção de pendências/inconsistências (padrão CUID)
// Suporta regras extensíveis para transações sem categoria, estouro de envelopes, etc.
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { getActivityByCategory } from './transactions'
import { toMonthKey } from './budget'
import type { PendingIssue } from '@/types'

type IssueRuleFn = () => Promise<PendingIssue | null>

/** Regra 1: Transações sem categoria definida (despesas ou receitas) */
async function checkUncategorizedTransactions(): Promise<PendingIssue | null> {
  const txs = await db.transactions
    .filter(t => t.type !== 'transfer' && !t.categoryId)
    .reverse()
    .sortBy('date')

  if (txs.length === 0) return null

  return {
    id: 'uncategorized_txs',
    ruleId: 'uncategorized_transactions',
    title: `${txs.length} ${txs.length === 1 ? 'transação sem categoria' : 'transações sem categoria'}`,
    description: 'Defina a categoria para manter seus relatórios e orçamento precisos.',
    severity: 'warning',
    count: txs.length,
    items: txs.map(t => ({
      id: t.id!,
      title: t.payee || (t.type === 'income' ? 'Renda' : 'Despesa'),
      subtitle: new Date(t.date).toLocaleDateString('pt-BR'),
      amount: t.amount,
      type: t.type,
      data: t,
    })),
  }
}

/** Regra 2: Categorias com gastos excedendo o valor orçado no mês atual */
async function checkOverspentCategories(): Promise<PendingIssue | null> {
  const currentMonth = toMonthKey(new Date())
  const [activityMap, budgetRecords, categories] = await Promise.all([
    getActivityByCategory(currentMonth),
    db.budgetMonths.where('month').equals(currentMonth).toArray(),
    db.categories.toArray(),
  ])

  const budgetByCategory = new Map(budgetRecords.map(b => [b.categoryId, b.budgeted]))
  const categoryMap = new Map(categories.map(c => [c.id!, c]))

  const overspent: Array<{ id: string; title: string; subtitle: string; amount: number }> = []

  for (const [catId, spent] of activityMap.entries()) {
    const budgeted = budgetByCategory.get(catId) ?? 0
    const cat = categoryMap.get(catId)
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

  if (overspent.length === 0) return null

  return {
    id: 'overspent_categories',
    ruleId: 'overspent_categories',
    title: `${overspent.length} ${overspent.length === 1 ? 'categoria estourada' : 'categorias estouradas'} neste mês`,
    description: 'Os gastos reais ultrapassaram o valor alocado no orçamento.',
    severity: 'error',
    count: overspent.length,
    items: overspent,
  }
}

/** Regra 3: Transações agendadas vencidas aguardando processamento */
async function checkOverdueScheduledTransactions(): Promise<PendingIssue | null> {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const overdue = await db.scheduledTransactions
    .filter(s => s.isActive && new Date(s.nextDate) <= today)
    .toArray()

  if (overdue.length === 0) return null

  return {
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
  }
}

/** Registro central de regras ativas (modular e extensível) */
const ISSUE_RULES: IssueRuleFn[] = [
  checkUncategorizedTransactions,
  checkOverspentCategories,
  checkOverdueScheduledTransactions,
]

/** Executa todas as regras registradas e retorna as pendências ativas */
export async function getPendingIssues(): Promise<PendingIssue[]> {
  const results = await Promise.all(ISSUE_RULES.map(rule => rule()))
  return results.filter((issue): issue is PendingIssue => issue !== null)
}
