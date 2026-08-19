// src/db/repositories/payees.ts
// ─────────────────────────────────────────────────────────────
// CRUD de favorecidos (payees) (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { Payee } from '@/types'

export async function getAllPayees(): Promise<Payee[]> {
  return db.payees.orderBy('name').toArray()
}

export async function getOrCreatePayee(name: string, defaultCategoryId?: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await db.payees.where('name').equals(trimmed).first()
  if (existing?.id !== undefined) return existing.id

  const id = createId()
  await db.payees.add({ id, name: trimmed, defaultCategoryId })
  return id
}

export async function updatePayee(id: string, data: Partial<Omit<Payee, 'id'>>): Promise<void> {
  await db.payees.update(id, data)
}

export async function deletePayee(id: string): Promise<void> {
  await db.payees.delete(id)
}
