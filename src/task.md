# Tarefas do Projeto FinPlan

## 1. Migração TanStack Query & Supabase TypeGen
- [x] Criação de `src/types/database.types.ts` mapeando todas as tabelas Supabase com tipagem estrita
- [x] Instalação de `@tanstack/react-query` v5 e `@tanstack/react-query-devtools`
- [x] Centralização de hooks de dados em `src/hooks/queries.ts` e refatoração de `FinancialDataContext.tsx`
- [x] Remoção de polling manual do Dexie e eliminação da pasta `src/db/repositories/`

## 2. Transações Divididas (Splits) e Agrupamento
- [x] Suporte híbrido a `split_group_id` (persistência transparente via tag `[split:UUID]` no campo `notes`)
- [x] Agrupamento consolidado de transações divididas no Histórico Geral e Detalhe da Conta Corrente
- [x] Edição de qualquer parte da transação dividida abre o formulário completo com todas as fatias

## 3. Modais e Diálogos Personalizados (Eliminação de Nativos)
- [x] Criação do átomo base `src/components/atoms/Modal.tsx`
- [x] Criação do contexto global `src/context/ConfirmContext.tsx` fornecendo `useConfirm()` e `useAlert()`
- [x] Substituição de 100% das chamadas nativas de `confirm()` e `alert()`

## 4. Início do Período Contábil com Confirmação de 10s
- [x] Suporte a `countdownSeconds` em `src/context/ConfirmContext.tsx` com timer regressivo e barra de progresso visual
- [x] Criação de `src/utils/accountingPeriod.ts` com helpers de data e persistência local
- [x] Integração nos cálculos de resumo e sobras em `src/services/api/budget.ts`
- [x] Interface com badge de status, input de data e botões protegidos em `src/components/pages/SettingsPage.tsx`

## 5. Reformulação Completa da Página de Relatórios
- [x] Criação do átomo `src/components/atoms/PieChart.tsx` (gráfico Pizza/Donut em SVG puro de alta precisão com hover e tooltips)
- [x] Criação da molécula `src/components/molecules/CategoryPieCard.tsx` (card interativo com lista de categorias, checkboxes check/uncheck, botões marcar/desmarcar todas, busca e percentuais)
- [x] Criação do organismo `src/components/organisms/AdvancedFinancialChart.tsx` (gráfico avançado estilo plataforma de corretora/trading com ticker de cotação, modos Área/Ativos vs Passivos/Fluxo Mensal, Média Móvel SMA, Linhas Máx/Mín, Timeframes 1M/3M/6M/1A/YTD/Tudo/Data e Crosshair HUD)
- [x] Reformulação da página `src/components/pages/ReportsPage.tsx` com seletor de mês global, KPIs principais, grid de duas pizzas (Despesas e Receitas) e gráfico de corretora
- [x] Remoção do componente legado `NetWorthChartCard.tsx` (zero código morto)

## 6. Segmentação e Projeção Futura no Gráfico de Evolução
- [x] Computação granular de saldos históricos individuais de contas bancárias, cartões, contas a receber e contas a pagar em `src/hooks/useNetWorthHistory.ts`
- [x] Suporte a faturas e parcelas futuras em todos os filtros e segmentos
- [x] Novos presets de projeção (`+3M`, `+6M`, `Tudo com Futuro`) e botão toggle `+Futuro`
- [x] Linha divisória visual com marcador `HOJE` no gráfico SVG e badge `PROJEÇÃO FUTURA` no Crosshair HUD
- [x] Limite de amostragem de dados e otimização de performance

## 7. Otimização Mobile-First do Gráfico Financeiro
- [x] Suporte a gestos touch nativos (`onTouchStart`, `onTouchMove`, `onTouchEnd`) com `touch-action: none` para deslizar o polegar com precisão
- [x] HUD ancorado e responsivo no topo do canvas, evitando que o dedo tampe os dados sob inspeção
- [x] Amplitude vertical aprimorada no SVG e eixos Y e X com formatação compacta (`R$ 15k`, `R$ 2,5k`)
- [x] Scroll horizontal suave nos seletores de escopo e botões táteis

## 8. Alinhamento de Patrimônio Líquido entre Telas
- [x] Inclusão de `useDebtsSummary()` no card de Patrimônio Líquido de `ReportsPage.tsx` para somar `Contas Bancárias + Cartões + Cobranças a Receber - Dívidas a Pagar`
- [x] Total alinhamento contábil (100% de paridade de valor) entre a Página de Contas, o card de Relatórios e o Gráfico de Evolução

## 9. Sincronização em Nuvem do Período Contábil (Multi-Dispositivos)
- [x] Persistência automática do Início Contábil no Supabase via `syncAccountingStartDateWithRemote`
- [x] Sincronização automática bi-direcional entre Desktop, Celulares e PWA
- [x] Autovalidação com `npm run lint` e `npm run build` (0 erros)
- [x] Versão incrementada para `v2.8.3` em `src/version.ts` e commit local realizado
