// src/hooks/useScheduled.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import { getUpcomingScheduled } from '@/db/repositories/scheduled'

/** Todas as transações agendadas ativas */
export function useScheduledTransactions() {
  return useLiveQuery(() =>
    db.scheduledTransactions.orderBy('nextDate').filter(s => s.isActive !== false).toArray(),
    []
  )
}

/** Agendamentos próximos (próximos N dias) */
export function useUpcomingScheduled(daysAhead = 30) {
  return useLiveQuery(() => getUpcomingScheduled(daysAhead), [daysAhead])
}
