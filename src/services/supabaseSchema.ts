// src/services/supabaseSchema.ts — Script SQL de criação das tabelas no Supabase

export const SUPABASE_SCHEMA_SQL = `-- ─────────────────────────────────────────────────────────────
-- FinPlan: Script de Estruturação do Banco no Supabase (PostgreSQL)
-- Cole este script no SQL Editor do seu projeto Supabase e clique em "Run"
-- ─────────────────────────────────────────────────────────────

-- 1. Contas Bancárias e Cartões
CREATE TABLE IF NOT EXISTS public.accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  credit_limit NUMERIC,
  statement_closing_day INTEGER,
  payment_due_day INTEGER,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'bank',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. Grupos de Categorias
CREATE TABLE IF NOT EXISTS public.category_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3. Categorias
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 4. Orçamento Mensal
CREATE TABLE IF NOT EXISTS public.budget_months (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL, -- Formato: YYYY-MM
  category_id TEXT NOT NULL,
  budgeted NUMERIC NOT NULL DEFAULT 0,
  activity NUMERIC NOT NULL DEFAULT 0,
  available NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 5. Transações
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  amount NUMERIC NOT NULL,
  payee TEXT NOT NULL DEFAULT '',
  category_id TEXT,
  notes TEXT,
  cleared BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'expense',
  transfer_account_id TEXT,
  transfer_transaction_id TEXT,
  installment_group_id TEXT,
  installment_number INTEGER,
  installment_total INTEGER,
  is_scheduled_projection BOOLEAN NOT NULL DEFAULT false,
  scheduled_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 6. Grupos de Parcelamento
CREATE TABLE IF NOT EXISTS public.installment_groups (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  installment_count INTEGER NOT NULL,
  installment_amount NUMERIC NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 7. Transações Agendadas
CREATE TABLE IF NOT EXISTS public.scheduled_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payee TEXT NOT NULL,
  category_id TEXT,
  type TEXT NOT NULL DEFAULT 'expense',
  transfer_account_id TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 8. Beneficiários (Payees)
CREATE TABLE IF NOT EXISTS public.payees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_category_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 9. Contas de Cobrança / Terceiros (Debts)
CREATE TABLE IF NOT EXISTS public.debt_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 10. Itens de Cobrança / Pendências
CREATE TABLE IF NOT EXISTS public.debt_items (
  id TEXT PRIMARY KEY,
  debt_account_id TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date TIMESTAMPTZ,
  settled_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  installment_group_id TEXT,
  installment_number INTEGER,
  installment_total INTEGER,
  total_amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ── Índices para busca rápida e sincronização incremental ──────
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON public.accounts(updated_at);
CREATE INDEX IF NOT EXISTS idx_category_groups_updated_at ON public.category_groups(updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_updated_at ON public.categories(updated_at);
CREATE INDEX IF NOT EXISTS idx_budget_months_updated_at ON public.budget_months(updated_at);
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON public.transactions(updated_at);
CREATE INDEX IF NOT EXISTS idx_installment_groups_updated_at ON public.installment_groups(updated_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_transactions_updated_at ON public.scheduled_transactions(updated_at);
CREATE INDEX IF NOT EXISTS idx_payees_updated_at ON public.payees(updated_at);
CREATE INDEX IF NOT EXISTS idx_debt_accounts_updated_at ON public.debt_accounts(updated_at);
CREATE INDEX IF NOT EXISTS idx_debt_items_updated_at ON public.debt_items(updated_at);

-- ── Desativar RLS para sincronização anon direta ou permitir acesso total anon ──
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso irrestrito para chave anon (dados não sensíveis / uso direto)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'accounts', 'category_groups', 'categories', 'budget_months',
    'transactions', 'installment_groups', 'scheduled_transactions',
    'payees', 'debt_accounts', 'debt_items'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Anon All Access" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "Anon All Access" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated All Access" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "Authenticated All Access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END
$$;

-- ── Habilitar Realtime para atualização instantânea entre abas e dispositivos ──
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'accounts', 'category_groups', 'categories', 'budget_months',
    'transactions', 'installment_groups', 'scheduled_transactions',
    'payees', 'debt_accounts', 'debt_items'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END
$$;
`

