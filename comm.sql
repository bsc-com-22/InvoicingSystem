-- ==============================================================================
-- CLEAN FOR PRODUCTION SCRIPT
-- Run this script in the Supabase SQL Editor to delete all test data cleanly.
-- ==============================================================================

-- 1. This command deletes all client records.
-- Because of the ON DELETE CASCADE constraints configured in your database, 
-- deleting all clients will automatically and cleanly delete all attached:
--   - invoices
--   - invoice_items
--   - payment_methods
--   - payment_accounts
TRUNCATE TABLE public.clients CASCADE;

-- 2. Just as a secondary safety measure to ensure no orphaned invoices exist:
TRUNCATE TABLE public.invoices CASCADE;

-- ==============================================================================
-- IMPORTANT NOTE REGARDING PDF STORAGE (AWS S3 Rules):
-- Supabase blocks dropping storage files directly through SQL for safety reasons.
-- To delete any test PDFs generated:
-- 1. Go to your Supabase Dashboard
-- 2. Click "Storage" in the left-hand menu
-- 3. Open the "documents" bucket
-- 4. Select all listed test files and definitively delete them.
-- ==============================================================================
