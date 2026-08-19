// src/hooks/useSync.ts — Hook para sincronização com Supabase
import { useState, useEffect } from 'react'
import {
  getSyncState,
  subscribeSyncState,
  executeSync,
  scheduleSync,
  pauseSync,
  resumeSync,
  toggleSyncPause,
  type SyncState,
} from '@/services/syncEngine'

export function useSync() {
  const [state, setState] = useState<SyncState>(getSyncState())

  useEffect(() => {
    return subscribeSyncState(setState)
  }, [])

  const syncNow = async (forceAll = false) => {
    return await executeSync({ forceAll, forceSync: true })
  }

  const triggerSync = (delayMs?: number) => {
    scheduleSync(delayMs)
  }

  return {
    ...state,
    syncNow,
    triggerSync,
    pauseSync,
    resumeSync,
    togglePause: toggleSyncPause,
  }
}
