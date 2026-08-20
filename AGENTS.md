## 1. Arquitetura e Atomic Design (Reuse First)
Sempre reutilize ou estenda componentes existentes antes de criar novos arquivos ou duplicar JSX. Páginas (`src/components/pages/`) apenas orquestram componentes.

- **Átomos (`src/components/atoms/`):** Elementos indivisíveis e inputs base. Estenda variantes existentes.
- **Moléculas (`src/components/molecules/`):** Combinações funcionais e itens de lista.
- **Organismos (`src/components/organisms/`):** Modais, gráficos e formulários complexos. Devem ser genéricos e aceitar props opcionais (`mode`, `defaultValues`, `callbacks`) para evitar modais duplicados.
- **Templates (`src/components/templates/`):** Estruturas de layout e cascas responsivas.
- **Páginas (`src/components/pages/`):** Views mapeadas diretamente para as rotas.

> **Regra de Design:** Mantenha consistência visual (tema escuro em slate, safe-area padding em mobile e estados de hover/active).

## 2. Versionamento e Entrega
A cada nova funcionalidade, correção ou ajuste entregue:
1. Valide a integridade do código (`npm run lint` e `npm run build`).
2. Atualize `src/version.ts` incrementando `APP_VERSION` (ex: `1.0.14`) e `BUILD_DATE`.

## 3. Política de Git
- **Commits Locais (`git commit`):** Permitidos automaticamente após a validação e o incremento de versão.
- **Envio Remoto (`git push`):** Proibido sem comando textual explícito do usuário (ex: "suba pro github", "faça o push").