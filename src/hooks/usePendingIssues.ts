// src/hooks/usePendingIssues.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { getPendingIssues } from '@/db/repositories/issues'

export function usePendingIssues() {
  return useLiveQuery(() => getPendingIssues(), [])
}
