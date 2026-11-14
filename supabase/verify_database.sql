-- ============================================================================
-- CampusConnect: 06 - Read-Only Database Verification Queries
-- Run after schema.sql, functions.sql, rls_policies.sql, and storage_policies.sql
-- ============================================================================

-- 1. Verify required tables exist in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'items', 'borrow_requests', 'purchase_requests')
ORDER BY table_name;

-- 2. Verify Row Level Security (RLS) is enabled on all 4 tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'items', 'borrow_requests', 'purchase_requests')
ORDER BY tablename;

-- 3. Verify partial unique indexes and query indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'items', 'borrow_requests', 'purchase_requests')
ORDER BY tablename, indexname;

-- 4. Verify workflow RPC functions and security attributes
SELECT
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  p.proconfig AS config_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_borrow_request',
    'respond_borrow_request',
    'confirm_borrower_handover',
    'confirm_owner_handover',
    'confirm_borrower_return',
    'confirm_owner_return',
    'cancel_borrow_request',
    'create_purchase_request',
    'respond_purchase_request',
    'confirm_buyer_purchase',
    'confirm_seller_purchase',
    'cancel_purchase_request'
  )
ORDER BY p.proname;

-- 5. Verify RLS policies on public tables
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Verify Storage bucket and storage.objects policies
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'item-images';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
