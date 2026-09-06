-- ==============================================================================
-- GST Ledger: Supabase Storage Bucket & RLS Policies for OCR Invoice Uploads
-- Reference: 05-BUILD-PROMPTS.md (Prompt 16) & 03-ARCHITECTURE.md (§5 Security)
-- Specification:
-- 1. Dedicated private storage bucket ('invoices') with 10MB limit and MIME restrictions.
-- 2. Multi-tenant isolation: Files MUST be stored under '{business_id}/...' prefix.
-- 3. Storage RLS policies enforcing tenant isolation matching database tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create Storage Bucket: `invoices`
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'invoices',
    'invoices',
    false,
    10485760, -- 10 MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- ------------------------------------------------------------------------------
-- 2. Enable RLS on storage.objects
-- ------------------------------------------------------------------------------
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. Storage RLS Policies for Multi-Tenant Scoping
-- Rule: The top-level folder name MUST be the business_id UUID.
-- Example path: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/1715000000-invoice.pdf"
-- ------------------------------------------------------------------------------

-- Policy: Members can view and download invoice files belonging to their business
CREATE POLICY "storage_invoices_select_member"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'invoices'
    AND (
        CASE 
            -- Safely extract top-level folder name and verify it matches user's businesses
            WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN ((storage.foldername(name))[1])::UUID IN (SELECT get_user_business_ids())
            ELSE false
        END
    )
);

-- Policy: Admin and Accountant roles can upload invoices for their business
CREATE POLICY "storage_invoices_insert_authorized"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'invoices'
    AND (
        CASE 
            WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN has_business_role(((storage.foldername(name))[1])::UUID, ARRAY['admin', 'accountant'])
            ELSE false
        END
    )
);

-- Policy: Only Admin can delete invoice files for their business
CREATE POLICY "storage_invoices_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'invoices'
    AND (
        CASE 
            WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN has_business_role(((storage.foldername(name))[1])::UUID, ARRAY['admin'])
            ELSE false
        END
    )
);
