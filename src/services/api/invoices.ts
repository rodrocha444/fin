// src/services/api/invoices.ts — Gerenciamento do status de pagamento de faturas (Cloud & Local)
import { getClient } from './client'
import { notifyDataChanged } from './events'
import { transactionToRow } from './types'
import { createId } from '@/utils/id'
import type { Transaction } from '@/types'

const PAID_INVOICES_KEY = 'finplan_paid_invoices_map'

/** Retorna o mapa de faturas pagas salvo no localStorage (cache síncrono rápido) */
export function getPaidInvoicesMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PAID_INVOICES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.error('Erro ao ler faturas pagas do localStorage:', err)
  }
  return {}
}

/** Extrai faturas pagas a partir de tags explícitas nas transações e combina com o cache local */
export function extractPaidInvoicesMap(
  transactions: Transaction[],
  baseMap?: Record<string, boolean>
): Record<string, boolean> {
  const result: Record<string, boolean> = { ...(baseMap || getPaidInvoicesMap()) }
  const regex = /\[invoice_paid:([^:]+):([^\]]+)\]/

  for (const tx of transactions) {
    if (tx.notes) {
      const match = tx.notes.match(regex)
      if (match) {
        const [, accId, mKey] = match
        result[`${accId}_${mKey}`] = true
      }
    }
  }

  return result
}

export interface SetInvoicePaidOptions {
  sourceAccountId?: string
  amount?: number
  cycleLabel?: string
  paymentDate?: Date
}

/**
 * Atualiza o status de fatura paga.
 * Sincroniza tanto no localStorage quanto no Supabase (garantindo atualização em todos os dispositivos).
 */
export async function setInvoicePaidStatus(
  accountId: string,
  monthKey: string,
  isPaid: boolean,
  options?: SetInvoicePaidOptions
): Promise<void> {
  const current = getPaidInvoicesMap()
  const key = `${accountId}_${monthKey}`
  const updated = { ...current, [key]: isPaid }
  try {
    localStorage.setItem(PAID_INVOICES_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Erro ao salvar no localStorage:', e)
  }
  window.dispatchEvent(new Event('finplan_paid_invoices_changed'))

  const client = getClient()
  const tag = `[invoice_paid:${accountId}:${monthKey}]`

  if (isPaid) {
    if (options?.sourceAccountId && options?.amount && options.amount > 0) {
      // Registrar pagamento real com saída de conta bancária (transferência checking -> credit_card)
      const txId = createId()
      const row = transactionToRow({
        id: txId,
        accountId: options.sourceAccountId,
        transferAccountId: accountId,
        amount: options.amount,
        date: options.paymentDate || new Date(),
        payee: options.cycleLabel
          ? `Pagamento de Fatura ${options.cycleLabel}`
          : 'Pagamento de Fatura',
        type: 'transfer',
        notes: tag,
        cleared: true,
        createdAt: new Date(),
      })

      const { error } = await client.from('transactions').insert(row)
      if (error) console.error('Erro ao registrar transferência de pagamento:', error)
      notifyDataChanged('transactions', 'insert', txId)
    } else {
      // Marcação de status em nuvem (amount: 0 na conta do cartão) para sincronização multi-dispositivo
      const { data: existing } = await client
        .from('transactions')
        .select('id')
        .like('notes', `%${tag}%`)
        .limit(1)

      if (!existing || existing.length === 0) {
        const txId = createId()
        const row = transactionToRow({
          id: txId,
          accountId,
          transferAccountId: accountId,
          amount: 0,
          date: options?.paymentDate || new Date(),
          payee: options?.cycleLabel ? `[Fatura Paga] ${options.cycleLabel}` : `[Fatura Paga] ${monthKey}`,
          type: 'transfer',
          notes: tag,
          cleared: true,
          createdAt: new Date(),
        })

        const { error } = await client.from('transactions').insert(row)
        if (error) console.error('Erro ao persistir marcação de fatura paga:', error)
        notifyDataChanged('transactions', 'insert', txId)
      }
    }
  } else {
    // Desmarcar fatura: remove registro de marcação de status (amount = 0)
    const { error } = await client
      .from('transactions')
      .delete()
      .eq('amount', 0)
      .like('notes', `%${tag}%`)

    if (error) console.error('Erro ao remover marcação de fatura paga:', error)
    notifyDataChanged('transactions', 'delete')
  }

  window.dispatchEvent(new Event('finplan_paid_invoices_changed'))
}
