// src/db/repositories/accounts.ts
// ─────────────────────────────────────────────────────────────
// CRUD e cálculos de saldo para contas
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import type { Account } from '@/types'

// ── CRUD ─────────────────────────────────────────────────────

export async function createAccount(data: Omit<Account, 'id' | 'createdAt'>) {
  const normalizedName = data.name.trim().toLowerCase()
  const existing = await db.accounts
    .filter(a => a.isActive !== false && a.name.trim().toLowerCase() === normalizedName)
    .first()

  if (existing) {
    throw new Error(`Já existe uma conta cadastrada com o nome "${data.name.trim()}".`)
  }

  return db.accounts.add({ ...data, name: data.name.trim(), createdAt: new Date() })
}

export async function updateAccount(id: number, data: Partial<Omit<Account, 'id' | 'createdAt'>>) {
  if (data.name) {
    const normalizedName = data.name.trim().toLowerCase()
    const existing = await db.accounts
      .filter(a => a.isActive !== false && a.id !== id && a.name.trim().toLowerCase() === normalizedName)
      .first()

    if (existing) {
      throw new Error(`Já existe uma conta cadastrada com o nome "${data.name.trim()}".`)
    }
  }

  const payload = {
    ...data,
    ...(data.name ? { name: data.name.trim() } : {}),
  }

  return db.accounts.update(id, payload)
}

export async function deleteAccount(id: number) {
  // Verificar se tem transações antes de deletar
  const txCount = await db.transactions.where('accountId').equals(id).count()
  if (txCount > 0) throw new Error('Não é possível excluir uma conta que possui transações.')
  return db.accounts.delete(id)
}

export async function getAccount(id: number) {
  return db.accounts.get(id)
}

export async function getAllAccounts() {
  return db.accounts.orderBy('name').filter(a => a.isActive !== false).toArray()
}

// ── Cálculo de Saldo ─────────────────────────────────────────
//
// O saldo de uma conta é calculado dinamicamente a partir das transações.
// Isso garante consistência e evita drift entre saldo armazenado e real.
//
// Para conta corrente/poupança:
//   saldo = initialBalance + soma(income) - soma(expense) + transferências recebidas - transferências enviadas
//
// Para cartão de crédito:
//   saldo = 0 - soma(expenses) + soma(payments/transfers recebidos)
//   (Opção A: parcelamento total aparece desde o dia 1, pois todas as
//    N transações são criadas com datas futuras mas o group já existe)

export async function calculateAccountBalance(accountId: number): Promise<number> {
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
export async function getAllAccountBalances(): Promise<Map<number, number>> {
  const accounts = await db.accounts.filter(a => a.isActive !== false).toArray()
  const map = new Map<number, number>()
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
