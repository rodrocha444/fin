// src/db/repositories/debts.ts
// ─────────────────────────────────────────────────────────────
// CRUD e cálculos para Contas a Receber / Pagar e Pendências (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { DebtAccount, DebtItem, DebtSummary, DebtStatus, DebtType } from '@/types'
import { addMonths } from 'date-fns'

// ── Tipos de Parcelamento de Dívida ──────────────────────────

export interface CreateDebtInstallmentsInput {
  debtAccountId: string
  description: string
  type: DebtType
  totalAmount: number
  installmentCount: number
  startDate: Date
  notes?: string
}

// ── Contas de Devedores / Cobranças ───────────────────────────

export async function createDebtAccount(
  data: Omit<DebtAccount, 'id' | 'createdAt'>
): Promise<string> {
  const normalizedName = data.name.trim().toLowerCase()
  const existing = await db.debtAccounts
    .filter(a => a.isActive !== false && a.name.trim().toLowerCase() === normalizedName)
    .first()

  if (existing) {
    throw new Error(`Já existe uma conta/contato cadastrado com o nome "${data.name.trim()}".`)
  }

  const id = createId()
  await db.debtAccounts.add({
    ...data,
    id,
    name: data.name.trim(),
    color: data.color || '#6366f1',
    isActive: data.isActive ?? true,
    createdAt: new Date(),
  })
  return id
}

export async function updateDebtAccount(
  id: string,
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

export async function deleteDebtAccount(id: string): Promise<void> {
  await db.transaction('rw', db.debtAccounts, db.debtItems, async () => {
    await db.debtItems.where('debtAccountId').equals(id).delete()
    await db.debtAccounts.delete(id)
  })
}

// ── Itens de Pendência / Dívidas ─────────────────────────────

export async function createDebtItem(
  data: Omit<DebtItem, 'id' | 'createdAt'>
): Promise<string> {
  const id = createId()
  await db.debtItems.add({
    ...data,
    id,
    description: data.description.trim(),
    status: data.status || 'pending',
    createdAt: new Date(),
  })
  return id
}

export async function createDebtInstallments(input: CreateDebtInstallmentsInput): Promise<void> {
  const installmentCount = Math.max(1, Math.round(input.installmentCount))
  const installmentAmount = Math.round((input.totalAmount / installmentCount) * 100) / 100
  const groupId = `debt-inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const now = new Date()

  if (installmentCount === 1) {
    await createDebtItem({
      debtAccountId: input.debtAccountId,
      description: input.description,
      type: input.type,
      amount: input.totalAmount,
      dueDate: input.startDate,
      notes: input.notes,
      status: 'pending',
    })
    return
  }

  await db.transaction('rw', db.debtItems, async () => {
    let accumulated = 0
    for (let i = 1; i <= installmentCount; i++) {
      const isLast = i === installmentCount
      const amount = isLast
        ? Math.round((input.totalAmount - accumulated) * 100) / 100
        : installmentAmount
      accumulated += amount

      const dueDate = addMonths(input.startDate, i - 1)
      const itemId = createId()

      await db.debtItems.add({
        id: itemId,
        debtAccountId: input.debtAccountId,
        description: input.description.trim(),
        type: input.type,
        amount,
        dueDate,
        status: 'pending',
        notes: input.notes?.trim() || undefined,
        installmentGroupId: groupId,
        installmentNumber: i,
        installmentTotal: installmentCount,
        totalAmount: input.totalAmount,
        createdAt: now,
      })
    }
  })
}

export async function updateDebtItem(
  id: string,
  data: Partial<Omit<DebtItem, 'id' | 'createdAt'>>
): Promise<void> {
  const payload = {
    ...data,
    ...(data.description ? { description: data.description.trim() } : {}),
  }
  await db.debtItems.update(id, payload)
}

export async function deleteDebtItem(id: string): Promise<void> {
  await db.debtItems.delete(id)
}

export async function setDebtItemStatus(id: string, status: DebtStatus): Promise<void> {
  await db.debtItems.update(id, {
    status,
    settledDate: status === 'settled' ? new Date() : undefined,
  })
}

export async function getDebtItemsByAccount(debtAccountId: string): Promise<DebtItem[]> {
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
