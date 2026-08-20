import { getClient } from './client'
import { rowToAccount, accountToRow, accountToUpdateRow } from './types'
import { createId } from '@/utils/id'
import { notifyDataChanged } from './events'
import type { Account, AccountType } from '@/types'

export async function getAccounts(): Promise<Account[]> {
  const client = getClient()
  const { data, error } = await client
    .from('accounts')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(`Erro ao buscar contas: ${error.message}`)
  return (data || []).map(rowToAccount)
}

export async function getAccountById(id: string): Promise<Account | undefined> {
  const client = getClient()
  const { data, error } = await client
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar conta: ${error.message}`)
  return data ? rowToAccount(data) : undefined
}

export async function createAccount(data: {
  name: string
  type: AccountType
  initialBalance: number
  creditLimit?: number
  statementClosingDay?: number
  paymentDueDay?: number
  color: string
  icon: string
  isActive?: boolean
}): Promise<string> {
  const client = getClient()
  const id = createId()
  const row = accountToRow({
    id,
    ...data,
    isActive: data.isActive ?? true,
    createdAt: new Date(),
  })

  const { error } = await client.from('accounts').insert(row)
  if (error) throw new Error(`Erro ao criar conta: ${error.message}`)
  notifyDataChanged('accounts', 'insert', id)
  return id
}

export async function updateAccount(id: string, changes: Partial<Account>): Promise<void> {
  const client = getClient()
  const row = accountToUpdateRow(changes)

  const { error } = await client.from('accounts').update(row).eq('id', id)
  if (error) throw new Error(`Erro ao atualizar conta: ${error.message}`)
  notifyDataChanged('accounts', 'update', id)
}

export async function deleteAccount(id: string): Promise<void> {
  const client = getClient()
  // Deleta transações vinculadas primeiro
  await client.from('transactions').delete().or(`account_id.eq.${id},transfer_account_id.eq.${id}`)
  await client.from('scheduled_transactions').delete().or(`account_id.eq.${id},transfer_account_id.eq.${id}`)
  await client.from('installment_groups').delete().eq('account_id', id)

  const { error } = await client.from('accounts').delete().eq('id', id)
  if (error) throw new Error(`Erro ao excluir conta: ${error.message}`)
  notifyDataChanged('accounts', 'delete', id)
  notifyDataChanged('transactions', 'delete')
}

/**
 * Calcula o saldo atual de uma conta baseado no initialBalance + transações
 */
export async function calculateAccountBalance(accountId: string): Promise<number> {
  const client = getClient()
  const [accRes, directTxsRes, incomingTransfersRes] = await Promise.all([
    client.from('accounts').select('type, initial_balance').eq('id', accountId).maybeSingle(),
    client.from('transactions').select('type, amount').eq('account_id', accountId),
    client.from('transactions').select('type, amount').eq('transfer_account_id', accountId).eq('type', 'transfer'),
  ])

  if (!accRes.data) return 0
  const account = accRes.data
  let balance = Number(account.initial_balance || 0)

  // 1. Transações diretas da conta de origem
  for (const tx of directTxsRes.data || []) {
    const amount = Number(tx.amount || 0)
    if (account.type === 'credit_card') {
      // No cartão: despesas aumentam a dívida (-), pagamentos/receitas diminuem a dívida (+)
      if (tx.type === 'expense') balance -= amount
      else if (tx.type === 'income' || tx.type === 'transfer') balance += amount
    } else {
      // Conta corrente / investimentos
      if (tx.type === 'income') balance += amount
      else if (tx.type === 'expense' || tx.type === 'transfer') balance -= amount
    }
  }

  // 2. Transferências recebidas (onde esta conta é o destino)
  for (const tx of incomingTransfersRes.data || []) {
    const amount = Number(tx.amount || 0)
    if (account.type === 'credit_card') {
      balance += amount
    } else {
      balance += amount
    }
  }

  return balance
}

export async function getAccountsSummary(): Promise<{
  totalBudget: number
  totalCreditCardDebt: number
  netWorth: number
}> {
  const client = getClient()
  const { data: accounts } = await client.from('accounts').select('*').eq('is_active', true)
  if (!accounts) return { totalBudget: 0, totalCreditCardDebt: 0, netWorth: 0 }

  let totalBudget = 0
  let totalCreditCardDebt = 0

  for (const acc of accounts) {
    const balance = await calculateAccountBalance(acc.id)
    if (acc.type === 'checking') {
      totalBudget += balance
    } else if (acc.type === 'credit_card') {
      totalCreditCardDebt += balance
    } else if (acc.type === 'off_budget') {
      totalBudget += balance
    }
  }

  return {
    totalBudget,
    totalCreditCardDebt,
    netWorth: totalBudget + totalCreditCardDebt,
  }
}
