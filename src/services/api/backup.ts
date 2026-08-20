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

  // 2. Inserir dados do backup
  for (const tableName of TABLES) {
    // Suporte para chaves camelCase ou snake_case no backup
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
      const rowsToInsert = records.map(r => {
        const item = { ...r }
        if (!item.id) item.id = createId()
        else item.id = String(item.id)
        return item
      })

      for (let i = 0; i < rowsToInsert.length; i += 100) {
        const chunk = rowsToInsert.slice(i, i + 100)
        const { error } = await client.from(tableName).upsert(chunk, { onConflict: 'id' })
        if (error) {
          console.warn(`Erro ao importar lote em ${tableName}:`, error.message)
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

