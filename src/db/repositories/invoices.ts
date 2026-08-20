// src/db/repositories/invoices.ts — Gerenciamento do status de pagamento de faturas (Cloud-Only)
const PAID_INVOICES_KEY = 'finplan_paid_invoices_map'

export function getPaidInvoicesMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PAID_INVOICES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.error('Erro ao ler faturas pagas do localStorage:', err)
  }
  return {}
}

export function setInvoicePaidStatus(
  accountId: string,
  monthKey: string,
  isPaid: boolean
): void {
  const current = getPaidInvoicesMap()
  const key = `${accountId}_${monthKey}`
  const updated = { ...current, [key]: isPaid }
  localStorage.setItem(PAID_INVOICES_KEY, JSON.stringify(updated))
  window.dispatchEvent(new Event('finplan_paid_invoices_changed'))
}
