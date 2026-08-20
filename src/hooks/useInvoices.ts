// src/hooks/useInvoices.ts — Hooks reativos para faturas e status de pagamento (Cloud-Only)
import { useState, useEffect } from 'react'
import { getPaidInvoicesMap, setInvoicePaidStatus } from '@/db/repositories/invoices'
import { getClosedUnpaidInvoices, type InvoiceData } from '@/utils/invoices'
import type { Account, Transaction } from '@/types'

export function usePaidInvoices() {
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>(() => getPaidInvoicesMap())

  useEffect(() => {
    const handleUpdate = () => setPaidMap(getPaidInvoicesMap())
    window.addEventListener('finplan_paid_invoices_changed', handleUpdate)
    return () => window.removeEventListener('finplan_paid_invoices_changed', handleUpdate)
  }, [])

  const isPaid = (accountId: string, monthKey: string): boolean => {
    return Boolean(paidMap[`${accountId}_${monthKey}`])
  }

  return {
    paidMap,
    isPaid,
    setPaidStatus: setInvoicePaidStatus,
  }
}

export function useClosedUnpaidInvoices(
  account: Account | undefined,
  transactions: Transaction[] | undefined
): InvoiceData[] {
  const { paidMap } = usePaidInvoices()

  if (
    !account ||
    !account.id ||
    account.type !== 'credit_card' ||
    !account.statementClosingDay ||
    !transactions
  ) {
    return []
  }

  return getClosedUnpaidInvoices(
    transactions,
    account.statementClosingDay,
    account.paymentDueDay,
    account.id,
    paidMap,
    12
  )
}
