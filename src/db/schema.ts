// src/db/schema.ts
// ─────────────────────────────────────────────────────────────
// Definição do schema Dexie + migrations (padrão CUID)
// ─────────────────────────────────────────────────────────────

import Dexie, { type EntityTable } from 'dexie'
import { createId } from '@/utils/id'
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
  syncMeta!: EntityTable<{ key: string; value: any }, 'key'>
  syncDeletedRecords!: EntityTable<{ id?: number; tableName: string; recordId: string; deletedAt: string }, 'id'>

  constructor() {
    super('FinPlanDB')

    // Schema canônico universal baseado em identificadores CUID
    this.version(1).stores({
      accounts: 'id, name, type, isActive',
      categoryGroups: 'id, name, sortOrder, isSystem',
      categories: 'id, groupId, name, sortOrder',
      budgetMonths: 'id, [month+categoryId], month, categoryId',
      transactions: 'id, accountId, date, categoryId, type, cleared, installmentGroupId, transferAccountId, [accountId+date]',
      installmentGroups: 'id, accountId, categoryId, startDate',
      scheduledTransactions: 'id, accountId, nextDate, isActive, frequency',
      payees: 'id, name',
      debtAccounts: 'id, name, isActive',
      debtItems: 'id, debtAccountId, type, status, dueDate, installmentGroupId, createdAt',
      syncMeta: 'key',
      syncDeletedRecords: '++id, tableName, recordId, deletedAt',
    })
  }
}

// ─── Instância singleton com recuperação automática de schema ────────────────

export const db = new FinPlanDB()

// Tratamento de segurança: se o navegador tiver resquícios de schema incompatível (UpgradeError),
// recupera o banco automaticamente recriando-o de forma limpa.
db.open().catch(async (err: any) => {
  if (err?.name === 'UpgradeError' || err?.name === 'VersionError' || err?.message?.includes('primary key')) {
    console.warn('Recriando banco local FinPlanDB por incompatibilidade de schema:', err)
    try {
      await db.delete()
      await db.open()
    } catch (reopenErr) {
      console.error('Falha ao reabrir banco após limpeza:', reopenErr)
    }
  }
})
