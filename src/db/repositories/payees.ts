// src/db/repositories/payees.ts
// ─────────────────────────────────────────────────────────────
// CRUD de favorecidos (payees)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import type { Payee } from '@/types'

export async function getAllPayees(): Promise<Payee[]> {
  return db.payees.orderBy('name').toArray()
}

export async function getOrCreatePayee(name: string, defaultCategoryId?: number): Promise<number> {
  const trimmed = name.trim()
  const existing = await db.payees.where('name').equals(trimmed).first()
  if (existing?.id !== undefined) return existing.id

  return db.payees.add({ name: trimmed, defaultCategoryId }) as Promise<number>
}

export async function updatePayee(id: number, data: Partial<Omit<Payee, 'id'>>): Promise<void> {
  await db.payees.update(id, data)
}

export async function deletePayee(id: number): Promise<void> {
  await db.payees.delete(id)
}
