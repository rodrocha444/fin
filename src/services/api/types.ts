// src/services/api/types.ts — Conversores de dados entre Supabase e Typescript
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  Transaction,
  InstallmentGroup,
  ScheduledTransaction,
  Payee,
  DebtAccount,
  DebtItem,
} from '@/types'

export function toDate(val: any): Date | undefined {
  if (!val) return undefined
  const d = new Date(val)
  return isNaN(d.getTime()) ? undefined : d
}

export function toIso(val: any): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (val instanceof Date) return val.toISOString()
  return new Date(val).toISOString()
}

// 1. Contas
export function rowToAccount(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalance: Number(row.initial_balance ?? 0),
    creditLimit: row.credit_limit != null ? Number(row.credit_limit) : undefined,
    statementClosingDay: row.statement_closing_day ?? undefined,
    paymentDueDay: row.payment_due_day ?? undefined,
    color: row.color || '#6366f1',
    icon: row.icon || 'bank',
    isActive: Boolean(row.is_active),
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function accountToRow(item: Partial<Account>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    type: item.type,
    initial_balance: item.initialBalance ?? 0,
    credit_limit: item.creditLimit ?? null,
    statement_closing_day: item.statementClosingDay ?? null,
    payment_due_day: item.paymentDueDay ?? null,
    color: item.color || '#6366f1',
    icon: item.icon || 'bank',
    is_active: item.isActive ?? true,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

// 2. Grupos de Categorias
export function rowToCategoryGroup(row: any): CategoryGroup {
  return {
    id: row.id,
    name: row.name,
    type: row.type || undefined,
    sortOrder: Number(row.sort_order ?? 0),
    isHidden: Boolean(row.is_hidden),
    isSystem: Boolean(row.is_system),
  }
}

export function categoryGroupToRow(item: Partial<CategoryGroup>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    type: item.type || null,
    sort_order: item.sortOrder ?? 0,
    is_hidden: item.isHidden ?? false,
    is_system: item.isSystem ?? false,
    created_at: now,
    updated_at: now,
  }
}

// 3. Categorias
export function rowToCategory(row: any): Category {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    sortOrder: Number(row.sort_order ?? 0),
    isHidden: Boolean(row.is_hidden),
  }
}

export function categoryToRow(item: Partial<Category>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    group_id: item.groupId,
    name: item.name,
    sort_order: item.sortOrder ?? 0,
    is_hidden: item.isHidden ?? false,
    created_at: now,
    updated_at: now,
  }
}

// 4. Orçamento Mensal
export function rowToBudgetMonth(row: any): BudgetMonth {
  return {
    id: row.id,
    month: row.month,
    categoryId: row.category_id,
    budgeted: Number(row.budgeted ?? 0),
    activity: Number(row.activity ?? 0),
    available: Number(row.available ?? 0),
  }
}

export function budgetMonthToRow(item: Partial<BudgetMonth>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    month: item.month,
    category_id: item.categoryId,
    budgeted: item.budgeted ?? 0,
    activity: item.activity ?? 0,
    available: item.available ?? 0,
    created_at: now,
    updated_at: now,
  }
}

// 5. Transações
export function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    date: toDate(row.date) || new Date(),
    amount: Number(row.amount),
    payee: row.payee || '',
    categoryId: row.category_id || undefined,
    notes: row.notes || undefined,
    cleared: Boolean(row.cleared),
    type: row.type || 'expense',
    transferAccountId: row.transfer_account_id || undefined,
    transferTransactionId: row.transfer_transaction_id || undefined,
    installmentGroupId: row.installment_group_id || undefined,
    installmentNumber: row.installment_number ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    splitGroupId: row.split_group_id || undefined,
    isScheduledProjection: Boolean(row.is_scheduled_projection),
    scheduledId: row.scheduled_id || undefined,
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function transactionToRow(item: Partial<Transaction>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    account_id: item.accountId,
    date: toIso(item.date) || now,
    amount: item.amount,
    payee: item.payee || '',
    category_id: item.categoryId || null,
    notes: item.notes || null,
    cleared: item.cleared ?? false,
    type: item.type || 'expense',
    transfer_account_id: item.transferAccountId || null,
    transfer_transaction_id: item.transferTransactionId || null,
    installment_group_id: item.installmentGroupId || null,
    installment_number: item.installmentNumber ?? null,
    installment_total: item.installmentTotal ?? null,
    split_group_id: item.splitGroupId || null,
    is_scheduled_projection: item.isScheduledProjection ?? false,
    scheduled_id: item.scheduledId || null,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

// 6. Grupos de Parcelamento
export function rowToInstallmentGroup(row: any): InstallmentGroup {
  return {
    id: row.id,
    description: row.description,
    totalAmount: Number(row.total_amount),
    installmentCount: Number(row.installment_count),
    installmentAmount: Number(row.installment_amount),
    startDate: toDate(row.start_date) || new Date(),
    accountId: row.account_id,
    categoryId: row.category_id || undefined,
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function installmentGroupToRow(item: Partial<InstallmentGroup>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    description: item.description,
    total_amount: item.totalAmount,
    installment_count: item.installmentCount,
    installment_amount: item.installmentAmount,
    start_date: toIso(item.startDate) || now,
    account_id: item.accountId,
    category_id: item.categoryId || null,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

// 7. Transações Agendadas
export function rowToScheduledTransaction(row: any): ScheduledTransaction {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: Number(row.amount),
    payee: row.payee || '',
    categoryId: row.category_id || undefined,
    type: row.type || 'expense',
    transferAccountId: row.transfer_account_id || undefined,
    frequency: row.frequency || 'monthly',
    nextDate: toDate(row.next_date) || new Date(),
    endDate: toDate(row.end_date),
    notes: row.notes || undefined,
    isActive: Boolean(row.is_active),
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function scheduledTransactionToRow(item: Partial<ScheduledTransaction>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    account_id: item.accountId,
    amount: item.amount,
    payee: item.payee || '',
    category_id: item.categoryId || null,
    type: item.type || 'expense',
    transfer_account_id: item.transferAccountId || null,
    frequency: item.frequency || 'monthly',
    next_date: toIso(item.nextDate) || now,
    end_date: toIso(item.endDate) || null,
    notes: item.notes || null,
    is_active: item.isActive ?? true,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

// 8. Beneficiários (Payees)
export function rowToPayee(row: any): Payee {
  return {
    id: row.id,
    name: row.name,
    defaultCategoryId: row.default_category_id || undefined,
  }
}

export function payeeToRow(item: Partial<Payee>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    default_category_id: item.defaultCategoryId || null,
    created_at: now,
    updated_at: now,
  }
}

// 9. Contas de Cobrança / Terceiros
export function rowToDebtAccount(row: any): DebtAccount {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || undefined,
    notes: row.notes || undefined,
    color: row.color || '#6366f1',
    isActive: Boolean(row.is_active),
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function debtAccountToRow(item: Partial<DebtAccount>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    phone: item.phone || null,
    notes: item.notes || null,
    color: item.color || '#6366f1',
    is_active: item.isActive ?? true,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

// 10. Itens de Cobrança / Pendências
export function rowToDebtItem(row: any): DebtItem {
  return {
    id: row.id,
    debtAccountId: row.debt_account_id,
    description: row.description,
    type: row.type || 'receivable',
    amount: Number(row.amount),
    dueDate: toDate(row.due_date),
    settledDate: toDate(row.settled_date),
    status: row.status || 'pending',
    notes: row.notes || undefined,
    installmentGroupId: row.installment_group_id || undefined,
    installmentNumber: row.installment_number ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    totalAmount: row.total_amount != null ? Number(row.total_amount) : undefined,
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function debtItemToRow(item: Partial<DebtItem>) {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    debt_account_id: item.debtAccountId,
    description: item.description,
    type: item.type || 'receivable',
    amount: item.amount,
    due_date: toIso(item.dueDate) || null,
    settled_date: toIso(item.settledDate) || null,
    status: item.status || 'pending',
    notes: item.notes || null,
    installment_group_id: item.installmentGroupId || null,
    installment_number: item.installmentNumber ?? null,
    installment_total: item.installmentTotal ?? null,
    total_amount: item.totalAmount != null ? item.totalAmount : null,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}
