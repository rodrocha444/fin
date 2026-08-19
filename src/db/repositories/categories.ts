// src/db/repositories/categories.ts
// ─────────────────────────────────────────────────────────────
// CRUD de grupos e categorias (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { CategoryGroup, Category } from '@/types'

// ── Grupos ───────────────────────────────────────────────────

export async function createGroup(data: Omit<CategoryGroup, 'id'>): Promise<string> {
  const normalizedName = data.name.trim().toLowerCase()
  const existing = await db.categoryGroups
    .filter(g => g.name.trim().toLowerCase() === normalizedName)
    .first()

  if (existing) {
    throw new Error(`Já existe um grupo cadastrado com o nome "${data.name.trim()}".`)
  }

  const id = createId()
  await db.categoryGroups.add({ ...data, id, name: data.name.trim() })
  return id
}

export async function updateGroup(id: string, data: Partial<Omit<CategoryGroup, 'id'>>): Promise<void> {
  if (data.name) {
    const normalizedName = data.name.trim().toLowerCase()
    const existing = await db.categoryGroups
      .filter(g => g.id !== id && g.name.trim().toLowerCase() === normalizedName)
      .first()

    if (existing) {
      throw new Error(`Já existe um grupo cadastrado com o nome "${data.name.trim()}".`)
    }
  }

  const payload = {
    ...data,
    ...(data.name ? { name: data.name.trim() } : {}),
  }

  await db.categoryGroups.update(id, payload)
}

export async function deleteGroup(id: string): Promise<void> {
  const catCount = await db.categories.where('groupId').equals(id).count()
  if (catCount > 0) throw new Error('Não é possível excluir um grupo que possui categorias.')
  await db.categoryGroups.delete(id)
}

export async function toggleGroupVisibility(id: string): Promise<void> {
  const group = await db.categoryGroups.get(id)
  if (group) await db.categoryGroups.update(id, { isHidden: !group.isHidden })
}

export async function getAllGroups(): Promise<CategoryGroup[]> {
  return db.categoryGroups.orderBy('sortOrder').toArray()
}

export async function getGroupsByType(type: 'expense' | 'income' = 'expense'): Promise<CategoryGroup[]> {
  const groups = await db.categoryGroups.orderBy('sortOrder').toArray()
  return groups.filter(g => (type === 'income' ? g.type === 'income' : g.type !== 'income'))
}

/** Limpa grupos e categorias default de renda */
export async function clearDefaultIncomeCategories(): Promise<void> {
  const defaultIncomeGroup = await db.categoryGroups
    .filter(g => g.type === 'income' && g.name === 'Fontes de Renda')
    .first()

  if (defaultIncomeGroup?.id) {
    const defaultCats = await db.categories.where('groupId').equals(defaultIncomeGroup.id).toArray()
    const defaultNames = ['Salário', 'Freelance / Serviços', 'Rendimentos & Investimentos', 'Outras Receitas']

    for (const cat of defaultCats) {
      if (cat.id && defaultNames.includes(cat.name)) {
        const txCount = await db.transactions.where('categoryId').equals(cat.id).count()
        if (txCount === 0) {
          await db.categories.delete(cat.id)
        }
      }
    }

    const remainingCats = await db.categories.where('groupId').equals(defaultIncomeGroup.id).count()
    if (remainingCats === 0) {
      await db.categoryGroups.delete(defaultIncomeGroup.id)
    }
  }
}

// ── Categorias ───────────────────────────────────────────────

export async function createCategory(data: Omit<Category, 'id'>): Promise<string> {
  const normalizedName = data.name.trim().toLowerCase()
  const existing = await db.categories
    .filter(c => c.name.trim().toLowerCase() === normalizedName)
    .first()

  if (existing) {
    throw new Error(`Já existe uma categoria cadastrada com o nome "${data.name.trim()}".`)
  }

  const id = createId()
  await db.categories.add({ ...data, id, name: data.name.trim() })
  return id
}

export async function updateCategory(id: string, data: Partial<Omit<Category, 'id'>>): Promise<void> {
  if (data.name) {
    const normalizedName = data.name.trim().toLowerCase()
    const existing = await db.categories
      .filter(c => c.id !== id && c.name.trim().toLowerCase() === normalizedName)
      .first()

    if (existing) {
      throw new Error(`Já existe uma categoria cadastrada com o nome "${data.name.trim()}".`)
    }
  }

  const payload = {
    ...data,
    ...(data.name ? { name: data.name.trim() } : {}),
  }

  await db.categories.update(id, payload)
}

export async function deleteCategory(id: string): Promise<void> {
  // Checar se tem transações associadas
  const txCount = await db.transactions.where('categoryId').equals(id).count()
  if (txCount > 0) throw new Error('Categoria possui transações. Mova-as antes de excluir.')

  // Remover registros de orçamento dessa categoria
  const budgetIds = await db.budgetMonths
    .where('categoryId')
    .equals(id)
    .primaryKeys()
  await db.budgetMonths.bulkDelete(budgetIds)

  await db.categories.delete(id)
}

export async function toggleCategoryVisibility(id: string): Promise<void> {
  const cat = await db.categories.get(id)
  if (cat) await db.categories.update(id, { isHidden: !cat.isHidden })
}

export async function getCategoriesByGroup(groupId: string): Promise<Category[]> {
  return db.categories.where('groupId').equals(groupId).sortBy('sortOrder')
}

export async function getAllCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray()
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  return db.categories.get(id)
}

// Reordenar categorias dentro de um grupo
export async function reorderCategories(categoryIds: string[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    for (let i = 0; i < categoryIds.length; i++) {
      await db.categories.update(categoryIds[i], { sortOrder: i })
    }
  })
}
