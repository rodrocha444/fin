// src/hooks/useInvoices.ts — Hooks reativos para faturas e status de pagamento (Cloud-Only & Local)
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getPaidInvoicesMap,
  extractPaidInvoicesMap,
  setInvoicePaidStatus,
  type SetInvoicePaidOptions,
} from '@/services/api/invoices'
import {
  getClosedUnpaidInvoices,
  isInvoicePaid,
  type InvoiceData,
  type InvoiceCycle,
} from '@/utils/invoices'
import { useTransactionsQuery } from '@/hooks/queries'
import type { Account, Transaction } from '@/types'

export function usePaidInvoices() {
  const { data: transactions = [] } = useTransactionsQuery()
  const [localMap, setLocalMap] = useState<Record<string, boolean>>(() => getPaidInvoicesMap())

  useEffect(() => {
    const handleUpdate = () => setLocalMap(getPaidInvoicesMap())
    window.addEventListener('fin_paid_invoices_changed', handleUpdate)
    window.addEventListener('finplan_paid_invoices_changed', handleUpdate)
    return () => {
      window.removeEventListener('fin_paid_invoices_changed', handleUpdate)
      window.removeEventListener('finplan_paid_invoices_changed', handleUpdate)
    }
  }, [])

  // Combina o cache local com as marcações vindas da nuvem (Supabase)
  const paidMap = useMemo(() => {
    return extractPaidInvoicesMap(transactions, localMap)
  }, [transactions, localMap])

  const checkIsPaid = useCallback(
    (
      accountId: string,
      monthKey: string,
      cycle?: InvoiceCycle,
      totalAmount?: number
    ): boolean => {
      if (cycle && totalAmount !== undefined) {
        return isInvoicePaid(transactions, accountId, cycle, totalAmount, paidMap)
      }
      return Boolean(paidMap[`${accountId}_${monthKey}`])
    },
    [transactions, paidMap]
  )

  const handleSetPaidStatus = useCallback(
    async (
      accountId: string,
      monthKey: string,
      isPaidValue: boolean,
      options?: SetInvoicePaidOptions
    ) => {
      await setInvoicePaidStatus(accountId, monthKey, isPaidValue, options)
    },
    []
  )

  return {
    paidMap,
    isPaid: checkIsPaid,
    setPaidStatus: handleSetPaidStatus,
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
