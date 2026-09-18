// src/utils/sessionCleanup.ts — Limpeza de dados de sessão e preferências locais
import { clearPaidInvoicesCache } from '@/services/api/invoices'

const USER_SESSION_KEYS = [
  'fin_accounting_start_date',
  'finplan_accounting_regime',
  'finplan_budget_regime',
  'finplan_report_hidden_categories',
  'finplan_last_tx_date',
  'finplan_paid_invoices_map',
] as const

/**
 * Limpa todos os dados locais e caches vinculados à conta do usuário no navegador.
 * Preserva credenciais do Supabase caso configuradas no dispositivo.
 */
export function clearUserSessionData(): void {
  // Limpa cache volátil em memória
  clearPaidInvoicesCache()

  // Remove dados e preferências locais do localStorage
  for (const key of USER_SESSION_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Silencioso em caso de bloqueio de storage
    }
  }

  // Notifica event listeners da janela para resetar estados visuais
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('finplan_paid_invoices_changed'))
    window.dispatchEvent(new CustomEvent('finplan_accounting_period_changed', { detail: { date: null } }))
  }
}
