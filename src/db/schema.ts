// src/db/schema.ts
// ─────────────────────────────────────────────────────────────
// Definição do schema Dexie + migrations
// ─────────────────────────────────────────────────────────────

import Dexie, { type EntityTable } from 'dexie'
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  Transaction,
  InstallmentGroup,
  ScheduledTransaction,
  Payee,
  DebtAccount,
  DebtItem,
} from '@/types'

// ─── Tipo da instância do banco ──────────────────────────────

export class FinPlanDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>
  categoryGroups!: EntityTable<CategoryGroup, 'id'>
  categories!: EntityTable<Category, 'id'>
  budgetMonths!: EntityTable<BudgetMonth, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  installmentGroups!: EntityTable<InstallmentGroup, 'id'>
  scheduledTransactions!: EntityTable<ScheduledTransaction, 'id'>
  payees!: EntityTable<Payee, 'id'>
  debtAccounts!: EntityTable<DebtAccount, 'id'>
  debtItems!: EntityTable<DebtItem, 'id'>

  constructor() {
    super('FinPlanDB')

    // ── v1: schema inicial ──────────────────────────────────
    this.version(1).stores({
      accounts:
        '++id, name, type, isActive',
      categoryGroups:
        '++id, name, sortOrder, isSystem',
      categories:
        '++id, groupId, name, sortOrder',
      budgetMonths:
        '++id, [month+categoryId], month, categoryId',
      transactions:
        '++id, accountId, date, categoryId, type, cleared, installmentGroupId, transferAccountId, [accountId+date]',
      installmentGroups:
        '++id, accountId, categoryId, startDate',
      scheduledTransactions:
        '++id, accountId, nextDate, isActive, frequency',
      payees:
        '++id, name',
    })

    // ── v2: contas a receber / pagar e pendências ───────────
    this.version(2).stores({
      debtAccounts: '++id, name, isActive',
      debtItems: '++id, debtAccountId, type, status, dueDate, installmentGroupId, createdAt',
    })
  }
}

// ─── Instância singleton ─────────────────────────────────────

export const db = new FinPlanDB()
