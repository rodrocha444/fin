// src/db/repositories/debts.ts
// ─────────────────────────────────────────────────────────────
// CRUD e cálculos para Contas a Receber / Pagar e Pendências
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import type { DebtAccount, DebtItem, DebtSummary, DebtStatus } from '@/types'

// ── Contas de Devedores / Cobranças ───────────────────────────

export async function createDebtAccount(
  data: Omit<DebtAccount, 'id' | 'createdAt'>
): Promise<number> {
  const normalizedName = data.name.trim().toLowerCase()
  const existing = await db.debtAccounts
    .filter(a => a.isActive !== false && a.name.trim().toLowerCase() === normalizedName)
    .first()

  if (existing) {
    throw new Error(`Já existe uma conta/contato cadastrado com o nome "${data.name.trim()}".`)
  }

  return db.debtAccounts.add({
    ...data,
    name: data.name.trim(),
    color: data.color || '#6366f1',
    isActive: data.isActive ?? true,
    createdAt: new Date(),
  }) as Promise<number>
}

export async function updateDebtAccount(
  id: number,
  data: Partial<Omit<DebtAccount, 'id' | 'createdAt'>>
): Promise<void> {
  if (data.name) {
    const normalizedName = data.name.trim().toLowerCase()
    const existing = await db.debtAccounts
      .filter(a => a.isActive !== false && a.id !== id && a.name.trim().toLowerCase() === normalizedName)
      .first()

    if (existing) {
      throw new Error(`Já existe uma conta/contato cadastrado com o nome "${data.name.trim()}".`)
    }
  }

  const payload = {
    ...data,
    ...(data.name ? { name: data.name.trim() } : {}),
  }

  await db.debtAccounts.update(id, payload)
}

export async function deleteDebtAccount(id: number): Promise<void> {
  await db.transaction('rw', db.debtAccounts, db.debtItems, async () => {
    await db.debtItems.where('debtAccountId').equals(id).delete()
    await db.debtAccounts.delete(id)
  })
}

export async function getDebtAccount(id: number): Promise<DebtAccount | undefined> {
  return db.debtAccounts.get(id)
}

export async function getAllDebtAccounts(): Promise<DebtAccount[]> {
  return db.debtAccounts
    .orderBy('name')
    .filter(a => a.isActive !== false)
    .toArray()
}

// ── Itens de Pendência / Dívidas ─────────────────────────────

export async function createDebtItem(
  data: Omit<DebtItem, 'id' | 'createdAt'>
): Promise<number> {
  return db.debtItems.add({
    ...data,
    description: data.description.trim(),
    status: data.status || 'pending',
    createdAt: new Date(),
  }) as Promise<number>
}

export async function updateDebtItem(
  id: number,
  data: Partial<Omit<DebtItem, 'id' | 'createdAt'>>
): Promise<void> {
  const payload = {
    ...data,
    ...(data.description ? { description: data.description.trim() } : {}),
  }
  await db.debtItems.update(id, payload)
}

export async function deleteDebtItem(id: number): Promise<void> {
  await db.debtItems.delete(id)
}

export async function setDebtItemStatus(id: number, status: DebtStatus): Promise<void> {
  await db.debtItems.update(id, {
    status,
    settledDate: status === 'settled' ? new Date() : undefined,
  })
}

export async function getDebtItemsByAccount(debtAccountId: number): Promise<DebtItem[]> {
  const items = await db.debtItems
    .where('debtAccountId')
    .equals(debtAccountId)
    .toArray()

  return items.sort((a, b) => {
    // Pendentes primeiro, depois por data de criação desc
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export async function calculateDebtAccountBalance(debtAccountId: number): Promise<{
  receivable: number
  payable: number
  balance: number
  pendingCount: number
  totalCount: number
}> {
  const items = await db.debtItems.where('debtAccountId').equals(debtAccountId).toArray()
  let receivable = 0
  let payable = 0
  let pendingCount = 0

  for (const item of items) {
    if (item.status === 'pending') {
      pendingCount++
      if (item.type === 'receivable') receivable += item.amount
      else if (item.type === 'payable') payable += item.amount
    }
  }

  return {
    receivable,
    payable,
    balance: receivable - payable,
    pendingCount,
    totalCount: items.length,
  }
}

export async function getDebtSummary(): Promise<DebtSummary> {
  const items = await db.debtItems.where('status').equals('pending').toArray()
  let totalReceivable = 0
  let totalPayable = 0

  for (const item of items) {
    if (item.type === 'receivable') totalReceivable += item.amount
    else if (item.type === 'payable') totalPayable += item.amount
  }

  return {
    totalReceivable,
    totalPayable,
    netBalance: totalReceivable - totalPayable,
    pendingCount: items.length,
  }
}
