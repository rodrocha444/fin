// src/services/api/categories.ts — Operações de categorias via Supabase API
import { getClient } from './client'
import {
  rowToCategoryGroup,
  categoryGroupToRow,
  categoryGroupToUpdateRow,
  rowToCategory,
  categoryToRow,
  categoryToUpdateRow,
} from './types'
import { createId } from '@/utils/id'
import { notifyDataChanged } from './events'
import type { CategoryGroup, Category } from '@/types'

export async function getCategoryGroups(): Promise<CategoryGroup[]> {
  const client = getClient()
  const { data, error } = await client
    .from('category_groups')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Erro ao buscar grupos: ${error.message}`)
  return (data || []).map(rowToCategoryGroup)
}

export async function getCategories(): Promise<Category[]> {
  const client = getClient()
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Erro ao buscar categorias: ${error.message}`)
  return (data || []).map(rowToCategory)
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const client = getClient()
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar categoria: ${error.message}`)
  return data ? rowToCategory(data) : undefined
}

export async function createGroup(
  nameOrData: string | { name: string; type?: 'expense' | 'income'; sortOrder?: number; isHidden?: boolean; isSystem?: boolean },
  typeParam: 'expense' | 'income' = 'expense'
): Promise<string> {
  const client = getClient()
  const { data: groups } = await client.from('category_groups').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  const maxSort = groups && groups.length > 0 ? Number(groups[0].sort_order || 0) : 0

  const name = typeof nameOrData === 'string' ? nameOrData : nameOrData.name
  const type = typeof nameOrData === 'string' ? typeParam : (nameOrData.type ?? typeParam)
  const sortOrder = typeof nameOrData === 'object' && nameOrData.sortOrder !== undefined ? nameOrData.sortOrder : maxSort + 1
  const isHidden = typeof nameOrData === 'object' && nameOrData.isHidden !== undefined ? nameOrData.isHidden : false
  const isSystem = typeof nameOrData === 'object' && nameOrData.isSystem !== undefined ? nameOrData.isSystem : false

  const id = createId()
  const row = categoryGroupToRow({
    id,
    name,
    type,
    sortOrder,
    isHidden,
    isSystem,
  })

  const { error } = await client.from('category_groups').insert(row)
  if (error) throw new Error(`Erro ao criar grupo: ${error.message}`)
  notifyDataChanged('category_groups', 'insert', id)
  return id
}

export async function updateGroup(id: string, changes: Partial<CategoryGroup>): Promise<void> {
  const client = getClient()
  const row = categoryGroupToUpdateRow(changes)

  const { error } = await client.from('category_groups').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar grupo: ${error.message}`)
  notifyDataChanged('category_groups', 'update', id)
}

export async function deleteGroup(id: string): Promise<void> {
  const client = getClient()
  // Busca categorias filhas
  const { data: cats } = await client.from('categories').select('id').eq('group_id', id)
  const catIds = (cats || []).map(c => c.id)

  if (catIds.length > 0) {
    // Desvincula transações e orçamentos
    await client.from('transactions').update({ category_id: null }).in('category_id', catIds)
    await client.from('budget_months').delete().in('category_id', catIds)
    await client.from('categories').delete().eq('group_id', id)
  }

  const { error } = await client.from('category_groups').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir grupo: ${error.message}`)
  notifyDataChanged('category_groups', 'delete', id)
  notifyDataChanged('categories', 'delete')
}

export async function createCategory(
  groupIdOrData: string | { groupId: string; name: string; sortOrder?: number; isHidden?: boolean },
  nameParam?: string
): Promise<string> {
  const client = getClient()
  const groupId = typeof groupIdOrData === 'string' ? groupIdOrData : groupIdOrData.groupId
  const name = typeof groupIdOrData === 'string' ? (nameParam || '') : groupIdOrData.name

  const { data: cats } = await client.from('categories').select('sort_order').eq('group_id', groupId).order('sort_order', { ascending: false }).limit(1)
  const maxSort = cats && cats.length > 0 ? Number(cats[0].sort_order || 0) : 0
  const sortOrder = typeof groupIdOrData === 'object' && groupIdOrData.sortOrder !== undefined ? groupIdOrData.sortOrder : maxSort + 1
  const isHidden = typeof groupIdOrData === 'object' && groupIdOrData.isHidden !== undefined ? groupIdOrData.isHidden : false

  const id = createId()
  const row = categoryToRow({
    id,
    groupId,
    name,
    sortOrder,
    isHidden,
  })

  const { error } = await client.from('categories').insert(row)
  if (error) throw new Error(`Erro ao criar categoria: ${error.message}`)
  notifyDataChanged('categories', 'insert', id)
  return id
}

export async function updateCategory(id: string, changes: Partial<Category>): Promise<void> {
  const client = getClient()
  const row = categoryToUpdateRow(changes)

  const { error } = await client.from('categories').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar categoria: ${error.message}`)
  notifyDataChanged('categories', 'update', id)
}

export async function deleteCategory(id: string): Promise<void> {
  const client = getClient()
  await client.from('transactions').update({ category_id: null }).eq('category_id', id)
  await client.from('budget_months').delete().eq('category_id', id)

  const { error } = await client.from('categories').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir categoria: ${error.message}`)
  notifyDataChanged('categories', 'delete', id)
}

export async function toggleGroupVisibility(id: string): Promise<void> {
  const client = getClient()
  const { data } = await client.from('category_groups').select('is_hidden').eq('id', id).single()
  if (!data) return
  await client.from('category_groups').update({ is_hidden: !data.is_hidden }).eq('id', id)
  notifyDataChanged('category_groups', 'update', id)
}

export async function toggleCategoryVisibility(id: string): Promise<void> {
  const client = getClient()
  const { data } = await client.from('categories').select('is_hidden').eq('id', id).single()
  if (!data) return
  await client.from('categories').update({ is_hidden: !data.is_hidden }).eq('id', id)
  notifyDataChanged('categories', 'update', id)
}

export async function seedDefaultCategories(): Promise<void> {
  const client = getClient()
  const { data: existing } = await client.from('category_groups').select('id').limit(1)
  if (existing && existing.length > 0) return

  const defaultStructure = [
    {
      name: 'Renda',
      type: 'income' as const,
      isSystem: true,
      categories: ['Salário', 'Outras Rendas'],
    },
    {
      name: 'Gastos Essenciais',
      type: 'expense' as const,
      isSystem: false,
      categories: ['Moradia', 'Supermercado', 'Transporte', 'Saúde', 'Educação'],
    },
    {
      name: 'Gastos Variáveis / Lazer',
      type: 'expense' as const,
      isSystem: false,
      categories: ['Restaurantes & Delivery', 'Lazer & Entretenimento', 'Compras Pessoais', 'Assinaturas & Serviços'],
    },
    {
      name: 'Objetivos & Investimentos',
      type: 'expense' as const,
      isSystem: false,
      categories: ['Reserva de Emergência', 'Investimentos'],
    },
  ]

  for (let gIdx = 0; gIdx < defaultStructure.length; gIdx++) {
    const g = defaultStructure[gIdx]
    const groupId = createId()
    await client.from('category_groups').insert(categoryGroupToRow({
      id: groupId,
      name: g.name,
      type: g.type,
      sortOrder: gIdx,
      isHidden: false,
      isSystem: g.isSystem,
    }))

    for (let cIdx = 0; cIdx < g.categories.length; cIdx++) {
      const catName = g.categories[cIdx]
      await client.from('categories').insert(categoryToRow({
        id: createId(),
        groupId,
        name: catName,
        sortOrder: cIdx,
        isHidden: false,
      }))
    }
  }
}
