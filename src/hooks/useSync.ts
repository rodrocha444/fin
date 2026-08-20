// src/hooks/useSync.ts — Compatibilidade (Cloud-Only via Supabase)
import { useFinancialData } from '@/context/FinancialDataContext'

export function useSync() {
  const { isConfigured, isLoading, lastUpdated, refetch } = useFinancialData()

  return {
    status: isConfigured ? 'synced' : 'unconfigured',
    isSyncing: isLoading,
    lastSyncAt: lastUpdated,
    lastError: null,
    isPaused: false,
    syncNow: () => refetch(),
    triggerSync: () => refetch(),
    pauseSync: () => {},
    resumeSync: () => refetch(),
    overrideCloud: async () => ({ success: true }),
    overrideLocal: async () => ({ success: true }),
    togglePause: () => {},
  }
}
