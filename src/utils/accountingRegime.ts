// src/utils/accountingRegime.ts — Utilitários de cálculo para Regimes de Competência e Caixa
import type { Transaction, InstallmentGroup, CategoryGroup, Category } from '@/types'
import { toMonthKey } from '@/services/api/budget'
import { isInitialSetupCategory } from '@/utils/format'
import type { CategoryPieItem } from '@/components/molecules/CategoryPieCard'

export type AccountingRegime = 'accrual' | 'cash'

export const ACCOUNTING_REGIME_STORAGE_KEY = 'fin_accounting_regime'

export function getSavedAccountingRegime(): AccountingRegime {
  try {
    const saved = localStorage.getItem(ACCOUNTING_REGIME_STORAGE_KEY)
    if (saved === 'cash' || saved === 'accrual') {
      return saved
    }
  } catch {
    // fallback
  }
  return 'accrual' // Padrão: Competência (Data da Compra)
}

export function saveAccountingRegime(regime: AccountingRegime): void {
  try {
    localStorage.setItem(ACCOUNTING_REGIME_STORAGE_KEY, regime)
  } catch {
    // fallback
  }
}

/**
 * Cria um mapa seguro de ID do grupo para data de início ('YYYY-MM'),
 * garantindo fallback calculando a menor data caso o registro do grupo não exista.
 */
export function buildGroupPurchaseMonthMap(
  transactions: Transaction[],
  installmentGroups: InstallmentGroup[] = []
): Map<string, string> {
  const groupMonthMap = new Map<string, string>()

  for (const group of installmentGroups) {
    if (group.id && group.startDate) {
      groupMonthMap.set(group.id, toMonthKey(new Date(group.startDate)))
    }
  }

  // Fallback para grupos com transações mas sem entrada explícita em installmentGroups
  const minDateMap = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.installmentGroupId && !groupMonthMap.has(tx.installmentGroupId)) {
      const txTime = new Date(tx.date).getTime()
      const currMin = minDateMap.get(tx.installmentGroupId)
      if (currMin === undefined || txTime < currMin) {
        minDateMap.set(tx.installmentGroupId, txTime)
      }
    }
  }

  for (const [groupId, minTime] of minDateMap.entries()) {
    groupMonthMap.set(groupId, toMonthKey(new Date(minTime)))
  }

  return groupMonthMap
}

/**
 * Calcula mapa de Despesas por Categoria para um determinado mês e regime contábil.
 */
export function calculateReportExpensesByCategory(
  transactions: Transaction[],
  installmentGroups: InstallmentGroup[],
  month: string,
  regime: AccountingRegime
): Map<string, number> {
  const map = new Map<string, number>()
  const groupMonthMap = buildGroupPurchaseMonthMap(transactions, installmentGroups)

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue

    if (regime === 'accrual') {
      if (tx.installmentGroupId) {
        const purchaseMonth = groupMonthMap.get(tx.installmentGroupId)
        if (purchaseMonth !== month) continue
      } else {
        const txMonth = toMonthKey(new Date(tx.date))
        if (txMonth !== month) continue
      }
    } else {
      // Regime de Caixa: data efetiva da parcela / transação
      const txMonth = toMonthKey(new Date(tx.date))
      if (txMonth !== month) continue
    }

    const catKey = tx.categoryId || 'uncategorized_expense'
    map.set(catKey, (map.get(catKey) || 0) + tx.amount)
  }

  return map
}

/**
 * Calcula mapa de Receitas por Categoria para um determinado mês e regime contábil.
 */
export function calculateReportIncomeByCategory(
  transactions: Transaction[],
  installmentGroups: InstallmentGroup[],
  month: string,
  regime: AccountingRegime
): Map<string, number> {
  const map = new Map<string, number>()
  const groupMonthMap = buildGroupPurchaseMonthMap(transactions, installmentGroups)

  for (const tx of transactions) {
    if (tx.type !== 'income') continue

    if (regime === 'accrual') {
      if (tx.installmentGroupId) {
        const purchaseMonth = groupMonthMap.get(tx.installmentGroupId)
        if (purchaseMonth !== month) continue
      } else {
        const txMonth = toMonthKey(new Date(tx.date))
        if (txMonth !== month) continue
      }
    } else {
      const txMonth = toMonthKey(new Date(tx.date))
      if (txMonth !== month) continue
    }

    const catKey = tx.categoryId || (tx.payee ? `payee_${tx.payee}` : 'uncategorized_income')
    map.set(catKey, (map.get(catKey) || 0) + tx.amount)
  }

  return map
}

/**
 * Resumo financeiro consolidado do mês conforme o regime contábil
 */
export function calculateReportSummary(
  transactions: Transaction[],
  installmentGroups: InstallmentGroup[],
  month: string,
  regime: AccountingRegime
): {
  income: number
  expense: number
  netSavings: number
  savingsRate: number
} {
  const expenseMap = calculateReportExpensesByCategory(transactions, installmentGroups, month, regime)
  const incomeMap = calculateReportIncomeByCategory(transactions, installmentGroups, month, regime)

  let expense = 0
  for (const amt of expenseMap.values()) {
    expense += amt
  }

  let income = 0
  for (const amt of incomeMap.values()) {
    income += amt
  }

  const netSavings = income - expense
  const savingsRate = income > 0 ? (netSavings / income) * 100 : 0

  return {
    income,
    expense,
    netSavings,
    savingsRate,
  }
}

/**
 * Converte as despesas agregadas para o formato de itens do gráfico de pizza
 */
export function buildExpensePieItems(
  expenseMap: Map<string, number>,
  categoryGroups: CategoryGroup[],
  categories: Category[]
): CategoryPieItem[] {
  const list: CategoryPieItem[] = []
  const catMap = new Map(categories.map(c => [c.id!, c]))
  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

  const expenseGroups = categoryGroups.filter(
    g => g.type !== 'income' && g.name !== 'Faturas Atuais' && g.name !== 'Faturas de Cartão'
  )

  // 1. Itera por grupos e categorias estruturadas
  for (const group of expenseGroups) {
    if (group.isHidden || isInitialSetupCategory(undefined, group.name)) continue
    const groupCategories = categories.filter(
      c => c.groupId === group.id && !c.isHidden && !isInitialSetupCategory(c.name, group.name)
    )

    for (const cat of groupCategories) {
      if (!cat.id) continue
      const amount = expenseMap.get(cat.id) ?? 0
      if (amount > 0) {
        list.push({
          id: cat.id,
          name: cat.name,
          groupName: group.name,
          amount,
        })
      }
    }
  }

  // 2. Adiciona despesas de categorias órfãs ou sem categoria
  const uncategorizedAmount = expenseMap.get('uncategorized_expense') ?? 0
  if (uncategorizedAmount > 0) {
    list.push({
      id: 'uncategorized_expense',
      name: 'Sem Categoria',
      groupName: 'Diversos',
      amount: uncategorizedAmount,
    })
  }

  // 3. Adiciona eventuais categorias que não estão na hierarquia de grupos
  for (const [catId, amount] of expenseMap.entries()) {
    if (catId === 'uncategorized_expense') continue
    if (!list.some(item => item.id === catId) && amount > 0) {
      const cat = catMap.get(catId)
      const grp = cat ? groupMap.get(cat.groupId) : undefined
      list.push({
        id: catId,
        name: cat?.name || 'Categoria Diversa',
        groupName: grp?.name || 'Geral',
        amount,
      })
    }
  }

  return list
}

/**
 * Converte as receitas agregadas para o formato de itens do gráfico de pizza
 */
export function buildIncomePieItems(
  incomeMap: Map<string, number>,
  categoryGroups: CategoryGroup[],
  categories: Category[]
): CategoryPieItem[] {
  const list: CategoryPieItem[] = []
  const catMap = new Map(categories.map(c => [c.id!, c]))
  const groupMap = new Map(categoryGroups.map(g => [g.id!, g]))

  const incomeGroups = categoryGroups.filter(g => g.type === 'income')

  for (const group of incomeGroups) {
    if (group.isHidden) continue
    const groupCategories = categories.filter(c => c.groupId === group.id && !c.isHidden)

    for (const cat of groupCategories) {
      if (!cat.id) continue
      const amount = incomeMap.get(cat.id) ?? 0
      if (amount > 0) {
        list.push({
          id: cat.id,
          name: cat.name,
          groupName: group.name,
          amount,
        })
      }
    }
  }

  for (const [catKey, amount] of incomeMap.entries()) {
    if (!list.some(item => item.id === catKey) && amount > 0) {
      const cat = catMap.get(catKey)
      const grp = cat ? groupMap.get(cat.groupId) : undefined
      const cleanName = cat?.name || catKey.replace(/^payee_/, '') || 'Renda Diversa'

      list.push({
        id: catKey,
        name: cleanName,
        groupName: grp?.name || 'Renda',
        amount,
      })
    }
  }

  return list
}
