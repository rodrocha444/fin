# Diretrizes do Projeto & Guia para Agentes

## 1. Mapa de Estrutura do Código (`src/`)

- **`types/index.ts`**: Tipos TypeScript globais compartilhados (`Account`, `Transaction`, `Category`, `BudgetMonth`, etc.).
- **`services/api/`**: Camada Supabase e lógica contábil/orçamentária pura:
  - `transactions.ts`: CRUD de transações avulsas, compras parceladas (`installment_groups`), rateios (`splits`) e transferências.
  - `budget.ts`: Cálculos puros de orçamento, atividade de despesa, metas de receita e disponível a orçar (*To Be Budgeted*).
  - `accounts.ts`: CRUD e cálculo de saldos de contas.
  - `categories.ts`: CRUD de categorias e grupos de categorias.
  - `debts.ts`: CRUD e totalizadores de dívidas/cobranças (contas a pagar/receber).
  - `invoices.ts`: Registro de status de pagamento de faturas de cartão.
  - `issues.ts`: Detecção de pendências (categorias estouradas, lançamentos sem categoria).
  - `types.ts`: Conversores snake_case (Supabase) ⇄ camelCase (TypeScript).
  - `events.ts`: Eventos locais de notificação para invalidação de cache/sync.
- **`hooks/`**: Hooks reativos com TanStack Query v5:
  - `queries.ts`: Hooks base (`useAccountsQuery`, `useTransactionsQuery`, etc.).
  - `useBudget.ts`, `useTransactions.ts`, `useAccounts.ts`, `useDebts.ts`, `usePendingIssues.ts`, `useNetWorthHistory.ts`.
- **`context/`**:
  - `ConfirmContext.tsx`: Modais globais de confirmação (`useConfirm`) e alerta (`useAlert`) — *nunca use window.confirm/alert*.
  - `FinancialDataContext.tsx`: Cache consolidado para acesso síncrono rápido.
- **`utils/`**:
  - `format.ts`: Formatação de moeda BRL (`formatCurrency`), datas e ordenação.
  - `invoices.ts`: Ciclos de fatura de cartão (fechamento, vencimento, competência de parcelas).
  - `accountingRegime.ts`: Cálculos de relatórios por Regime de Caixa e Competência.
  - `accountingPeriod.ts`: Trava de data/mês de início contábil.
- **`components/` (Atomic Design - Reuse First):**
  - `atoms/`: Elementos base (`PriceInput`, `MonthNavigator`, `Badge`, `Modal`, `SyncStatusBadge`).
  - `molecules/`: Linhas e cards de lista (`TransactionItem`, `CreditCardPurchaseItem`, etc.).
  - `organisms/`: Formulários e modais complexos (`TransactionForm`, `AccountForm`, `CategoryTransactionsModal`, `PendingIssuesCard`, `AdvancedFinancialChart`).
  - `templates/`: Cascas de layout responsivo.
  - `pages/`: Views mapeadas para as rotas (`BudgetPage`, `TransactionsPage`, `AccountsPage`, `AccountDetailPage`, `ReportsPage`, `DebtAccountPage`, `SettingsPage`).

---

## 2. Regras de Negócio Críticas (Orçamento Base Zero)

1. **Tipos de Contas:**
   - `checking` e `credit_card`: **On-Budget** (formam o saldo base do orçamento).
   - `off_budget`: **Off-Budget / Tracking** (investimentos e patrimônio externo).
2. **Regras de Transferência:**
   - **On-Budget ➔ Off-Budget:** Saída de recursos do orçamento. **Exige categoria de despesa** (debita como atividade na categoria).
   - **Off-Budget ➔ On-Budget:** Entrada de recursos no orçamento. **Exige categoria de renda** (aumenta o disponível a orçar).
   - **On ➔ On / Off ➔ Off:** Transferência interna. **Não requer categoria**.
3. **Cartões de Crédito:** Compras debitam do envelope da categoria; faturas fechadas são pagas via transferência On-Budget (`checking` ➔ `credit_card`) sem nova categoria.

---

## 3. Padrões de Código e UI

- **Consistência Visual:** Tema escuro Slate (`bg-slate-900`, `border-slate-800`, `text-slate-100`), suporte a safe-area padding em mobile PWA (`env(safe-area-inset-top/bottom)`).
- **Diálogos:** Use exclusivamente `const confirm = useConfirm()` e `const alert = useAlert()` de `@/context/ConfirmContext`.
- **Modificação de Dados:** Sempre dispare `notifyDataChanged(...)` nas mutations de `services/api/` para manter os hooks reativos sincronizados.

---

## 4. Versionamento e Entrega

A cada nova funcionalidade, correção ou ajuste entregue:
1. Valide a integridade: `npm run lint` (`oxlint`) e `npm run build` (`tsc -b && vite build`).
2. Atualize `src/version.ts`: incremente `APP_VERSION` (ex: `2.11.24`) e atualize `BUILD_DATE`.
3. **Git:** Commits locais (`git commit`) são permitidos após a validação. **Envio remoto (`git push`) é estritamente proibido** sem comando textual explícito do usuário.