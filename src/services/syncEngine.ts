// src/services/syncEngine.ts — Motor de sincronização bidirecional Dexie <-> Supabase
import { db } from '@/db/schema'
import { getSupabaseClient, getSupabaseConfig } from '@/services/supabase'

export type SyncStatus = 'unconfigured' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSyncAt: Date | null
  lastError: string | null
  isSyncing: boolean
}

let syncState: SyncState = {
  status: 'unconfigured',
  lastSyncAt: null,
  lastError: null,
  isSyncing: false,
}

const listeners = new Set<(state: SyncState) => void>()

function updateState(partial: Partial<SyncState>) {
  syncState = { ...syncState, ...partial }
  listeners.forEach(fn => {
    try { fn(syncState) } catch (e) { console.error('Erro no listener de sync:', e) }
  })
}

export function subscribeSyncState(fn: (state: SyncState) => void): () => void {
  listeners.add(fn)
  fn(syncState)
  return () => { listeners.delete(fn) }
}

export function getSyncState(): SyncState {
  return syncState
}

// ─── Helpers de Conversão de Datas e Formatos ────────────────

function toIso(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') return new Date(val).toISOString()
  return null
}

function toDate(val: any): Date | undefined {
  if (!val) return undefined
  const d = new Date(val)
  return isNaN(d.getTime()) ? undefined : d
}

// ─── Mapeamento de Tabelas Dexie <-> Supabase ───────────────

interface TableSyncDef {
  dexieName: string
  supabaseName: string
  toSupabase: (item: any, now: string) => any
  toDexie: (row: any) => any
}

const SYNC_TABLES: TableSyncDef[] = [
  // 1. Contas
  {
    dexieName: 'accounts',
    supabaseName: 'accounts',
    toSupabase: (item, now) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      initial_balance: item.initialBalance ?? 0,
      credit_limit: item.creditLimit ?? null,
      statement_closing_day: item.statementClosingDay ?? null,
      payment_due_day: item.paymentDueDay ?? null,
      color: item.color || '#6366f1',
      icon: item.icon || 'bank',
      is_active: item.isActive ?? true,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      initialBalance: Number(row.initial_balance ?? 0),
      creditLimit: row.credit_limit != null ? Number(row.credit_limit) : undefined,
      statementClosingDay: row.statement_closing_day ?? undefined,
      paymentDueDay: row.payment_due_day ?? undefined,
      color: row.color,
      icon: row.icon,
      isActive: Boolean(row.is_active),
      createdAt: toDate(row.created_at) || new Date(),
    }),
  },

  // 2. Grupos de Categorias
  {
    dexieName: 'categoryGroups',
    supabaseName: 'category_groups',
    toSupabase: (item, now) => ({
      id: item.id,
      name: item.name,
      type: item.type || null,
      sort_order: item.sortOrder ?? 0,
      is_hidden: item.isHidden ?? false,
      is_system: item.isSystem ?? false,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      name: row.name,
      type: row.type || undefined,
      sortOrder: Number(row.sort_order ?? 0),
      isHidden: Boolean(row.is_hidden),
      isSystem: Boolean(row.is_system),
    }),
  },

  // 3. Categorias
  {
    dexieName: 'categories',
    supabaseName: 'categories',
    toSupabase: (item, now) => ({
      id: item.id,
      group_id: item.groupId,
      name: item.name,
      sort_order: item.sortOrder ?? 0,
      is_hidden: item.isHidden ?? false,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      sortOrder: Number(row.sort_order ?? 0),
      isHidden: Boolean(row.is_hidden),
    }),
  },

  // 4. Orçamento Mensal
  {
    dexieName: 'budgetMonths',
    supabaseName: 'budget_months',
    toSupabase: (item, now) => ({
      id: item.id,
      month: item.month,
      category_id: item.categoryId,
      budgeted: item.budgeted ?? 0,
      activity: item.activity ?? 0,
      available: item.available ?? 0,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      month: row.month,
      categoryId: row.category_id,
      budgeted: Number(row.budgeted ?? 0),
      activity: Number(row.activity ?? 0),
      available: Number(row.available ?? 0),
    }),
  },

  // 5. Transações
  {
    dexieName: 'transactions',
    supabaseName: 'transactions',
    toSupabase: (item, now) => ({
      id: item.id,
      account_id: item.accountId,
      date: toIso(item.date) || now,
      amount: item.amount,
      payee: item.payee || '',
      category_id: item.categoryId || null,
      notes: item.notes || null,
      cleared: item.cleared ?? false,
      type: item.type || 'expense',
      transfer_account_id: item.transferAccountId || null,
      transfer_transaction_id: item.transferTransactionId || null,
      installment_group_id: item.installmentGroupId || null,
      installment_number: item.installmentNumber ?? null,
      installment_total: item.installmentTotal ?? null,
      is_scheduled_projection: item.isScheduledProjection ?? false,
      scheduled_id: item.scheduledId || null,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      accountId: row.account_id,
      date: toDate(row.date) || new Date(),
      amount: Number(row.amount),
      payee: row.payee || '',
      categoryId: row.category_id || undefined,
      notes: row.notes || undefined,
      cleared: Boolean(row.cleared),
      type: row.type || 'expense',
      transferAccountId: row.transfer_account_id || undefined,
      transferTransactionId: row.transfer_transaction_id || undefined,
      installmentGroupId: row.installment_group_id || undefined,
      installmentNumber: row.installment_number ?? undefined,
      installmentTotal: row.installment_total ?? undefined,
      isScheduledProjection: Boolean(row.is_scheduled_projection),
      scheduledId: row.scheduled_id || undefined,
      createdAt: toDate(row.created_at) || new Date(),
    }),
  },

  // 6. Grupos de Parcelamento
  {
    dexieName: 'installmentGroups',
    supabaseName: 'installment_groups',
    toSupabase: (item, now) => ({
      id: item.id,
      description: item.description,
      total_amount: item.totalAmount,
      installment_count: item.installmentCount,
      installment_amount: item.installmentAmount,
      start_date: toIso(item.startDate) || now,
      account_id: item.accountId,
      category_id: item.categoryId || null,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      description: row.description,
      totalAmount: Number(row.total_amount),
      installmentCount: Number(row.installment_count),
      installmentAmount: Number(row.installment_amount),
      startDate: toDate(row.start_date) || new Date(),
      accountId: row.account_id,
      categoryId: row.category_id || undefined,
      createdAt: toDate(row.created_at) || new Date(),
    }),
  },

  // 7. Transações Agendadas
  {
    dexieName: 'scheduledTransactions',
    supabaseName: 'scheduled_transactions',
    toSupabase: (item, now) => ({
      id: item.id,
      account_id: item.accountId,
      amount: item.amount,
      payee: item.payee || '',
      category_id: item.categoryId || null,
      type: item.type || 'expense',
      transfer_account_id: item.transferAccountId || null,
      frequency: item.frequency || 'monthly',
      next_date: toIso(item.nextDate) || now,
      end_date: toIso(item.endDate) || null,
      notes: item.notes || null,
      is_active: item.isActive ?? true,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      accountId: row.account_id,
      amount: Number(row.amount),
      payee: row.payee || '',
      categoryId: row.category_id || undefined,
      type: row.type || 'expense',
      transferAccountId: row.transfer_account_id || undefined,
      frequency: row.frequency || 'monthly',
      nextDate: toDate(row.next_date) || new Date(),
      endDate: toDate(row.end_date),
      notes: row.notes || undefined,
      isActive: Boolean(row.is_active),
      createdAt: toDate(row.created_at) || new Date(),
    }),
  },

  // 8. Beneficiários (Payees)
  {
    dexieName: 'payees',
    supabaseName: 'payees',
    toSupabase: (item, now) => ({
      id: item.id,
      name: item.name,
      default_category_id: item.defaultCategoryId || null,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      name: row.name,
      defaultCategoryId: row.default_category_id || undefined,
    }),
  },

  // 9. Contas de Cobrança / Terceiros
  {
    dexieName: 'debtAccounts',
    supabaseName: 'debt_accounts',
    toSupabase: (item, now) => ({
      id: item.id,
      name: item.name,
      phone: item.phone || null,
      notes: item.notes || null,
      color: item.color || '#6366f1',
      is_active: item.isActive ?? true,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone || undefined,
      notes: row.notes || undefined,
      color: row.color,
      isActive: Boolean(row.is_active),
      createdAt: toDate(row.created_at) || new Date(),
    }),
  },

  // 10. Itens de Cobrança / Pendências
  {
    dexieName: 'debtItems',
    supabaseName: 'debt_items',
    toSupabase: (item, now) => ({
      id: item.id,
      debt_account_id: item.debtAccountId,
      description: item.description,
      type: item.type || 'receivable',
      amount: item.amount,
      due_date: toIso(item.dueDate) || null,
      settled_date: toIso(item.settledDate) || null,
      status: item.status || 'pending',
      notes: item.notes || null,
      installment_group_id: item.installmentGroupId || null,
      installment_number: item.installmentNumber ?? null,
      installment_total: item.installmentTotal ?? null,
      total_amount: item.totalAmount != null ? item.totalAmount : null,
      created_at: toIso(item.createdAt) || now,
      updated_at: toIso(item.updatedAt) || now,
      deleted_at: toIso(item.deletedAt) || null,
    }),
    toDexie: (row) => ({
      id: row.id,
      debtAccountId: row.debt_account_id,
      description: row.description,
      type: row.type || 'receivable',
      amount: Number(row.amount),
      dueDate: toDate(row.due_date),
      settledDate: toDate(row.settled_date),
      status: row.status || 'pending',
      notes: row.notes || undefined,
      installmentGroupId: row.installment_group_id || undefined,
      installmentNumber: row.installment_number ?? undefined,
      installmentTotal: row.installment_total ?? undefined,
      totalAmount: row.total_amount != null ? Number(row.total_amount) : undefined,
      createdAt: toDate(row.created_at) || new Date(),
    }),
  },
]

// ─── Registro de Deleção Local para Propagação ──────────────

export async function recordLocalDeletion(tableName: string, recordId: string): Promise<void> {
  try {
    await db.syncDeletedRecords.add({
      tableName,
      recordId,
      deletedAt: new Date().toISOString(),
    })
    // Agenda sync logo após a deleção
    scheduleSync(1000)
  } catch (e) {
    console.error('Erro ao registrar deleção local para sync:', e)
  }
}

// ─── Execução da Sincronização Bidirecional ──────────────────

let isSyncRunning = false
let isApplyingRemoteSync = false

export async function executeSync(options: { forceAll?: boolean } = {}): Promise<{ success: boolean; error?: string }> {
  if (!navigator.onLine) {
    updateState({ status: 'offline' })
    return { success: false, error: 'Sem conexão com a internet.' }
  }

  const client = getSupabaseClient()
  if (!client) {
    updateState({ status: 'unconfigured' })
    return { success: false, error: 'Supabase não configurado.' }
  }

  if (isSyncRunning) {
    return { success: true }
  }

  isSyncRunning = true
  updateState({ isSyncing: true, status: 'syncing', lastError: null })

  try {
    const nowIso = new Date().toISOString()

    // 1. Obter timestamp da última sincronização
    const metaRecord = await db.syncMeta.get('lastSyncAt')
    const lastSyncIso = options.forceAll ? '1970-01-01T00:00:00.000Z' : (metaRecord?.value || '1970-01-01T00:00:00.000Z')

    // ── ETAPA 1: PUSH DE DELEÇÕES LOCAIS ─────────────────────
    const pendingDeletions = await db.syncDeletedRecords.toArray()
    if (pendingDeletions.length > 0) {
      for (const del of pendingDeletions) {
        const tableDef = SYNC_TABLES.find(t => t.dexieName === del.tableName)
        if (tableDef) {
          await client
            .from(tableDef.supabaseName)
            .update({ deleted_at: del.deletedAt, updated_at: del.deletedAt })
            .eq('id', del.recordId)
        }
      }
      await db.syncDeletedRecords.clear()
    }

    // ── ETAPA 2: PUSH DE REGISTROS LOCAIS PARA O SUPABASE ────
    for (const def of SYNC_TABLES) {
      const table = (db as any)[def.dexieName]
      if (!table) continue

      const localItems = await table.toArray()
      if (localItems.length === 0) continue

      // Filtra itens alterados após o último sync ou envia tudo se for forceAll / primeiro sync
      const toPush = options.forceAll || lastSyncIso === '1970-01-01T00:00:00.000Z'
        ? localItems
        : localItems.filter((item: any) => {
            const itemDate = toIso(item.updatedAt || item.createdAt)
            return !itemDate || itemDate > lastSyncIso
          })

      if (toPush.length > 0) {
        const rows = toPush.map((item: any) => def.toSupabase(item, nowIso))
        // Divide em lotes de 200 itens para não estourar o limite de payload
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200)
          const { error } = await client.from(def.supabaseName).upsert(chunk, { onConflict: 'id' })
          if (error) {
            throw new Error(`Erro ao enviar dados para ${def.supabaseName}: ${error.message}`)
          }
        }
      }
    }

    // ── ETAPA 3: PULL DE REGISTROS DO SUPABASE PARA O DEXIE ──
    isApplyingRemoteSync = true
    try {
      for (const def of SYNC_TABLES) {
        const table = (db as any)[def.dexieName]
        if (!table) continue

        let query = client.from(def.supabaseName).select('*')
        if (!options.forceAll && lastSyncIso !== '1970-01-01T00:00:00.000Z') {
          query = query.gt('updated_at', lastSyncIso)
        }

        const { data: remoteRows, error } = await query
        if (error) {
          throw new Error(`Erro ao buscar dados de ${def.supabaseName}: ${error.message}`)
        }

        if (remoteRows && remoteRows.length > 0) {
          const toDeleteIds: string[] = []
          const toPutItems: any[] = []

          for (const row of remoteRows) {
            if (row.deleted_at) {
              toDeleteIds.push(row.id)
            } else {
              toPutItems.push(def.toDexie(row))
            }
          }

          if (toDeleteIds.length > 0) {
            await table.bulkDelete(toDeleteIds)
          }
          if (toPutItems.length > 0) {
            await table.bulkPut(toPutItems)
          }
        }
      }
    } finally {
      isApplyingRemoteSync = false
    }

    // ── FINALIZAÇÃO ──────────────────────────────────────────
    await db.syncMeta.put({ key: 'lastSyncAt', value: nowIso })
    const lastSyncDate = new Date(nowIso)

    updateState({
      status: 'synced',
      lastSyncAt: lastSyncDate,
      isSyncing: false,
      lastError: null,
    })

    return { success: true }
  } catch (err: any) {
    console.error('Erro na sincronização:', err)
    updateState({
      status: 'error',
      lastError: err?.message || String(err),
      isSyncing: false,
    })
    return { success: false, error: err?.message || 'Falha na sincronização.' }
  } finally {
    isSyncRunning = false
  }
}

// ─── Agendamento e Debounce de Sincronização ─────────────────

let syncTimeout: any = null

export function scheduleSync(delayMs = 1500): void {
  if (!getSupabaseConfig()) {
    updateState({ status: 'unconfigured' })
    return
  }

  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    executeSync()
  }, delayMs)
}

// ─── Inicializador do Motor de Sincronização ────────────────

let isInitialized = false

export async function initSyncEngine(): Promise<void> {
  if (isInitialized) return
  isInitialized = true

  // Registra hooks automáticos em todas as tabelas para detectar mutações e deleções
  SYNC_TABLES.forEach(def => {
    const table = (db as any)[def.dexieName]
    if (table) {
      table.hook('creating', () => {
        if (!isApplyingRemoteSync) scheduleSync(1500)
      })
      table.hook('updating', () => {
        if (!isApplyingRemoteSync) scheduleSync(1500)
      })
      table.hook('deleting', (primKey: any) => {
        if (!isApplyingRemoteSync && primKey) {
          recordLocalDeletion(def.dexieName, String(primKey))
        }
      })
    }
  })

  // Recupera data do último sync salvo
  try {
    const meta = await db.syncMeta.get('lastSyncAt')
    if (meta?.value) {
      syncState.lastSyncAt = new Date(meta.value)
    }
  } catch (e) {
    console.error('Erro ao ler lastSyncAt:', e)
  }

  const config = getSupabaseConfig()
  if (!config) {
    updateState({ status: 'unconfigured' })
  } else if (!navigator.onLine) {
    updateState({ status: 'offline' })
  } else {
    updateState({ status: 'idle' })
    // Executa sincronização inicial após carregamento
    setTimeout(() => {
      executeSync()
    }, 500)
  }

  // Listeners de conexão de rede
  window.addEventListener('online', () => {
    if (getSupabaseConfig()) {
      updateState({ status: 'idle' })
      executeSync()
    }
  })

  window.addEventListener('offline', () => {
    updateState({ status: 'offline' })
  })

  // Sincronização periódica a cada 45 segundos quando o app estiver ativo
  setInterval(() => {
    if (navigator.onLine && getSupabaseConfig() && !isSyncRunning) {
      executeSync()
    }
  }, 45000)
}
