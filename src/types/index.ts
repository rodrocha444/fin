// src/types/index.ts
// ─────────────────────────────────────────────────────────────
// Tipos globais compartilhados por toda a aplicação
// ─────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'credit_card' | 'off_budget'

export interface Account {
  id?: string
  name: string
  type: AccountType
  /** Saldo inicial (para contas não-cartão) */
  initialBalance: number
  /** Apenas para credit_card: limite de crédito */
  creditLimit?: number
  /** Apenas para credit_card: dia de fechamento da fatura */
  statementClosingDay?: number
  /** Apenas para credit_card: dia de vencimento da fatura */
  paymentDueDay?: number
  color: string
  icon: string
  isActive: boolean
  createdAt: Date
}

// ── Categorias ──────────────────────────────────────────────

export interface CategoryGroup {
  id?: string
  name: string
  type?: 'expense' | 'income'
  sortOrder: number
  isHidden: boolean
  isSystem: boolean // grupos do sistema (ex: Renda, Cartão de Crédito)
}

export interface Category {
  id?: string
  groupId: string
  name: string
  sortOrder: number
  isHidden: boolean
}

// ── Orçamento Mensal ─────────────────────────────────────────

export type BudgetType = 'cash' | 'accrual'

export interface BudgetMonth {
  id?: string
  /** Formato: YYYY-MM */
  month: string
  categoryId: string
  /** Tipo de regime orçamentário: 'cash' (caixa/faturas) ou 'accrual' (competência/data da compra) */
  budgetType?: BudgetType
  /** Valor orçado pelo usuário naquele mês */
  budgeted: number
  /** Calculado: soma das transações do mês nessa categoria */
  activity: number
  /** Calculado: budgeted - activity (sem rollover) */
  available: number
}

// ── Transações ──────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id?: string
  accountId: string
  date: Date
  /** Positivo sempre. O sinal é determinado pelo type */
  amount: number
  payee: string
  categoryId?: string
  notes?: string
  /** Reconciliada/compensada no banco */
  cleared: boolean
  type: TransactionType
  /** Para transfers: id da conta destino */
  transferAccountId?: string
  /** Para identificar a transferência par (payment de cartão) */
  transferTransactionId?: string
  /** Se essa transação faz parte de um grupo de parcelamento */
  installmentGroupId?: string
  installmentNumber?: number
  installmentTotal?: number
  /** Se essa transação faz parte de uma divisão de categorias (split) */
  splitGroupId?: string
  createdAt: Date
}

// ── Grupo de Parcelamento ────────────────────────────────────

export interface InstallmentGroup {
  id?: string
  description: string
  /** Valor total da compra */
  totalAmount: number
  installmentCount: number
  /** Valor de cada parcela (pode ser arredondado) */
  installmentAmount: number
  startDate: Date
  accountId: string
  categoryId?: string
  createdAt: Date
}

// ── Payees ───────────────────────────────────────────────────

export interface Payee {
  id?: string
  name: string
  defaultCategoryId?: string
}

// ── Helpers de cálculo ───────────────────────────────────────

export interface BudgetSummary {
  month: string
  /** Se o mês selecionado é um mês futuro em relação ao mês atual */
  isFutureMonth?: boolean
  /** Sobra projetada vinda do mês anterior no planejamento de meses futuros */
  rolloverFromPreviousMonth?: number
  /** Renda total já recebida no mês selecionado */
  totalIncome: number
  /** Renda total prevista/orçada no mês selecionado */
  totalExpectedIncome?: number
  /** Renda prevista que ainda falta entrar no mês */
  pendingExpectedIncome?: number
  /** Total orçado nas categorias de despesa no mês selecionado */
  totalBudgeted: number
  /** Total gasto efetivo em despesas no mês selecionado */
  totalSpent?: number
  /** Faturas de cartão com vencimento no mês selecionado */
  currentInvoicesDue?: number
  /** Quanto ainda está disponível para ser orçado no mês (saldo em caixa ou projetado) */
  toBeBudgeted: number
  /** Saldo projetado a orçar considerando as receitas previstas restantes */
  projectedToBeBudgeted: number
  /** Resultado planejado/econômico (Receita Prevista - Despesa Orçada) */
  plannedNetResult?: number
  /** Resultado real operacional (Receita Real - Despesa Real) */
  actualNetResult?: number
}

export interface CategoryBudgetRow {
  category: Category
  budgeted: number
  activity: number
  available: number
}

export interface GroupBudgetRow {
  group: CategoryGroup
  categories: CategoryBudgetRow[]
  totalBudgeted: number
  totalActivity: number
  totalAvailable: number
}

export interface IncomeCategoryBudgetRow {
  category: Category
  expected: number
  received: number
  difference: number
}

export interface IncomeGroupBudgetRow {
  group: CategoryGroup
  categories: IncomeCategoryBudgetRow[]
  totalExpected: number
  totalReceived: number
  totalDifference: number
}

// ── Tipos de Pendências e Regras do Sistema ──────────────────

export type IssueSeverity = 'warning' | 'error' | 'info'

export interface PendingIssueItem {
  id: string
  title: string
  subtitle?: string
  amount?: number
  type?: string
  data?: any
}

export interface PendingIssue {
  id: string
  ruleId: string
  title: string
  description: string
  severity: IssueSeverity
  count: number
  items?: PendingIssueItem[]
}

// ── Contas a Receber / Pagar (Cobranças e Dívidas) ─────────────

export type DebtType = 'receivable' | 'payable'
export type DebtStatus = 'pending' | 'settled' | 'cancelled'

export interface DebtItemChange {
  id: string
  debtItemId: string
  previousAmount: number
  newAmount: number
  changedAt: Date
  notes?: string
}

export interface DebtAccount {
  id?: string
  name: string
  phone?: string
  notes?: string
  color?: string
  isActive: boolean
  createdAt: Date
}

export interface DebtItem {
  id?: string
  debtAccountId: string
  description: string
  type: DebtType
  amount: number
  dueDate?: Date
  settledDate?: Date
  status: DebtStatus
  notes?: string
  installmentGroupId?: string
  installmentNumber?: number
  installmentTotal?: number
  totalAmount?: number
  createdAt: Date
  changes?: DebtItemChange[]
}

export interface DebtSummary {
  totalReceivable: number
  totalPayable: number
  netBalance: number
  pendingCount: number
}

