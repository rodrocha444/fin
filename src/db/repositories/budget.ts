// src/db/repositories/budget.ts
// ─────────────────────────────────────────────────────────────
// Lógica de orçamento mensal por categoria (zero-sum budgeting) (padrão CUID)
// Sem rollover: o saldo de categorias não acumula mês a mês.
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type {
  BudgetMonth,
  GroupBudgetRow,
  CategoryBudgetRow,
  IncomeGroupBudgetRow,
  IncomeCategoryBudgetRow,
  BudgetSummary,
} from '@/types'
import { getActivityByCategory, getIncomeByCategory } from './transactions'
import { getProjectedScheduledUpToMonth } from './scheduled'
import { format, subMonths } from 'date-fns'
import { isInitialSetupCategory } from '@/utils/format'

// ── Helpers ──────────────────────────────────────────────────

/** Formata Date para 'YYYY-MM' */
export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

// ── Operações de orçamento ───────────────────────────────────

/** Define quanto o usuário quer orçar em uma categoria naquele mês */
export async function setBudget(month: string, categoryId: string, budgeted: number): Promise<void> {
  const existing = await db.budgetMonths
    .where('[month+categoryId]')
    .equals([month, categoryId])
    .first()

  if (existing?.id !== undefined) {
    await db.budgetMonths.update(existing.id, { budgeted })
  } else {
    await db.budgetMonths.add({ id: createId(), month, categoryId, budgeted, activity: 0, available: 0 })
  }
}

/** Copia os valores orçados do mês anterior para o mês atual */
export async function copyFromPreviousMonth(targetMonth: string): Promise<void> {
  const [year, mon] = targetMonth.split('-').map(Number)
  const prevDate = subMonths(new Date(year, mon - 1), 1)
  const prevMonth = format(prevDate, 'yyyy-MM')

  const prevBudgets = await db.budgetMonths.where('month').equals(prevMonth).toArray()

  await db.transaction('rw', db.budgetMonths, async () => {
    for (const prev of prevBudgets) {
      const existing = await db.budgetMonths
        .where('[month+categoryId]')
        .equals([targetMonth, prev.categoryId])
        .first()

      if (existing?.id !== undefined) {
        await db.budgetMonths.update(existing.id, { budgeted: prev.budgeted })
      } else {
        await db.budgetMonths.add({
          id: createId(),
          month: targetMonth,
          categoryId: prev.categoryId,
          budgeted: prev.budgeted,
          activity: 0,
          available: 0,
        })
      }
    }
  })
}

/** Zera todos os valores orçados de um mês */
export async function clearMonthBudgets(month: string): Promise<void> {
  const records = await db.budgetMonths.where('month').equals(month).toArray()
  await Promise.all(
    records
      .filter(r => r.id !== undefined)
      .map(r => db.budgetMonths.update(r.id!, { budgeted: 0 }))
  )
}

// ── Cálculo do orçamento de Despesas ─────────────────────────

export async function computeBudgetRows(month: string): Promise<GroupBudgetRow[]> {
  const [activityMap, groups, categories, budgetRecords] = await Promise.all([
    getActivityByCategory(month),
    db.categoryGroups.orderBy('sortOrder').toArray(),
    db.categories.orderBy('sortOrder').toArray(),
    db.budgetMonths.where('month').equals(month).toArray(),
  ])

  // Filtrar apenas grupos de despesas
  const expenseGroups = groups.filter(g => g.type !== 'income')

  // Indexar budget records por categoryId
  const budgetByCategory = new Map(budgetRecords.map(b => [b.categoryId, b]))

  const rows: GroupBudgetRow[] = []

  for (const group of expenseGroups) {
    if (group.isHidden) continue
    const groupCategories = categories.filter(c => c.groupId === group.id && !c.isHidden)
    if (groupCategories.length === 0) continue

    const catRows: CategoryBudgetRow[] = []

    for (const cat of groupCategories) {
      if (!cat.id) continue
      const budgetRec = budgetByCategory.get(cat.id)
      const budgeted = budgetRec?.budgeted ?? 0
      const activity = activityMap.get(cat.id) ?? 0
      const available = budgeted - activity // sem rollover

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

// ── Cálculo do orçamento de Renda / Receitas ─────────────────

export async function computeIncomeBudgetRows(month: string): Promise<IncomeGroupBudgetRow[]> {
  const [incomeMap, groups, categories] = await Promise.all([
    getIncomeByCategory(month),
    db.categoryGroups.orderBy('sortOrder').toArray(),
    db.categories.orderBy('sortOrder').toArray(),
  ])

  // Filtrar apenas grupos de renda
  const incomeGroups = groups.filter(g => g.type === 'income')
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

// ── Resumo de "A Orçar" (Zero-Sum Budgeting) ──────────────────

export async function getBudgetSummary(month: string): Promise<BudgetSummary> {
  const [allIncomeTxs, allExpenseTxs, allBudgets, allAccounts, allGroups, allCategories, allScheduled] = await Promise.all([
    db.transactions.filter(t => t.type === 'income').toArray(),
    db.transactions.filter(t => t.type === 'expense').toArray(),
    db.budgetMonths.toArray(),
    db.accounts.toArray(),
    db.categoryGroups.toArray(),
    db.categories.toArray(),
    db.scheduledTransactions.filter(s => s.isActive !== false).toArray(),
  ])

  const groupMap = new Map(allGroups.map(g => [g.id!, g]))

  // Identificar categorias que NÃO deduzem do "A orçar":
  // 1. Categorias de Renda (type === 'income')
  // 2. Categorias de Saldo Inicial / Faturas Anteriores (ex: "Faturas Anteriores", "Saldos Iniciais")
  const ignoredCategoryIds = new Set<string>()
  for (const cat of allCategories) {
    if (!cat.id) continue
    const grp = groupMap.get(cat.groupId)
    if (
      grp?.type === 'income' ||
      isInitialSetupCategory(cat.name, grp?.name)
    ) {
      ignoredCategoryIds.add(cat.id)
    }
  }

  // Saldo inicial de contas de dinheiro/corrente/poupança (fundos iniciais disponíveis para orçar)
  const initialFunds = allAccounts
    .filter(a => a.type !== 'credit_card')
    .reduce((sum, a) => sum + (a.initialBalance || 0), 0)

  // 1. Renda passada e renda do mês selecionado
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

  // 2. Mapear todas as despesas por [mês + categoryId] e despesas sem categoria
  const expensesByMonthCategory = new Map<string, number>()
  const uncategorizedExpensesByMonth = new Map<string, number>()

  for (const tx of allExpenseTxs) {
    const txMonth = toMonthKey(new Date(tx.date))
    if (tx.categoryId && ignoredCategoryIds.has(tx.categoryId)) {
      // Faturas Anteriores e Saldos Iniciais são desconsiderados na dedução do "A Orçar"
      continue
    }
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

  // 3. Mapear orçamentos de despesas por [mês + categoryId]
  const budgetsByMonthCategory = new Map<string, number>()
  let totalBudgeted = 0
  let priorBudgeted = 0

  for (const b of allBudgets) {
    // Ignorar orçamento de renda e faturas anteriores na dedução do "A orçar"
    if (ignoredCategoryIds.has(b.categoryId)) continue

    const amount = b.budgeted || 0
    const key = `${b.month}:${b.categoryId}`
    budgetsByMonthCategory.set(key, amount)

    if (b.month === month) {
      totalBudgeted += amount
    } else if (b.month < month) {
      priorBudgeted += amount
    }
  }

  // 4. Coletar todos os meses anteriores que tiveram transações ou orçamento
  const pastMonths = new Set<string>()
  for (const tx of allIncomeTxs) {
    const m = toMonthKey(new Date(tx.date))
    if (m < month) pastMonths.add(m)
  }
  for (const tx of allExpenseTxs) {
    if (tx.categoryId && ignoredCategoryIds.has(tx.categoryId)) continue
    const m = toMonthKey(new Date(tx.date))
    if (m < month) pastMonths.add(m)
  }
  for (const b of allBudgets) {
    if (b.month < month && !ignoredCategoryIds.has(b.categoryId)) pastMonths.add(b.month)
  }

  // 5. Coletar categorias de despesas presentes
  const expenseCategoryIds = new Set<string>()
  for (const tx of allExpenseTxs) {
    if (tx.categoryId && !ignoredCategoryIds.has(tx.categoryId)) expenseCategoryIds.add(tx.categoryId)
  }
  for (const b of allBudgets) {
    if (b.categoryId && !ignoredCategoryIds.has(b.categoryId)) expenseCategoryIds.add(b.categoryId)
  }

  // 6. Integrar projeções de transações agendadas (recorrentes / futuras) até o mês selecionado
  const scheduledOccurrences = getProjectedScheduledUpToMonth(allScheduled, month)
  for (const p of scheduledOccurrences) {
    const pMonth = toMonthKey(p.date)
    if (pMonth < month) {
      if (p.type === 'income') {
        priorIncome += p.amount
      } else if (p.type === 'expense') {
        if (p.categoryId && !ignoredCategoryIds.has(p.categoryId)) {
          const key = `${pMonth}:${p.categoryId}`
          expensesByMonthCategory.set(key, (expensesByMonthCategory.get(key) || 0) + p.amount)
          expenseCategoryIds.add(p.categoryId)
          pastMonths.add(pMonth)
        } else if (!p.categoryId) {
          uncategorizedExpensesByMonth.set(
            pMonth,
            (uncategorizedExpensesByMonth.get(pMonth) || 0) + p.amount
          )
          pastMonths.add(pMonth)
        }
      }
    } else if (pMonth === month) {
      if (p.type === 'income') {
        totalIncome += p.amount
      } else if (p.type === 'expense') {
        if (p.categoryId && !ignoredCategoryIds.has(p.categoryId)) {
          const key = `${month}:${p.categoryId}`
          expensesByMonthCategory.set(key, (expensesByMonthCategory.get(key) || 0) + p.amount)
          expenseCategoryIds.add(p.categoryId)
        } else if (!p.categoryId) {
          uncategorizedExpensesByMonth.set(
            month,
            (uncategorizedExpensesByMonth.get(month) || 0) + p.amount
          )
        }
      }
    }
  }

  // 6. Calcular compromissos efetivos dos meses anteriores: Math.max(orçado, despesas/parcelas)
  let priorCommitments = 0
  for (const m of pastMonths) {
    for (const catId of expenseCategoryIds) {
      const key = `${m}:${catId}`
      const budgeted = budgetsByMonthCategory.get(key) || 0
      const spent = expensesByMonthCategory.get(key) || 0
      priorCommitments += Math.max(budgeted, spent)
    }
    priorCommitments += uncategorizedExpensesByMonth.get(m) || 0
  }

  // 7. Calcular compromissos efetivos do mês selecionado
  let currentMonthCommitments = 0
  for (const catId of expenseCategoryIds) {
    const key = `${month}:${catId}`
    const budgeted = budgetsByMonthCategory.get(key) || 0
    const spent = expensesByMonthCategory.get(key) || 0
    currentMonthCommitments += Math.max(budgeted, spent)
  }
  currentMonthCommitments += uncategorizedExpensesByMonth.get(month) || 0

  // Sobra/Falta acumulada dos meses anteriores
  const previousMonthSurplus = initialFunds + priorIncome - priorCommitments

  // Disponível para orçar no mês selecionado
  const toBeBudgeted = previousMonthSurplus + totalIncome - currentMonthCommitments

  return {
    month,
    initialFunds,
    totalIncome,
    totalBudgeted,
    previousMonthSurplus,
    totalAllTimeBudgeted: priorBudgeted + totalBudgeted,
    toBeBudgeted,
  }
}
