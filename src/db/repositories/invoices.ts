// src/db/repositories/invoices.ts — Gerenciamento do status de pagamento de faturas
import { db } from '@/db/schema'

const PAID_INVOICES_KEY = 'paid_invoices_map'

/**
 * Retorna o mapa de faturas marcadas como pagas { [accountId_monthKey]: boolean }
 */
export async function getPaidInvoicesMap(): Promise<Record<string, boolean>> {
  try {
    const record = await db.syncMeta.get(PAID_INVOICES_KEY)
    if (record && typeof record.value === 'object' && record.value !== null) {
      return record.value as Record<string, boolean>
    }
  } catch (err) {
    console.error('Erro ao obter mapa de faturas pagas:', err)
  }
  return {}
}

/**
 * Define o status de pagamento de uma fatura de forma persistente
 */
export async function setInvoicePaidStatus(
  accountId: string,
  monthKey: string,
  isPaid: boolean
): Promise<void> {
  const currentMap = await getPaidInvoicesMap()
  const key = `${accountId}_${monthKey}`
  const updatedMap = { ...currentMap, [key]: isPaid }
  await db.syncMeta.put({ key: PAID_INVOICES_KEY, value: updatedMap })
}
