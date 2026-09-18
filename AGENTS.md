# Diretrizes & Regras para Agentes

## 1. Comunicação & Eficiência de Tokens
- **Objetividade Extrema:** Respostas diretas ao ponto, sem preâmbulos ("Com certeza...", "Entendido..."), sem enrolação ou repetições de código não modificado.
- **Alta Densidade de Informação:** Foque no que foi feito, decisões de arquitetura e arquivos alterados, sem omitir detalhes técnicos críticos.

## 2. Mapa do Código (`src/`)
- `types/index.ts`: Tipos TypeScript compartilhados (`Account`, `Transaction`, `Category`, `BudgetMonth`, etc.).
- `services/api/`: Supabase e lógica pura contábil (`transactions.ts`, `budget.ts`, `accounts.ts`, `categories.ts`, `debts.ts`, `invoices.ts`, `issues.ts`, `types.ts`, `events.ts`).
- `hooks/`: TanStack Query v5 (`queries.ts`, `useBudget`, `useTransactions`, `useAccounts`, `useDebts`, etc.).
- `context/`: `ConfirmContext.tsx` (`useConfirm`, `useAlert`), `FinancialDataContext.tsx`.
- `utils/`: `format.ts` (moeda/datas), `invoices.ts` (ciclos de cartão), `accountingRegime.ts` (Caixa vs Competência).
- `components/`: Atomic Design (`atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/`).

## 3. Regras de Negócio (Orçamento Base Zero)
- **Contas On-Budget (`checking`, `credit_card`):** Compoem saldo operacional do orçamento.
- **Contas Off-Budget (`off_budget`):** Investimentos/patrimônio externo fora do orçamento.
- **Transferências:**
  - `On ➔ Off`: Saída do orçamento ➔ **Requer categoria de despesa** (debita atividade).
  - `Off ➔ On`: Entrada no orçamento ➔ **Requer categoria de renda** (soma ao disponível a orçar).
  - `On ➔ On` / `Off ➔ Off`: Movimentação interna ➔ **Sem categoria**.
- **Cartão de Crédito:** Compras abatem envelope de categoria; pagamento de fatura é transferência `checking ➔ credit_card` sem categoria.

## 4. Padrões de Código e UI
- **UI:** Tema escuro OLED/Preto (`bg-slate-950`/`bg-slate-900` em `#000000`, `border-slate-800`), safe-area mobile (`env(safe-area-inset-top/bottom)`).
- **Modais:** Exclusivamente `useConfirm()` e `useAlert()` de `@/context/ConfirmContext` (nunca `window.confirm`/`alert`).
- **Reatividade:** Disparar `notifyDataChanged(...)` em mutations de `services/api/`.

## 5. Versionamento & Entrega
1. **Validação:** Rodar `npm run lint` e `npm run build`.
2. **Versão:** Incrementar `APP_VERSION` e atualizar `BUILD_DATE` em `src/version.ts`.
3. **Git:** Commits locais permitidos após validação. **`git push` é estritamente proibido** sem ordem textual explícita do usuário.