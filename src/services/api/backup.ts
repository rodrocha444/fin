// src/services/api/backup.ts — Exportação e Importação de Backup direto no Supabase
import { getClient } from './client'
import { format } from 'date-fns'
import {
  accountToRow,
  categoryGroupToRow,
  categoryToRow,
  budgetMonthToRow,
  transactionToRow,
  installmentGroupToRow,
  scheduledTransactionToRow,
  debtAccountToRow,
  debtItemToRow,
  payeeToRow,
} from './types'
import { createId } from '@/utils/id'

export interface DatabaseBackup {
  meta: {
    appName: string
    dbVersion: number
    exportedAt: string
    totalTables: number
    totalRecords: number
  }
  data: Record<string, any[]>
}

const TABLES = [
  'accounts',
  'category_groups',
  'categories',
  'budget_months',
  'transactions',
  'installment_groups',
  'scheduled_transactions',
  'debt_accounts',
  'debt_items',
  'payees',
]

function normalizeRecordForTable(tableName: string, r: any): any {
  const id = r.id ? String(r.id) : createId()

  switch (tableName) {
    case 'accounts':
      return accountToRow({
        id,
        name: r.name,
        type: r.type,
        initialBalance: Number(r.initialBalance ?? r.initial_balance ?? 0),
        creditLimit: (r.creditLimit ?? r.credit_limit) != null ? Number(r.creditLimit ?? r.credit_limit) : undefined,
        statementClosingDay: r.statementClosingDay ?? r.statement_closing_day ?? undefined,
        paymentDueDay: r.paymentDueDay ?? r.payment_due_day ?? undefined,
        color: r.color || '#6366f1',
        icon: r.icon || 'bank',
        isActive: Boolean(r.isActive ?? r.is_active ?? true),
        createdAt: r.createdAt || r.created_at,
      })

    case 'category_groups':
      return categoryGroupToRow({
        id,
        name: r.name,
        type: r.type || null,
        sortOrder: Number(r.sortOrder ?? r.sort_order ?? 0),
        isHidden: Boolean(r.isHidden ?? r.is_hidden ?? false),
        isSystem: Boolean(r.isSystem ?? r.is_system ?? false),
      })

    case 'categories':
      return categoryToRow({
        id,
        groupId: r.groupId || r.group_id,
        name: r.name,
        sortOrder: Number(r.sortOrder ?? r.sort_order ?? 0),
        isHidden: Boolean(r.isHidden ?? r.is_hidden ?? false),
      })

    case 'budget_months':
      return budgetMonthToRow({
        id,
        month: r.month,
        categoryId: r.categoryId || r.category_id,
        budgeted: Number(r.budgeted ?? 0),
        activity: Number(r.activity ?? 0),
        available: Number(r.available ?? 0),
      })

    case 'transactions':
      return transactionToRow({
        id,
        accountId: r.accountId || r.account_id,
        date: r.date,
        amount: Number(r.amount ?? 0),
        payee: r.payee || '',
        categoryId: r.categoryId || r.category_id || undefined,
        notes: r.notes || undefined,
        cleared: Boolean(r.cleared),
        type: r.type || 'expense',
        transferAccountId: r.transferAccountId || r.transfer_account_id || undefined,
        transferTransactionId: r.transferTransactionId || r.transfer_transaction_id || undefined,
        installmentGroupId: r.installmentGroupId || r.installment_group_id || undefined,
        installmentNumber: r.installmentNumber ?? r.installment_number ?? undefined,
        installmentTotal: r.installmentTotal ?? r.installment_total ?? undefined,
        isScheduledProjection: Boolean(r.isScheduledProjection ?? r.is_scheduled_projection),
        scheduledId: r.scheduledId || r.scheduled_id || undefined,
        createdAt: r.createdAt || r.created_at,
      })

    case 'installment_groups':
      return installmentGroupToRow({
        id,
        description: r.description,
        totalAmount: Number(r.totalAmount ?? r.total_amount ?? 0),
        installmentCount: Number(r.installmentCount ?? r.installment_count ?? 1),
        installmentAmount: Number(r.installmentAmount ?? r.installment_amount ?? 0),
        startDate: r.startDate || r.start_date,
        accountId: r.accountId || r.account_id,
        categoryId: r.categoryId || r.category_id || undefined,
        createdAt: r.createdAt || r.created_at,
      })

    case 'scheduled_transactions':
      return scheduledTransactionToRow({
        id,
        accountId: r.accountId || r.account_id,
        amount: Number(r.amount ?? 0),
        payee: r.payee || '',
        categoryId: r.categoryId || r.category_id || undefined,
        type: r.type || 'expense',
        transferAccountId: r.transferAccountId || r.transfer_account_id || undefined,
        frequency: r.frequency || 'monthly',
        nextDate: r.nextDate || r.next_date,
        endDate: r.endDate || r.end_date,
        notes: r.notes || undefined,
        isActive: Boolean(r.isActive ?? r.is_active ?? true),
        createdAt: r.createdAt || r.created_at,
      })

    case 'debt_accounts':
      return debtAccountToRow({
        id,
        name: r.name,
        phone: r.phone || undefined,
        notes: r.notes || undefined,
        color: r.color || '#6366f1',
        isActive: Boolean(r.isActive ?? r.is_active ?? true),
        createdAt: r.createdAt || r.created_at,
      })

    case 'debt_items':
      return debtItemToRow({
        id,
        debtAccountId: r.debtAccountId || r.debt_account_id,
        description: r.description,
        type: r.type || 'receivable',
        amount: Number(r.amount ?? 0),
        dueDate: r.dueDate || r.due_date,
        settledDate: r.settledDate || r.settled_date,
        status: r.status || 'pending',
        notes: r.notes || undefined,
        installmentGroupId: r.installmentGroupId || r.installment_group_id || undefined,
        installmentNumber: r.installmentNumber ?? r.installment_number ?? undefined,
        installmentTotal: r.installmentTotal ?? r.installment_total ?? undefined,
        totalAmount: (r.totalAmount ?? r.total_amount) != null ? Number(r.totalAmount ?? r.total_amount) : undefined,
        createdAt: r.createdAt || r.created_at,
      })

    case 'payees':
      return payeeToRow({
        id,
        name: r.name,
        defaultCategoryId: r.defaultCategoryId || r.default_category_id || undefined,
      })

    default:
      return r
  }
}

export async function exportDatabase(): Promise<DatabaseBackup> {
  const client = getClient()
  const data: Record<string, any[]> = {}
  let totalRecords = 0

  for (const tableName of TABLES) {
    const { data: rows, error } = await client.from(tableName).select('*')
    if (!error && rows) {
      data[tableName] = rows
      totalRecords += rows.length
    }
  }

  return {
    meta: {
      appName: 'FinPlan',
      dbVersion: 2,
      exportedAt: new Date().toISOString(),
      totalTables: TABLES.length,
      totalRecords,
    },
    data,
  }
}

export async function downloadDatabaseBackup(): Promise<void> {
  const backup = await exportDatabase()
  const jsonStr = JSON.stringify(backup, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm')
  const filename = `finplan_backup_${timestamp}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importDatabase(
  backup: DatabaseBackup
): Promise<{ importedTables: string[]; totalRecords: number }> {
  if (!backup || !backup.data || typeof backup.data !== 'object') {
    throw new Error('Arquivo de backup inválido ou corrompido.')
  }

  const client = getClient()
  const importedTables: string[] = []
  let totalRecords = 0

  // 1. Limpar tabelas existentes no Supabase em ordem reversa
  const reversedTables = [...TABLES].reverse()
  for (const tableName of reversedTables) {
    await client.from(tableName).delete().neq('id', '___force_delete_all___')
  }

  // 2. Inserir dados do backup com normalização para snake_case do Supabase
  for (const tableName of TABLES) {
    const camelMap: Record<string, string> = {
      category_groups: 'categoryGroups',
      budget_months: 'budgetMonths',
      installment_groups: 'installmentGroups',
      scheduled_transactions: 'scheduledTransactions',
      debt_accounts: 'debtAccounts',
      debt_items: 'debtItems',
    }
    const camelKey = camelMap[tableName]
    const records = backup.data[tableName] || (camelKey ? backup.data[camelKey] : undefined)

    if (Array.isArray(records) && records.length > 0) {
      const rowsToInsert = records.map(r => normalizeRecordForTable(tableName, r))

      for (let i = 0; i < rowsToInsert.length; i += 100) {
        const chunk = rowsToInsert.slice(i, i + 100)
        const { error } = await client.from(tableName).upsert(chunk, { onConflict: 'id' })
        if (error) {
          console.warn(`Erro ao importar lote em ${tableName}:`, error.message)
          throw new Error(`Erro ao importar lote em ${tableName}: ${error.message}`)
        }
      }

      totalRecords += records.length
      importedTables.push(tableName)
    }
  }

  return { importedTables, totalRecords }
}

export async function clearEntireDatabase(): Promise<void> {
  const client = getClient()
  const reversedTables = [...TABLES].reverse()
  for (const tableName of reversedTables) {
    await client.from(tableName).delete().neq('id', '___force_delete_all___')
  }
}
