// src/services/api/types.ts — Conversores de dados entre Supabase e Typescript
// Tipado via src/types/database.types.ts (Supabase TypeGen)
import type { Tables } from '@/types/database.types'
import type {
  Account,
  CategoryGroup,
  Category,
  BudgetMonth,
  Transaction,
  InstallmentGroup,
  Payee,
  DebtAccount,
  DebtItem,
} from '@/types'

export function toDate(val: string | null | undefined): Date | undefined {
  if (!val) return undefined
  const d = new Date(val)
  return isNaN(d.getTime()) ? undefined : d
}

export function toIso(val: Date | string | null | undefined): string | null {
  if (!val) return null
  if (typeof val === 'string') return val
  if (val instanceof Date) return val.toISOString()
  return new Date(val).toISOString()
}

// 1. Contas
export function rowToAccount(row: Tables<'accounts'>): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Account['type'],
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

export function accountToRow(item: Partial<Account>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name ?? '',
    type: item.type ?? 'checking',
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

export function accountToUpdateRow(changes: Partial<Account>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.name !== undefined) row.name = changes.name
  if (changes.type !== undefined) row.type = changes.type
  if (changes.initialBalance !== undefined) row.initial_balance = changes.initialBalance
  if (changes.creditLimit !== undefined) row.credit_limit = changes.creditLimit
  if (changes.statementClosingDay !== undefined) row.statement_closing_day = changes.statementClosingDay
  if (changes.paymentDueDay !== undefined) row.payment_due_day = changes.paymentDueDay
  if (changes.color !== undefined) row.color = changes.color
  if (changes.icon !== undefined) row.icon = changes.icon
  if (changes.isActive !== undefined) row.is_active = changes.isActive
  return row
}

// 2. Grupos de Categorias
export function rowToCategoryGroup(row: Tables<'category_groups'>): CategoryGroup {
  return {
    id: row.id,
    name: row.name,
    type: (row.type as CategoryGroup['type']) || undefined,
    sortOrder: Number(row.sort_order ?? 0),
    isHidden: Boolean(row.is_hidden),
    isSystem: Boolean(row.is_system),
  }
}

export function categoryGroupToRow(item: Partial<CategoryGroup>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name ?? '',
    type: item.type || null,
    sort_order: item.sortOrder ?? 0,
    is_hidden: item.isHidden ?? false,
    is_system: item.isSystem ?? false,
    created_at: now,
    updated_at: now,
  }
}

export function categoryGroupToUpdateRow(changes: Partial<CategoryGroup>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.name !== undefined) row.name = changes.name
  if (changes.type !== undefined) row.type = changes.type || null
  if (changes.sortOrder !== undefined) row.sort_order = changes.sortOrder
  if (changes.isHidden !== undefined) row.is_hidden = changes.isHidden
  if (changes.isSystem !== undefined) row.is_system = changes.isSystem
  return row
}

// 3. Categorias
export function rowToCategory(row: Tables<'categories'>): Category {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    sortOrder: Number(row.sort_order ?? 0),
    isHidden: Boolean(row.is_hidden),
  }
}

export function categoryToRow(item: Partial<Category>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    group_id: item.groupId ?? '',
    name: item.name ?? '',
    sort_order: item.sortOrder ?? 0,
    is_hidden: item.isHidden ?? false,
    created_at: now,
    updated_at: now,
  }
}

export function categoryToUpdateRow(changes: Partial<Category>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.groupId !== undefined) row.group_id = changes.groupId
  if (changes.name !== undefined) row.name = changes.name
  if (changes.sortOrder !== undefined) row.sort_order = changes.sortOrder
  if (changes.isHidden !== undefined) row.is_hidden = changes.isHidden
  return row
}

// 4. Orçamento Mensal
export function rowToBudgetMonth(row: Tables<'budget_months'>): BudgetMonth {
  return {
    id: row.id,
    month: row.month,
    categoryId: row.category_id,
    budgeted: Number(row.budgeted ?? 0),
    activity: Number(row.activity ?? 0),
    available: Number(row.available ?? 0),
  }
}

export function budgetMonthToRow(item: Partial<BudgetMonth>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    month: item.month ?? '',
    category_id: item.categoryId ?? '',
    budgeted: item.budgeted ?? 0,
    activity: item.activity ?? 0,
    available: item.available ?? 0,
    created_at: now,
    updated_at: now,
  }
}

export function budgetMonthToUpdateRow(changes: Partial<BudgetMonth>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.month !== undefined) row.month = changes.month
  if (changes.categoryId !== undefined) row.category_id = changes.categoryId
  if (changes.budgeted !== undefined) row.budgeted = changes.budgeted
  if (changes.activity !== undefined) row.activity = changes.activity
  if (changes.available !== undefined) row.available = changes.available
  return row
}

// 5. Transações
export function rowToTransaction(row: Tables<'transactions'>): Transaction {
  const rawNotes = row.notes || ''
  const splitMatch = rawNotes.match(/\[split:([a-zA-Z0-9_-]+)\]/)
  const splitGroupId = row.split_group_id || (splitMatch ? splitMatch[1] : undefined)
  const cleanNotes = rawNotes.replace(/\s*\[split:[a-zA-Z0-9_-]+\]/, '').trim()

  return {
    id: row.id,
    accountId: row.account_id,
    date: toDate(row.date) || new Date(),
    amount: Number(row.amount),
    payee: row.payee || '',
    categoryId: row.category_id || undefined,
    notes: cleanNotes || undefined,
    cleared: Boolean(row.cleared),
    type: (row.type as Transaction['type']) || 'expense',
    transferAccountId: row.transfer_account_id || undefined,
    transferTransactionId: row.transfer_transaction_id || undefined,
    installmentGroupId: row.installment_group_id || undefined,
    installmentNumber: row.installment_number ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    splitGroupId,
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function transactionToRow(item: Partial<Transaction>): Record<string, unknown> {
  const now = new Date().toISOString()
  let finalNotes = item.notes || null

  // Adiciona a tag oculta [split:ID] nas notes se tiver splitGroupId para garantir persistência mesmo sem coluna
  if (item.splitGroupId) {
    const splitTag = `[split:${item.splitGroupId}]`
    if (!finalNotes) {
      finalNotes = splitTag
    } else if (!finalNotes.includes(splitTag)) {
      finalNotes = `${finalNotes} ${splitTag}`
    }
  }

  return {
    ...(item.id ? { id: item.id } : {}),
    account_id: item.accountId ?? '',
    date: toIso(item.date) || now,
    amount: item.amount ?? 0,
    payee: item.payee || '',
    category_id: item.categoryId || null,
    notes: finalNotes,
    cleared: item.cleared ?? false,
    type: item.type || 'expense',
    transfer_account_id: item.transferAccountId || null,
    transfer_transaction_id: item.transferTransactionId || null,
    installment_group_id: item.installmentGroupId || null,
    installment_number: item.installmentNumber ?? null,
    installment_total: item.installmentTotal ?? null,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

export function transactionToUpdateRow(changes: Partial<Transaction>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.accountId !== undefined) row.account_id = changes.accountId
  if (changes.date !== undefined) row.date = toIso(changes.date)
  if (changes.amount !== undefined) row.amount = changes.amount
  if (changes.payee !== undefined) row.payee = changes.payee
  if (changes.categoryId !== undefined) row.category_id = changes.categoryId || null
  if (changes.notes !== undefined || changes.splitGroupId !== undefined) {
    let notes = changes.notes !== undefined ? (changes.notes || null) : null
    if (changes.splitGroupId) {
      const splitTag = `[split:${changes.splitGroupId}]`
      if (!notes) notes = splitTag
      else if (!notes.includes(splitTag)) notes = `${notes} ${splitTag}`
    }
    if (notes !== null || changes.notes !== undefined) {
      row.notes = notes
    }
  }
  if (changes.cleared !== undefined) row.cleared = changes.cleared
  if (changes.type !== undefined) row.type = changes.type
  if (changes.transferAccountId !== undefined) row.transfer_account_id = changes.transferAccountId || null
  if (changes.transferTransactionId !== undefined) row.transfer_transaction_id = changes.transferTransactionId || null
  if (changes.installmentGroupId !== undefined) row.installment_group_id = changes.installmentGroupId || null
  if (changes.installmentNumber !== undefined) row.installment_number = changes.installmentNumber ?? null
  if (changes.installmentTotal !== undefined) row.installment_total = changes.installmentTotal ?? null
  return row
}

// 6. Grupos de Parcelamento
export function rowToInstallmentGroup(row: Tables<'installment_groups'>): InstallmentGroup {
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

export function installmentGroupToRow(item: Partial<InstallmentGroup>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    description: item.description ?? '',
    total_amount: item.totalAmount ?? 0,
    installment_count: item.installmentCount ?? 1,
    installment_amount: item.installmentAmount ?? 0,
    start_date: toIso(item.startDate) || now,
    account_id: item.accountId ?? '',
    category_id: item.categoryId || null,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

export function installmentGroupToUpdateRow(changes: Partial<InstallmentGroup>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.description !== undefined) row.description = changes.description
  if (changes.totalAmount !== undefined) row.total_amount = changes.totalAmount
  if (changes.installmentCount !== undefined) row.installment_count = changes.installmentCount
  if (changes.installmentAmount !== undefined) row.installment_amount = changes.installmentAmount
  if (changes.startDate !== undefined) row.start_date = toIso(changes.startDate)
  if (changes.accountId !== undefined) row.account_id = changes.accountId
  if (changes.categoryId !== undefined) row.category_id = changes.categoryId || null
  return row
}

// 7. Beneficiários (Payees)
export function rowToPayee(row: Tables<'payees'>): Payee {
  return {
    id: row.id,
    name: row.name,
    defaultCategoryId: row.default_category_id || undefined,
  }
}

export function payeeToRow(item: Partial<Payee>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name ?? '',
    default_category_id: item.defaultCategoryId || null,
    created_at: now,
    updated_at: now,
  }
}

export function payeeToUpdateRow(changes: Partial<Payee>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.name !== undefined) row.name = changes.name
  if (changes.defaultCategoryId !== undefined) row.default_category_id = changes.defaultCategoryId || null
  return row
}

// 9. Contas de Cobrança / Terceiros
export function rowToDebtAccount(row: Tables<'debt_accounts'>): DebtAccount {
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

export function debtAccountToRow(item: Partial<DebtAccount>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    name: item.name ?? '',
    phone: item.phone || null,
    notes: item.notes || null,
    color: item.color || '#6366f1',
    is_active: item.isActive ?? true,
    created_at: toIso(item.createdAt) || now,
    updated_at: now,
  }
}

export function debtAccountToUpdateRow(changes: Partial<DebtAccount>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.name !== undefined) row.name = changes.name
  if (changes.phone !== undefined) row.phone = changes.phone || null
  if (changes.notes !== undefined) row.notes = changes.notes || null
  if (changes.color !== undefined) row.color = changes.color
  if (changes.isActive !== undefined) row.is_active = changes.isActive
  return row
}

// 10. Itens de Cobrança / Pendências
export function rowToDebtItem(row: Tables<'debt_items'>): DebtItem {
  return {
    id: row.id,
    debtAccountId: row.debt_account_id,
    description: row.description,
    type: (row.type as DebtItem['type']) || 'receivable',
    amount: Number(row.amount),
    dueDate: toDate(row.due_date),
    settledDate: toDate(row.settled_date),
    status: (row.status as DebtItem['status']) || 'pending',
    notes: row.notes || undefined,
    installmentGroupId: row.installment_group_id || undefined,
    installmentNumber: row.installment_number ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    totalAmount: row.total_amount != null ? Number(row.total_amount) : undefined,
    createdAt: toDate(row.created_at) || new Date(),
  }
}

export function debtItemToRow(item: Partial<DebtItem>): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    ...(item.id ? { id: item.id } : {}),
    debt_account_id: item.debtAccountId ?? '',
    description: item.description ?? '',
    type: item.type || 'receivable',
    amount: item.amount ?? 0,
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

export function debtItemToUpdateRow(changes: Partial<DebtItem>): Record<string, unknown> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (changes.debtAccountId !== undefined) row.debt_account_id = changes.debtAccountId
  if (changes.description !== undefined) row.description = changes.description.trim()
  if (changes.type !== undefined) row.type = changes.type
  if (changes.amount !== undefined) row.amount = changes.amount
  if (changes.dueDate !== undefined) row.due_date = toIso(changes.dueDate)
  if (changes.settledDate !== undefined) row.settled_date = toIso(changes.settledDate)
  if (changes.status !== undefined) row.status = changes.status
  if (changes.notes !== undefined) row.notes = changes.notes || null
  if (changes.installmentGroupId !== undefined) row.installment_group_id = changes.installmentGroupId || null
  if (changes.installmentNumber !== undefined) row.installment_number = changes.installmentNumber ?? null
  if (changes.installmentTotal !== undefined) row.installment_total = changes.installmentTotal ?? null
  if (changes.totalAmount !== undefined) row.total_amount = changes.totalAmount != null ? changes.totalAmount : null
  return row
}
