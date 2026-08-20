// src/services/api/events.ts — Barramento de eventos local para sincronização instantânea
export type TableName =
  | 'accounts'
  | 'category_groups'
  | 'categories'
  | 'budget_months'
  | 'transactions'
  | 'installment_groups'
  | 'scheduled_transactions'
  | 'debt_accounts'
  | 'debt_items'
  | 'payees'
  | 'all'

export interface DataChangeEventDetail {
  table: TableName
  action?: 'insert' | 'update' | 'delete' | 'upsert' | 'refresh'
  id?: string
}

export function notifyDataChanged(table: TableName, action: 'insert' | 'update' | 'delete' | 'upsert' | 'refresh' = 'refresh', id?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<DataChangeEventDetail>('finplan_data_changed', {
        detail: { table, action, id },
      })
    )
  }
}
