# Diretrizes do Projeto - Reutilizacao e Atomic Design

## 1. Principio Fundamental: Reuse First e Composicao Atomica
- Sempre preferir reutilizar, estender e compor componentes existentes antes de criar novos arquivos ou duplicar marcacao JSX ou HTML.
- Seguir a hierarquia do Atomic Design: atoms -> molecules -> organisms -> templates -> pages.
- Paginas (src/components/pages/) devem apenas orquestrar componentes, evitando elementos visuais ou de formularios inline duplicados.

## 2. Camadas do Atomic Design e Catalogo de Reutilizacao

### Atomos (src/components/atoms/)
Elementos indivisiveis de interface e inputs base.
- Logo.tsx: Identidade visual, emblema com gradiente e tipografia da marca.
- PriceInput.tsx: Input numerico de moeda formatado em BRL com centavos dinamicos.
- ColorPicker.tsx: Seletor de cores predefinidas, conta-gotas e input HEX.
- Badge.tsx: Pilula de status com variantes (success, danger, warning, info, violet, neutral).
- MonthNavigator.tsx: Navegador padronizado de meses.
- SearchBar.tsx: Campo de busca integrado com icone e autoFocus.
Regra: Antes de criar um input ou elemento basico, use ou adicione uma propriedade ou variante em um atomo existente.

### Moleculas (src/components/molecules/)
Combinacoes de atomos formando blocos funcionais e itens de lista.
- TransactionItem.tsx: Linha de lancamento com badge de parcelas e exibicao do valor total.
- CreditCardPurchaseItem.tsx: Linha de compra consolidada de cartao de credito.
- InvoiceCycleNavigator.tsx: Navegador de faturas com status dinamico.
Regra: Toda exibicao de transacao, compra ou ciclo deve usar as moleculas existentes em vez de reimplementar a marcacao.

### Organismos (src/components/organisms/)
Componentes complexos, modais de historico, graficos e formularios com regras de negocio.
- AccountForm.tsx: Formulario e bottom-sheet de criacao e edicao de contas e cartao.
- TransactionForm.tsx: Formulario de despesas, receitas, transferencias e compras parceladas.
- ScheduledForm.tsx: Formulario de transacoes agendadas e recorrentes.
- InvoicePrintModal.tsx / DebtPrintModal.tsx: Modais de visualizacao e impressao PDF de faturas e acertos.
- NetWorthChartCard.tsx: Card de evolucao historica de patrimonio liquido com SVG responsivo.
Regra: Formularios devem aceitar props opcionais (defaultValues, mode, callbacks) para suportar multiplos fluxos sem duplicacao de modal.

### Templates (src/components/templates/)
Esqueletos de layout e cascas estruturais.
- Layout.tsx: Layout principal com sidebar no desktop, bottom nav no mobile e safe areas.

### Paginas (src/components/pages/)
Views completas mapeadas para rotas da aplicacao.
- BudgetPage.tsx, AccountsPage.tsx, AccountDetailPage.tsx, AccountInvoicePage.tsx, TransactionsPage.tsx, ScheduledPage.tsx, ReportsPage.tsx, SettingsPage.tsx.

## 3. Fluxo de Decisao para Novas Funcionalidades
1. Identificar a camada correta: Determinar se a nova funcionalidade e Atomo, Molecula, Organismo ou Template.
2. Verificar se ja existe: Buscar o componente equivalente em src/components/{atoms|molecules|organisms|templates}/.
3. Estender com Props: Adicionar propriedades opcionais, configuracoes de visualizacao ou callbacks sem quebrar os usos existentes.
4. Decomposicao: Se um organismo ou molecula estiver acumulando responsabilidades demais, extraia atomos ou moleculas reutilizaveis na camada inferior.
5. Consistencia de Design: Preservar o padrao visual (tema escuro em slate, safe-area padding em mobile, feedback interativo ativo e hover).

## 4. Versionamento da Aplicacao
- A cada novo commit, ajuste ou entrega de funcionalidade/correcao, o agente DEVE atualizar o arquivo `src/version.ts`, incrementando a versao (`APP_VERSION`, ex: `1.0.14`) e a data da alteracao (`BUILD_DATE`).
- A versao e exibida dinamicamente no card de informacoes do aplicativo na pagina de Configuracoes (`SettingsPage.tsx`).

