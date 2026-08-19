// src/db/repositories/accounts.ts
// ─────────────────────────────────────────────────────────────
// CRUD e cálculos de saldo para contas (padrão CUID)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { createId } from '@/utils/id'
import type { Account } from '@/types'

// ── CRUD ─────────────────────────────────────────────────────

export async function createAccount(data: Omit<Account, 'id' | 'createdAt'>): Promise<string> {
  const normalizedName = data.name.trim().toLowerCase()
  const existing = await db.accounts
    .filter(a => a.isActive !== false && a.name.trim().toLowerCase() === normalizedName)
    .first()

  if (existing) {
    throw new Error(`Já existe uma conta cadastrada com o nome "${data.name.trim()}".`)
  }

  const id = createId()
  await db.accounts.add({
    ...data,
    id,
    name: data.name.trim(),
    createdAt: new Date(),
  })
  return id
}

export async function getAccountTransactionCount(accountId: string): Promise<number> {
  const countDirect = await db.transactions.where('accountId').equals(accountId).count()
  const countTransfer = await db.transactions.where('transferAccountId').equals(accountId).count()
  return countDirect + countTransfer
}

export async function updateAccount(id: string, data: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<number> {
  const current = await db.accounts.get(id)
  if (!current) throw new Error(`Conta ${id} não encontrada.`)

  if (data.name) {
    const normalizedName = data.name.trim().toLowerCase()
    const existing = await db.accounts
      .filter(a => a.isActive !== false && a.id !== id && a.name.trim().toLowerCase() === normalizedName)
      .first()

    if (existing) {
      throw new Error(`Já existe uma conta cadastrada com o nome "${data.name.trim()}".`)
    }
  }

  // Não permitir alterar saldo inicial se a conta já possuir transações vinculadas
  if (data.initialBalance !== undefined && data.initialBalance !== current.initialBalance) {
    const txCount = await getAccountTransactionCount(id)
    if (txCount > 0) {
      throw new Error('Não é possível alterar o saldo inicial de uma conta que já possui transações vinculadas.')
    }
  }

  const payload = {
    ...data,
    ...(data.name ? { name: data.name.trim() } : {}),
  }

  return db.accounts.update(id, payload)
}

export async function deleteAccount(id: string): Promise<void> {
  // Verificar se tem transações antes de deletar
  const txCount = await getAccountTransactionCount(id)
  if (txCount > 0) throw new Error('Não é possível excluir uma conta que possui transações.')
  await db.accounts.delete(id)
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id)
}

export async function getAllAccounts(): Promise<Account[]> {
  return db.accounts.orderBy('name').filter(a => a.isActive !== false).toArray()
}

// ── Cálculo de Saldo ─────────────────────────────────────────

export async function calculateAccountBalance(accountId: string): Promise<number> {
  const account = await db.accounts.get(accountId)
  if (!account) throw new Error(`Conta ${accountId} não encontrada`)

  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray()

  let balance = account.type === 'credit_card' ? 0 : account.initialBalance

  for (const tx of transactions) {
    if (tx.type === 'income') {
      balance += tx.amount
    } else if (tx.type === 'expense') {
      balance -= tx.amount
    } else if (tx.type === 'transfer') {
      // Transferência saindo desta conta (ex: pagar cartão)
      if (tx.accountId === accountId) {
        balance -= tx.amount
      }
    }
  }

  // Transferências recebidas (a conta é o destino)
  const incomingTransfers = await db.transactions
    .where('transferAccountId')
    .equals(accountId)
    .filter(tx => tx.type === 'transfer')
    .toArray()

  for (const tx of incomingTransfers) {
    balance += tx.amount
  }

  return balance
}

// Retorna saldo de todas as contas ativas
export async function getAllAccountBalances(): Promise<Map<string, number>> {
  const accounts = await db.accounts.filter(a => a.isActive !== false).toArray()
  const map = new Map<string, number>()
  await Promise.all(
    accounts.map(async (acc) => {
      if (acc.id !== undefined) {
        map.set(acc.id, await calculateAccountBalance(acc.id))
      }
    })
  )
  return map
}

// Saldo total excluindo cartões de crédito (patrimônio líquido em conta)
export async function getNetWorth(): Promise<number> {
  const accounts = await db.accounts.filter(a => a.isActive !== false).toArray()
  let total = 0
  for (const acc of accounts) {
    if (acc.id !== undefined) {
      const bal = await calculateAccountBalance(acc.id)
      total += bal
    }
  }
  return total
}
