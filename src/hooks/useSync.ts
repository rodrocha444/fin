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
  overrideCloudWithLocalDatabase,
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

  const overrideCloud = async () => {
    return await overrideCloudWithLocalDatabase()
  }

  return {
    ...state,
    syncNow,
    triggerSync,
    pauseSync,
    resumeSync,
    overrideCloud,
    togglePause: toggleSyncPause,
  }
}
