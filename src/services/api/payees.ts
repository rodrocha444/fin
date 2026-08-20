// src/services/api/payees.ts — Operações de beneficiários via Supabase API
import { getClient } from './client'
import { rowToPayee, payeeToRow } from './types'
import { createId } from '@/utils/id'
import type { Payee } from '@/types'

export async function getPayees(): Promise<Payee[]> {
  const client = getClient()
  const { data, error } = await client.from('payees').select('*').order('name', { ascending: true })
  if (error) throw new Error(`Erro ao buscar beneficiários: ${error.message}`)
  return (data || []).map(rowToPayee)
}

export async function getOrCreatePayee(name: string, defaultCategoryId?: string): Promise<Payee> {
  const client = getClient()
  const trimmed = name.trim()
  const { data } = await client.from('payees').select('*').ilike('name', trimmed).maybeSingle()

  if (data) {
    const payee = rowToPayee(data)
    if (defaultCategoryId && defaultCategoryId !== payee.defaultCategoryId) {
      await client.from('payees').update({ default_category_id: defaultCategoryId }).eq('id', payee.id)
    }
    return payee
  }

  const id = createId()
  const row = payeeToRow({
    id,
    name: trimmed,
    defaultCategoryId,
  })

  await client.from('payees').insert(row)
  return { id, name: trimmed, defaultCategoryId }
}
