// src/db/repositories/backup.ts
// ─────────────────────────────────────────────────────────────
// Sistema agnóstico e modular de exportação e importação do banco Dexie
// Suporta exportação no formato CUID e importação com migração
// automática de backups legados (IDs numéricos -> CUIDs)
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { format } from 'date-fns'
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

/** Exporta todos os dados de todas as tabelas do banco de forma agnóstica ao schema */
async function exportDatabase(): Promise<DatabaseBackup> {
  const data: Record<string, any[]> = {}
  let totalRecords = 0

  for (const table of db.tables) {
    const records = await table.toArray()
    data[table.name] = records
    totalRecords += records.length
  }

  return {
    meta: {
      appName: 'FinPlan',
      dbVersion: db.verno,
      exportedAt: new Date().toISOString(),
      totalTables: db.tables.length,
      totalRecords,
    },
    data,
  }
}

/** Dispara o download do arquivo de backup no navegador */
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

/** Importa dados a partir de um objeto DatabaseBackup de forma modular com retrocompatibilidade */
export async function importDatabase(
  backup: DatabaseBackup
): Promise<{ importedTables: string[]; totalRecords: number }> {
  if (!backup || !backup.data || typeof backup.data !== 'object') {
    throw new Error('Arquivo de backup inválido ou corrompido.')
  }

  const tableNames = Object.keys(backup.data)
  const matchingTables = db.tables.filter(t => tableNames.includes(t.name))

  if (matchingTables.length === 0) {
    throw new Error('Nenhuma tabela compatível encontrada no arquivo de backup.')
  }

  // Detecta se o backup precisa de normalização de IDs (se foi exportado em versão anterior ou contém IDs numéricos)
  const isLegacy = (backup.meta?.dbVersion ?? 1) < 3 || hasNumericIds(backup.data)
  const normalizedData = isLegacy ? normalizeLegacyBackup(backup.data) : backup.data

  let totalRecords = 0
  const importedTables: string[] = []

  await db.transaction('rw', db.tables, async () => {
    for (const table of matchingTables) {
      const records = normalizedData[table.name]
      if (Array.isArray(records)) {
        await table.clear()
        if (records.length > 0) {
          // Converter strings ISO para Date em campos conhecidos e garantir ID string
          const parsedRecords = records.map(item => {
            const parsed = parseDates(item)
            if (!parsed.id) parsed.id = createId()
            else parsed.id = String(parsed.id)
            return parsed
          })
          await table.bulkAdd(parsedRecords)
        }
        totalRecords += records.length
        importedTables.push(table.name)
      }
    }
  })

  return { importedTables, totalRecords }
}

function hasNumericIds(data: Record<string, any[]>): boolean {
  for (const list of Object.values(data)) {
    if (Array.isArray(list) && list.length > 0) {
      for (const item of list) {
        if (typeof item?.id === 'number') return true
      }
    }
  }
  return false
}

/** Normaliza backups legados com IDs numéricos para CUIDs mantendo a integridade referencial */
function normalizeLegacyBackup(data: Record<string, any[]>): Record<string, any[]> {
  const result: Record<string, any[]> = {}
  for (const [key, val] of Object.entries(data)) {
    result[key] = Array.isArray(val) ? val.map(i => ({ ...i })) : val
  }

  const accountIdMap = new Map<string, string>()
  const groupIdMap = new Map<string, string>()
  const categoryIdMap = new Map<string, string>()
  const installmentGroupIdMap = new Map<string, string>()
  const debtAccountIdMap = new Map<string, string>()
  const transactionIdMap = new Map<string, string>()
  const scheduledIdMap = new Map<string, string>()

  // 1. Accounts
  if (Array.isArray(result.accounts)) {
    for (const acc of result.accounts) {
      const oldId = String(acc.id)
      const newId = createId()
      accountIdMap.set(oldId, newId)
      acc.id = newId
    }
  }

  // 2. Category Groups
  if (Array.isArray(result.categoryGroups)) {
    for (const g of result.categoryGroups) {
      const oldId = String(g.id)
      const newId = createId()
      groupIdMap.set(oldId, newId)
      g.id = newId
    }
  }

  // 3. Categories
  if (Array.isArray(result.categories)) {
    for (const c of result.categories) {
      const oldId = String(c.id)
      const newId = createId()
      categoryIdMap.set(oldId, newId)
      c.id = newId
      if (c.groupId !== undefined) {
        c.groupId = groupIdMap.get(String(c.groupId)) || String(c.groupId)
      }
    }
  }

  // 4. BudgetMonths
  if (Array.isArray(result.budgetMonths)) {
    for (const b of result.budgetMonths) {
      b.id = createId()
      if (b.categoryId !== undefined) {
        b.categoryId = categoryIdMap.get(String(b.categoryId)) || String(b.categoryId)
      }
    }
  }

  // 5. InstallmentGroups
  if (Array.isArray(result.installmentGroups)) {
    for (const ig of result.installmentGroups) {
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
  }

  // 6. Transactions
  if (Array.isArray(result.transactions)) {
    for (const t of result.transactions) {
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
    for (const t of result.transactions) {
      if (t.transferTransactionId !== undefined) {
        t.transferTransactionId = transactionIdMap.get(String(t.transferTransactionId)) || String(t.transferTransactionId)
      }
    }
  }

  // 7. Scheduled Transactions
  if (Array.isArray(result.scheduledTransactions)) {
    for (const s of result.scheduledTransactions) {
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
  }

  // 8. Payees
  if (Array.isArray(result.payees)) {
    for (const p of result.payees) {
      p.id = createId()
      if (p.defaultCategoryId !== undefined) {
        p.defaultCategoryId = categoryIdMap.get(String(p.defaultCategoryId)) || String(p.defaultCategoryId)
      }
    }
  }

  // 9. Debt Accounts
  if (Array.isArray(result.debtAccounts)) {
    for (const da of result.debtAccounts) {
      const oldId = String(da.id)
      const newId = createId()
      debtAccountIdMap.set(oldId, newId)
      da.id = newId
    }
  }

  // 10. Debt Items
  if (Array.isArray(result.debtItems)) {
    for (const di of result.debtItems) {
      di.id = createId()
      if (di.debtAccountId !== undefined) {
        di.debtAccountId = debtAccountIdMap.get(String(di.debtAccountId)) || String(di.debtAccountId)
      }
    }
  }

  return result
}

function parseDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  const dateFields = [
    'date',
    'createdAt',
    'nextDate',
    'startDate',
    'endDate',
    'dueDate',
    'settledDate',
  ]
  const res = { ...obj }
  for (const field of dateFields) {
    if (res[field] && typeof res[field] === 'string' && !isNaN(Date.parse(res[field]))) {
      res[field] = new Date(res[field])
    }
  }
  return res
}

/** Limpa todas as tabelas do banco Dexie de forma segura */
export async function clearEntireDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
  })
}
