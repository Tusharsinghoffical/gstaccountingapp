-- ==============================================================================
-- GST Ledger: User Management & Member Invitation Schema Migration
-- Reference: 05-BUILD-PROMPTS.md (Prompt 23)
-- Admin-only role management: invite users by email to business, assign role,
-- revoke access. Enforces RLS with admin-only check.
-- ==============================================================================

-- 1. Extend business_users to track invitation email & status
ALTER TABLE business_users
ADD COLUMN IF NOT EXISTS invited_email TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'revoked'));

-- 2. Index for quick lookup by business_id and status
CREATE INDEX IF NOT EXISTS idx_business_users_status ON business_users(business_id, status);

-- 3. Ensure RLS is active on business_users
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (Reinforce admin-only member management)
-- Select: Members of the business or the user themselves
DROP POLICY IF EXISTS "business_users_select" ON business_users;
CREATE POLICY "business_users_select"
ON business_users
FOR SELECT
TO authenticated
USING (
    business_id IN (SELECT get_user_business_ids())
    OR user_id = auth.uid()
);

-- Insert: Only admin of the business can invite/add new members
DROP POLICY IF EXISTS "business_users_insert" ON business_users;
CREATE POLICY "business_users_insert"
ON business_users
FOR INSERT
TO authenticated
WITH CHECK (
    has_business_role(business_id, ARRAY['admin'])
    OR (
        user_id = auth.uid()
        AND NOT EXISTS (
            SELECT 1 FROM business_users WHERE business_id = business_users.business_id
        )
    )
);

-- Update: Only admin can modify roles or membership status
DROP POLICY IF EXISTS "business_users_update_admin" ON business_users;
CREATE POLICY "business_users_update_admin"
ON business_users
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin']))
WITH CHECK (has_business_role(business_id, ARRAY['admin']));

-- Delete / Revoke: Only admin can revoke membership (or user self-leaving)
DROP POLICY IF EXISTS "business_users_delete_admin" ON business_users;
CREATE POLICY "business_users_delete_admin"
ON business_users
FOR DELETE
TO authenticated
USING (
    has_business_role(business_id, ARRAY['admin'])
    OR user_id = auth.uid()
);
