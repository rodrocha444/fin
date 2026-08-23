// src/utils/accountingRegime.ts — Utilitários de cálculo para Regimes de Competência e Caixa
import type { Transaction, InstallmentGroup, CategoryGroup, Category } from '@/types'
import { toMonthKey } from '@/services/api/budget'
import { isInitialSetupCategory } from '@/utils/format'
import type { CategoryPieItem } from '@/components/molecules/CategoryPieCard'

export type AccountingRegime = 'accrual' | 'cash'

export const ACCOUNTING_REGIME_STORAGE_KEY = 'fin_accounting_regime'
export const REPORT_HIDDEN_CATEGORIES_STORAGE_KEY = 'fin_report_hidden_categories'

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

export function getSavedReportHiddenCategories(): string[] {
  try {
    const raw = localStorage.getItem(REPORT_HIDDEN_CATEGORIES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // fallback
  }
  return []
}

export function saveReportHiddenCategories(hiddenIds: string[]): void {
  try {
    localStorage.setItem(REPORT_HIDDEN_CATEGORIES_STORAGE_KEY, JSON.stringify(hiddenIds))
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
  regime: AccountingRegime,
  hiddenCategoryIds?: Set<string> | string[]
): Map<string, number> {
  const map = new Map<string, number>()
  const groupMonthMap = buildGroupPurchaseMonthMap(transactions, installmentGroups)
  const hiddenSet = hiddenCategoryIds ? new Set(hiddenCategoryIds) : null

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    if (tx.categoryId && hiddenSet?.has(tx.categoryId)) continue
    if (!tx.categoryId && hiddenSet?.has('uncategorized_expense')) continue

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
  regime: AccountingRegime,
  hiddenCategoryIds?: Set<string> | string[]
): Map<string, number> {
  const map = new Map<string, number>()
  const groupMonthMap = buildGroupPurchaseMonthMap(transactions, installmentGroups)
  const hiddenSet = hiddenCategoryIds ? new Set(hiddenCategoryIds) : null

  for (const tx of transactions) {
    if (tx.type !== 'income') continue
    if (tx.categoryId && hiddenSet?.has(tx.categoryId)) continue
    if (
      !tx.categoryId &&
      (hiddenSet?.has('uncategorized_income') || (tx.payee && hiddenSet?.has(`payee_${tx.payee}`)))
    ) {
      continue
    }

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
  regime: AccountingRegime,
  hiddenCategoryIds?: Set<string> | string[]
): {
  income: number
  expense: number
  netSavings: number
  savingsRate: number
} {
  const expenseMap = calculateReportExpensesByCategory(
    transactions,
    installmentGroups,
    month,
    regime,
    hiddenCategoryIds
  )
  const incomeMap = calculateReportIncomeByCategory(
    transactions,
    installmentGroups,
    month,
    regime,
    hiddenCategoryIds
  )

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

/**
 * Retorna as transações de um determinado mês e regime contábil, ordenadas por data desc.
 */
export function getReportTransactionsForMonth(
  transactions: Transaction[],
  installmentGroups: InstallmentGroup[],
  month: string,
  regime: AccountingRegime,
  options?: {
    type?: 'expense' | 'income'
    categoryId?: string
    hiddenCategoryIds?: Set<string> | string[]
    selectedCategoryIds?: Set<string> | string[]
  }
): Transaction[] {
  const groupMonthMap = buildGroupPurchaseMonthMap(transactions, installmentGroups)
  const hiddenSet = options?.hiddenCategoryIds ? new Set(options.hiddenCategoryIds) : null
  const selectedSet = options?.selectedCategoryIds ? new Set(options.selectedCategoryIds) : null

  return transactions
    .filter(tx => {
      // Filtragem por tipo
      if (options?.type && tx.type !== options.type) return false
      if (!options?.type && tx.type !== 'expense' && tx.type !== 'income') return false

      // Filtragem por categorias selecionadas especificamente no gráfico
      if (selectedSet && selectedSet.size > 0) {
        let matchesSelected = false
        if (tx.categoryId && selectedSet.has(tx.categoryId)) matchesSelected = true
        if (!tx.categoryId && tx.type === 'expense' && selectedSet.has('uncategorized_expense')) {
          matchesSelected = true
        }
        if (
          !tx.categoryId &&
          tx.type === 'income' &&
          (selectedSet.has('uncategorized_income') || (tx.payee && selectedSet.has(`payee_${tx.payee}`)))
        ) {
          matchesSelected = true
        }
        if (!matchesSelected) return false
      }

      // Filtragem de categorias ocultas nos relatórios (se não for busca de categoria explícita)
      if (!options?.categoryId && !selectedSet && hiddenSet) {
        if (tx.categoryId && hiddenSet.has(tx.categoryId)) return false
        if (!tx.categoryId && tx.type === 'expense' && hiddenSet.has('uncategorized_expense')) {
          return false
        }
        if (
          !tx.categoryId &&
          tx.type === 'income' &&
          (hiddenSet.has('uncategorized_income') || (tx.payee && hiddenSet.has(`payee_${tx.payee}`)))
        ) {
          return false
        }
      }

      // Filtragem de competência vs caixa
      if (regime === 'accrual') {
        if (tx.installmentGroupId) {
          const purchaseMonth = groupMonthMap.get(tx.installmentGroupId)
          if (purchaseMonth !== month) return false
        } else {
          const txMonth = toMonthKey(new Date(tx.date))
          if (txMonth !== month) return false
        }
      } else {
        const txMonth = toMonthKey(new Date(tx.date))
        if (txMonth !== month) return false
      }

      // Filtragem por categoria opcional
      if (options?.categoryId) {
        const catId = options.categoryId
        if (catId === 'uncategorized_expense') {
          if (tx.categoryId || tx.type !== 'expense') return false
        } else if (catId === 'uncategorized_income') {
          if (tx.categoryId || tx.type !== 'income') return false
        } else if (catId.startsWith('payee_')) {
          const payeeName = catId.replace(/^payee_/, '')
          if (tx.payee !== payeeName) return false
        } else {
          if (tx.categoryId !== catId) return false
        }
      }

      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export interface MonthlyEvolutionItem {
  month: string // 'YYYY-MM'
  label: string // 'Jan', 'Fev' etc.
  fullLabel: string // 'Janeiro de 2026'
  expense: number
  income: number
  netSavings: number
  savingsRate: number
  expenseCount: number
  incomeCount: number
  expenseChangePercent?: number // vs mês anterior na série (negativo = gastou menos)
  incomeChangePercent?: number // vs mês anterior na série (positivo = ganhou mais)
}

/**
 * Calcula a evolução mensal de receitas e despesas ao longo de uma lista ordenada de meses.
 */
export function calculateMonthlyEvolution(
  transactions: Transaction[],
  installmentGroups: InstallmentGroup[],
  months: string[],
  regime: AccountingRegime,
  hiddenCategoryIds?: Set<string> | string[],
  selectedCategoryIds?: Set<string> | string[]
): MonthlyEvolutionItem[] {
  const result: MonthlyEvolutionItem[] = []
  const selectedSet = selectedCategoryIds ? new Set(selectedCategoryIds) : null

  for (let i = 0; i < months.length; i++) {
    const m = months[i]
    let summary: { income: number; expense: number; netSavings: number; savingsRate: number }
    let monthTxs: Transaction[]

    if (selectedSet && selectedSet.size > 0) {
      monthTxs = getReportTransactionsForMonth(transactions, installmentGroups, m, regime, {
        hiddenCategoryIds,
        selectedCategoryIds: selectedSet,
      })
      let expense = 0
      let income = 0
      for (const t of monthTxs) {
        if (t.type === 'expense') expense += t.amount
        if (t.type === 'income') income += t.amount
      }
      const netSavings = income - expense
      const savingsRate = income > 0 ? (netSavings / income) * 100 : 0
      summary = { income, expense, netSavings, savingsRate }
    } else {
      summary = calculateReportSummary(transactions, installmentGroups, m, regime, hiddenCategoryIds)
      monthTxs = getReportTransactionsForMonth(transactions, installmentGroups, m, regime, {
        hiddenCategoryIds,
      })
    }

    const expenseCount = monthTxs.filter(t => t.type === 'expense').length
    const incomeCount = monthTxs.filter(t => t.type === 'income').length

    const [yearStr, monthStr] = m.split('-')
    const date = new Date(Number(yearStr), Number(monthStr) - 1, 1)
    const rawLabel = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
    const rawFullLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const fullLabel = rawFullLabel.charAt(0).toUpperCase() + rawFullLabel.slice(1)

    let expenseChangePercent: number | undefined = undefined
    let incomeChangePercent: number | undefined = undefined

    if (i > 0) {
      const prev = result[i - 1]
      if (prev.expense > 0) {
        expenseChangePercent = ((summary.expense - prev.expense) / prev.expense) * 100
      } else if (summary.expense > 0) {
        expenseChangePercent = 100
      } else {
        expenseChangePercent = 0
      }

      if (prev.income > 0) {
        incomeChangePercent = ((summary.income - prev.income) / prev.income) * 100
      } else if (summary.income > 0) {
        incomeChangePercent = 100
      } else {
        incomeChangePercent = 0
      }
    }

    result.push({
      month: m,
      label,
      fullLabel,
      expense: summary.expense,
      income: summary.income,
      netSavings: summary.netSavings,
      savingsRate: summary.savingsRate,
      expenseCount,
      incomeCount,
      expenseChangePercent,
      incomeChangePercent,
    })
  }

  return result
}
