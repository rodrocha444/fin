import { useLiveQuery } from 'dexie-react-hooks'
import { computeBudgetRows, computeIncomeBudgetRows, getBudgetSummary } from '@/db/repositories/budget'
import { db } from '@/db/schema'

/** Linhas do orçamento de despesas agrupadas por grupo/categoria para um mês */
export function useBudgetRows(month: string) {
  return useLiveQuery(() => computeBudgetRows(month), [month])
}

/** Linhas do orçamento de receitas/rendas para um mês */
export function useIncomeBudgetRows(month: string) {
  return useLiveQuery(() => computeIncomeBudgetRows(month), [month])
}

/** Resumo "To Be Budgeted" de um mês */
export function useBudgetSummary(month: string) {
  return useLiveQuery(() => getBudgetSummary(month), [month])
}

/** Grupos e categorias (para seleção em formulários), com filtro opcional por tipo */
export function useCategoriesWithGroups(type?: 'expense' | 'income') {
  return useLiveQuery(async () => {
    const [allGroups, categories] = await Promise.all([
      db.categoryGroups.orderBy('sortOrder').toArray(),
      db.categories.orderBy('sortOrder').toArray(),
    ])

    const groups = type
      ? allGroups.filter(g => (type === 'income' ? g.type === 'income' : g.type !== 'income'))
      : allGroups

    return { groups, categories }
  }, [type])
}
