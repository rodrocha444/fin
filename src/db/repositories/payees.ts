// src/db/repositories/payees.ts
// ─────────────────────────────────────────────────────────────
// CRUD de favorecidos (payees) (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'

export async function getOrCreatePayee(name: string, defaultCategoryId?: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await db.payees.where('name').equals(trimmed).first()
  if (existing?.id !== undefined) return existing.id

  const id = createId()
  await db.payees.add({ id, name: trimmed, defaultCategoryId })
  return id
}
