-- ══════════════════════════════════════════════════════════════════════════
-- InvoiceFlow — DESTRUCTIVE FULL REBUILD SCHEMA
-- WARNING: Running this will DELETE ALL DATA and completely recreate the database.
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. DROP EVERYTHING (Tables & Policies)
-- ──────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.payment_accounts CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. CREATE CLIENTS TABLE
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2.5 CREATE USER SETTINGS TABLE
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_settings (
  user_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name       TEXT,
  company_email      TEXT,
  company_phone      TEXT,
  company_address    TEXT,
  company_tax        TEXT,
  company_website    TEXT,
  payment_terms      TEXT,
  logo_url           TEXT,
  logo_w             NUMERIC,
  logo_h             NUMERIC,
  logo_file          TEXT,
  payment_methods    JSONB       DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. CREATE INVOICES TABLE
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      UUID          NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number TEXT          NOT NULL,
  issue_date     DATE          NOT NULL,
  due_date       DATE          NOT NULL,
  status         TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax            NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date   DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT invoices_user_id_invoice_number_key UNIQUE (user_id, invoice_number)
);
CREATE INDEX idx_invoices_user_id   ON public.invoices(user_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status    ON public.invoices(status);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. CREATE INVOICE ITEMS TABLE
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.invoice_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 5. CREATE PAYMENT METHODS TABLE
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.payment_methods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL
);
CREATE INDEX idx_payment_methods_invoice_id ON public.payment_methods(invoice_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 6. CREATE PAYMENT ACCOUNTS TABLE
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE public.payment_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id  UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  account_name       TEXT,
  account_number     TEXT,
  provider           TEXT,
  branch             TEXT,
  additional_info    TEXT
);
CREATE INDEX idx_payment_accounts_payment_method_id ON public.payment_accounts(payment_method_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings    ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- 8. CREATE TABLE POLICIES (Users can only see/edit their own data)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "clients_all" ON public.clients 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_all" ON public.user_settings 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_all" ON public.invoices 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoice_items_all" ON public.invoice_items 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));

CREATE POLICY "payment_methods_all" ON public.payment_methods 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = payment_methods.invoice_id AND invoices.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = payment_methods.invoice_id AND invoices.user_id = auth.uid()));

CREATE POLICY "payment_accounts_all" ON public.payment_accounts 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.payment_methods JOIN public.invoices ON invoices.id = payment_methods.invoice_id WHERE payment_methods.id = payment_accounts.payment_method_id AND invoices.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.payment_methods JOIN public.invoices ON invoices.id = payment_methods.invoice_id WHERE payment_methods.id = payment_accounts.payment_method_id AND invoices.user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- 9. SETUP STORAGE AND STORAGE POLICIES
-- ──────────────────────────────────────────────────────────────────────────
-- Create documents bucket if it doesn't exist yet
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false) 
ON CONFLICT (id) DO NOTHING;

-- Since dropping tables doesn't drop storage policies automatically if they exist on the external storage schema,
-- we'll recreate them gracefully using DO block to drop old ones first if needed.
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "docs_upload_own" ON storage.objects;
    DROP POLICY IF EXISTS "docs_select_own" ON storage.objects;
    DROP POLICY IF EXISTS "docs_delete_own" ON storage.objects;
EXCEPTION WHEN OTHERS THEN 
    -- Ignore
END $$;

CREATE POLICY "docs_upload_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "docs_select_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "docs_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ──────────────────────────────────────────────────────────────────────────
-- 10. NOTIFY POSTGREST TO RELOAD API ENDPOINTS
-- ──────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
