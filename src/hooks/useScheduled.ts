// src/hooks/useScheduled.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'

/** Todas as transações agendadas ativas */
export function useScheduledTransactions() {
  return useLiveQuery(() =>
    db.scheduledTransactions.orderBy('nextDate').filter(s => s.isActive !== false).toArray(),
    []
  )
}
