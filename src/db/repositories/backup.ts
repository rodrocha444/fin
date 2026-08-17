// src/db/repositories/backup.ts
// ─────────────────────────────────────────────────────────────
// Sistema agnóstico e modular de exportação e importação do banco Dexie
// Itera dinamicamente por db.tables, funcionando mesmo se o schema mudar
// ─────────────────────────────────────────────────────────────

import { db } from '../schema'
import { format } from 'date-fns'

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
export async function exportDatabase(): Promise<DatabaseBackup> {
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

/** Importa dados a partir de um objeto DatabaseBackup de forma modular */
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

  let totalRecords = 0
  const importedTables: string[] = []

  await db.transaction('rw', db.tables, async () => {
    for (const table of matchingTables) {
      const records = backup.data[table.name]
      if (Array.isArray(records)) {
        await table.clear()
        if (records.length > 0) {
          // Converter strings ISO para Date em campos conhecidos
          const parsedRecords = records.map(item => parseDates(item))
          await table.bulkAdd(parsedRecords)
        }
        totalRecords += records.length
        importedTables.push(table.name)
      }
    }
  })

  return { importedTables, totalRecords }
}

function parseDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  const dateFields = ['date', 'createdAt', 'nextDate', 'startDate', 'endDate']
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
