// src/services/syncEngine.ts — Motor de sincronização legado descontinuado (App migrado para 100% Cloud-Only)
export const syncState = {
  status: 'synced',
  lastSyncAt: null,
  isSyncing: false,
  lastError: null,
  isPaused: false,
}

export function getSyncState() {
  return syncState
}

export function subscribeSyncState(_callback: any) {
  return () => {}
}

export async function executeSync() {
  return { success: true }
}

export function scheduleSync() {}
export function pauseSync() {}
export function resumeSync() {}
export function toggleSyncPause() {}
export async function overrideCloudWithLocalDatabase() {
  return { success: true }
}
export async function overrideLocalWithCloudDatabase() {
  return { success: true }
}
export async function initSyncEngine() {}
