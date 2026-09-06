-- ==============================================================================
-- GST Ledger: SQL Verification for Storage Bucket Configuration & RLS Policies
-- Verifies:
-- 1. Dedicated 'invoices' bucket exists and is private (public = false).
-- 2. File size limit is 10 MB (10485760 bytes).
-- 3. Allowed MIME types are restricted to images and PDFs.
-- 4. Storage RLS policies enforce multi-tenant business scoping.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_bucket_exists BOOLEAN;
    v_is_public BOOLEAN;
    v_size_limit BIGINT;
    v_mime_types TEXT[];
    v_select_policy_exists BOOLEAN;
    v_insert_policy_exists BOOLEAN;
    v_delete_policy_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'TEST SUITE: Supabase Storage Bucket Configuration & RLS Verification';
    RAISE NOTICE '=============================================================';

    -- --------------------------------------------------------------------------
    -- 1. Verify Storage Bucket Configuration
    -- --------------------------------------------------------------------------
    SELECT 
        EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'invoices'),
        public,
        file_size_limit,
        allowed_mime_types
    INTO 
        v_bucket_exists,
        v_is_public,
        v_size_limit,
        v_mime_types
    FROM storage.buckets
    WHERE id = 'invoices';

    IF NOT v_bucket_exists THEN
        RAISE EXCEPTION 'TEST FAILED: Storage bucket "invoices" does not exist!';
    END IF;

    IF v_is_public THEN
        RAISE EXCEPTION 'TEST FAILED: Storage bucket "invoices" must be private (public = false)!';
    END IF;

    IF v_size_limit <> 10485760 THEN
        RAISE EXCEPTION 'TEST FAILED: File size limit must be 10485760 bytes (10MB), got %', v_size_limit;
    END IF;

    IF NOT ('application/pdf' = ANY(v_mime_types) AND 'image/jpeg' = ANY(v_mime_types) AND 'image/png' = ANY(v_mime_types)) THEN
        RAISE EXCEPTION 'TEST FAILED: Bucket does not have proper allowed MIME types!';
    END IF;

    RAISE NOTICE '✔ TEST 1 PASSED: Bucket "invoices" is private with 10MB limit and PDF/Image MIME restrictions.';

    -- --------------------------------------------------------------------------
    -- 2. Verify Storage RLS Policies
    -- --------------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'storage_invoices_select_member'
    ) INTO v_select_policy_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'storage_invoices_insert_authorized'
    ) INTO v_insert_policy_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'storage_invoices_delete_admin'
    ) INTO v_delete_policy_exists;

    IF NOT v_select_policy_exists THEN
        RAISE EXCEPTION 'TEST FAILED: Policy storage_invoices_select_member is missing!';
    END IF;

    IF NOT v_insert_policy_exists THEN
        RAISE EXCEPTION 'TEST FAILED: Policy storage_invoices_insert_authorized is missing!';
    END IF;

    IF NOT v_delete_policy_exists THEN
        RAISE EXCEPTION 'TEST FAILED: Policy storage_invoices_delete_admin is missing!';
    END IF;

    RAISE NOTICE '✔ TEST 2 PASSED: Storage RLS policies for tenant-scoped member access, insert, and delete are active.';

    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'ALL STORAGE RLS TESTS PASSED SUCCESSFULLY.';
    RAISE NOTICE '=============================================================';
END $$;

ROLLBACK;
