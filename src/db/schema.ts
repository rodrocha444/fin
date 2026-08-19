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
  syncDeletedRecords!: EntityTable<{ id?: string; tableName: string; recordId: string; deletedAt: string }, 'id'>

  constructor() {
    super('FinPlanDB')

    // ── v1: schema inicial (legado com auto-increment) ────────
    this.version(1).stores({
      accounts: '++id, name, type, isActive',
      categoryGroups: '++id, name, sortOrder, isSystem',
      categories: '++id, groupId, name, sortOrder',
      budgetMonths: '++id, [month+categoryId], month, categoryId',
      transactions: '++id, accountId, date, categoryId, type, cleared, installmentGroupId, transferAccountId, [accountId+date]',
      installmentGroups: '++id, accountId, categoryId, startDate',
      scheduledTransactions: '++id, accountId, nextDate, isActive, frequency',
      payees: '++id, name',
    })

    // ── v2: contas a receber / pagar e pendências ───────────
    this.version(2).stores({
      debtAccounts: '++id, name, isActive',
      debtItems: '++id, debtAccountId, type, status, dueDate, installmentGroupId, createdAt',
    })

    // ── v3: migração universal para identificadores CUID ─────
    this.version(3)
      .stores({
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
      })
      .upgrade(async tx => {
        // Mapas de conversão ID Antigo -> Novo CUID
        const accountIdMap = new Map<string, string>()
        const groupIdMap = new Map<string, string>()
        const categoryIdMap = new Map<string, string>()
        const installmentGroupIdMap = new Map<string, string>()
        const debtAccountIdMap = new Map<string, string>()
        const transactionIdMap = new Map<string, string>()
        const scheduledIdMap = new Map<string, string>()

        // 1. Contas
        const accounts = await tx.table('accounts').toArray()
        for (const acc of accounts) {
          const oldId = String(acc.id)
          const newId = createId()
          accountIdMap.set(oldId, newId)
          acc.id = newId
        }
        await tx.table('accounts').clear()
        if (accounts.length > 0) await tx.table('accounts').bulkAdd(accounts)

        // 2. Grupos de Categorias
        const groups = await tx.table('categoryGroups').toArray()
        for (const g of groups) {
          const oldId = String(g.id)
          const newId = createId()
          groupIdMap.set(oldId, newId)
          g.id = newId
        }
        await tx.table('categoryGroups').clear()
        if (groups.length > 0) await tx.table('categoryGroups').bulkAdd(groups)

        // 3. Categorias
        const categories = await tx.table('categories').toArray()
        for (const c of categories) {
          const oldId = String(c.id)
          const newId = createId()
          categoryIdMap.set(oldId, newId)
          c.id = newId
          if (c.groupId !== undefined) {
            c.groupId = groupIdMap.get(String(c.groupId)) || String(c.groupId)
          }
        }
        await tx.table('categories').clear()
        if (categories.length > 0) await tx.table('categories').bulkAdd(categories)

        // 4. BudgetMonths
        const budgetMonths = await tx.table('budgetMonths').toArray()
        for (const b of budgetMonths) {
          b.id = createId()
          if (b.categoryId !== undefined) {
            b.categoryId = categoryIdMap.get(String(b.categoryId)) || String(b.categoryId)
          }
        }
        await tx.table('budgetMonths').clear()
        if (budgetMonths.length > 0) await tx.table('budgetMonths').bulkAdd(budgetMonths)

        // 5. Grupos de Parcelamento
        const instGroups = await tx.table('installmentGroups').toArray()
        for (const ig of instGroups) {
          const oldId = String(ig.id)
          const newId = createId()
          installmentGroupIdMap.set(oldId, newId)
          ig.id = newId
          if (ig.accountId !== undefined) {
            ig.accountId = accountIdMap.get(String(ig.accountId)) || String(ig.accountId)
          }
          if (ig.categoryId !== undefined) {
            ig.categoryId = categoryIdMap.get(String(ig.categoryId)) || String(ig.categoryId)
          }
        }
        await tx.table('installmentGroups').clear()
        if (instGroups.length > 0) await tx.table('installmentGroups').bulkAdd(instGroups)

        // 6. Transações
        const transactions = await tx.table('transactions').toArray()
        for (const t of transactions) {
          const oldId = String(t.id)
          const newId = createId()
          transactionIdMap.set(oldId, newId)
          t.id = newId
          if (t.accountId !== undefined) {
            t.accountId = accountIdMap.get(String(t.accountId)) || String(t.accountId)
          }
          if (t.categoryId !== undefined) {
            t.categoryId = categoryIdMap.get(String(t.categoryId)) || String(t.categoryId)
          }
          if (t.transferAccountId !== undefined) {
            t.transferAccountId = accountIdMap.get(String(t.transferAccountId)) || String(t.transferAccountId)
          }
          if (t.installmentGroupId !== undefined) {
            t.installmentGroupId = installmentGroupIdMap.get(String(t.installmentGroupId)) || String(t.installmentGroupId)
          }
        }
        for (const t of transactions) {
          if (t.transferTransactionId !== undefined) {
            t.transferTransactionId = transactionIdMap.get(String(t.transferTransactionId)) || String(t.transferTransactionId)
          }
        }
        await tx.table('transactions').clear()
        if (transactions.length > 0) await tx.table('transactions').bulkAdd(transactions)

        // 7. Transações Agendadas
        const scheduled = await tx.table('scheduledTransactions').toArray()
        for (const s of scheduled) {
          const oldId = String(s.id)
          const newId = createId()
          scheduledIdMap.set(oldId, newId)
          s.id = newId
          if (s.accountId !== undefined) {
            s.accountId = accountIdMap.get(String(s.accountId)) || String(s.accountId)
          }
          if (s.categoryId !== undefined) {
            s.categoryId = categoryIdMap.get(String(s.categoryId)) || String(s.categoryId)
          }
          if (s.transferAccountId !== undefined) {
            s.transferAccountId = accountIdMap.get(String(s.transferAccountId)) || String(s.transferAccountId)
          }
        }
        await tx.table('scheduledTransactions').clear()
        if (scheduled.length > 0) await tx.table('scheduledTransactions').bulkAdd(scheduled)

        // 8. Beneficiários (Payees)
        const payees = await tx.table('payees').toArray()
        for (const p of payees) {
          p.id = createId()
          if (p.defaultCategoryId !== undefined) {
            p.defaultCategoryId = categoryIdMap.get(String(p.defaultCategoryId)) || String(p.defaultCategoryId)
          }
        }
        await tx.table('payees').clear()
        if (payees.length > 0) await tx.table('payees').bulkAdd(payees)

        // 9. Contas de Cobrança / Terceiros
        const debtAccounts = await tx.table('debtAccounts').toArray()
        for (const da of debtAccounts) {
          const oldId = String(da.id)
          const newId = createId()
          debtAccountIdMap.set(oldId, newId)
          da.id = newId
        }
        await tx.table('debtAccounts').clear()
        if (debtAccounts.length > 0) await tx.table('debtAccounts').bulkAdd(debtAccounts)

        // 10. Itens de Cobrança / Pendências
        const debtItems = await tx.table('debtItems').toArray()
        for (const di of debtItems) {
          di.id = createId()
          if (di.debtAccountId !== undefined) {
            di.debtAccountId = debtAccountIdMap.get(String(di.debtAccountId)) || String(di.debtAccountId)
          }
        }
        await tx.table('debtItems').clear()
        if (debtItems.length > 0) await tx.table('debtItems').bulkAdd(debtItems)
      })

    // ── v4: metadados de sincronização e deleções pendentes ─────
    this.version(4).stores({
      syncMeta: 'key',
      syncDeletedRecords: '++id, tableName, recordId, deletedAt',
    })
  }
}

// ─── Instância singleton ─────────────────────────────────────

export const db = new FinPlanDB()
