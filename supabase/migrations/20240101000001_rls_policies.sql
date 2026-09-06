-- ==============================================================================
-- GST Ledger: Row-Level Security (RLS) Policies Migration
-- Reference: 03-ARCHITECTURE.md (§5 Security Model) & 05-BUILD-PROMPTS.md (Prompt 4)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable RLS on All Tables
-- ------------------------------------------------------------------------------
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rate_config ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Helper Security Functions (SECURITY DEFINER to avoid recursive RLS)
-- ------------------------------------------------------------------------------

-- Returns all business IDs that the current authenticated user belongs to
CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT business_id
    FROM business_users
    WHERE user_id = auth.uid();
$$;

-- Checks if current user has any of the required roles in the specified business
CREATE OR REPLACE FUNCTION has_business_role(target_business_id UUID, required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM business_users
        WHERE business_id = target_business_id
          AND user_id = auth.uid()
          AND role = ANY(required_roles)
    );
$$;

-- ------------------------------------------------------------------------------
-- 3. RLS Policies for `businesses`
-- ------------------------------------------------------------------------------
-- Members can view their own business
CREATE POLICY "businesses_select_member"
ON businesses
FOR SELECT
TO authenticated
USING (id IN (SELECT get_user_business_ids()));

-- Any authenticated user can create a business (onboarding)
CREATE POLICY "businesses_insert_authenticated"
ON businesses
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admin can update business details
CREATE POLICY "businesses_update_admin"
ON businesses
FOR UPDATE
TO authenticated
USING (has_business_role(id, ARRAY['admin']))
WITH CHECK (has_business_role(id, ARRAY['admin']));

-- Only admin can delete a business
CREATE POLICY "businesses_delete_admin"
ON businesses
FOR DELETE
TO authenticated
USING (has_business_role(id, ARRAY['admin']));

-- ------------------------------------------------------------------------------
-- 4. RLS Policies for `business_users`
-- ------------------------------------------------------------------------------
-- Users can view membership of businesses they belong to
CREATE POLICY "business_users_select"
ON business_users
FOR SELECT
TO authenticated
USING (
    business_id IN (SELECT get_user_business_ids())
    OR user_id = auth.uid()
);

-- Admin can add members; also allow users to attach themselves on business creation
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

-- Only admin can update member roles
CREATE POLICY "business_users_update_admin"
ON business_users
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin']))
WITH CHECK (has_business_role(business_id, ARRAY['admin']));

-- Only admin can remove members (or user removing self)
CREATE POLICY "business_users_delete_admin"
ON business_users
FOR DELETE
TO authenticated
USING (
    has_business_role(business_id, ARRAY['admin'])
    OR user_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 5. RLS Policies for `customers` & `suppliers`
-- ------------------------------------------------------------------------------
-- Customers: SELECT for all members (admin, accountant, auditor)
CREATE POLICY "customers_select_member"
ON customers
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

-- Customers: INSERT/UPDATE/DELETE for admin and accountant only (auditor read-only)
CREATE POLICY "customers_insert_staff"
ON customers
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "customers_update_staff"
ON customers
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "customers_delete_staff"
ON customers
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- Suppliers: SELECT for all members
CREATE POLICY "suppliers_select_member"
ON suppliers
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

-- Suppliers: INSERT/UPDATE/DELETE for admin and accountant only
CREATE POLICY "suppliers_insert_staff"
ON suppliers
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "suppliers_update_staff"
ON suppliers
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "suppliers_delete_staff"
ON suppliers
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- ------------------------------------------------------------------------------
-- 6. RLS Policies for `invoices` & `invoice_items`
-- All members can SELECT; only admin & accountant can INSERT/UPDATE/DELETE.
-- ------------------------------------------------------------------------------
CREATE POLICY "invoices_select_member"
ON invoices
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoices_insert_staff"
ON invoices
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "invoices_update_staff"
ON invoices
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "invoices_delete_staff"
ON invoices
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- Invoice Items (with direct business_id check)
CREATE POLICY "invoice_items_select_member"
ON invoice_items
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "invoice_items_insert_staff"
ON invoice_items
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "invoice_items_update_staff"
ON invoice_items
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "invoice_items_delete_staff"
ON invoice_items
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- ------------------------------------------------------------------------------
-- 7. RLS Policies for `payments` & `payment_allocations`
-- All members can SELECT; only admin & accountant can INSERT/UPDATE/DELETE.
-- ------------------------------------------------------------------------------
CREATE POLICY "payments_select_member"
ON payments
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "payments_insert_staff"
ON payments
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "payments_update_staff"
ON payments
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "payments_delete_staff"
ON payments
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- Payment Allocations (with direct business_id check)
CREATE POLICY "payment_allocations_select_member"
ON payment_allocations
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "payment_allocations_insert_staff"
ON payment_allocations
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "payment_allocations_update_staff"
ON payment_allocations
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "payment_allocations_delete_staff"
ON payment_allocations
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- ------------------------------------------------------------------------------
-- 8. RLS Policies for `ledger_entries`
-- All members can SELECT; only admin & accountant can INSERT/UPDATE/DELETE.
-- ------------------------------------------------------------------------------
CREATE POLICY "ledger_entries_select_member"
ON ledger_entries
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "ledger_entries_insert_staff"
ON ledger_entries
FOR INSERT
TO authenticated
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "ledger_entries_update_staff"
ON ledger_entries
FOR UPDATE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']))
WITH CHECK (has_business_role(business_id, ARRAY['admin', 'accountant']));

CREATE POLICY "ledger_entries_delete_staff"
ON ledger_entries
FOR DELETE
TO authenticated
USING (has_business_role(business_id, ARRAY['admin', 'accountant']));

-- ------------------------------------------------------------------------------
-- 9. RLS Policies for `audit_log` (Append-only: INSERT & SELECT only)
-- NO UPDATE OR DELETE GRANTED FOR ANY ROLE (EVEN ADMIN).
-- ------------------------------------------------------------------------------
-- Members can view audit records for their business
CREATE POLICY "audit_log_select_member"
ON audit_log
FOR SELECT
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()));

-- Members can record audit entries
CREATE POLICY "audit_log_insert_member"
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- Explicitly revoke UPDATE and DELETE privileges at database role level
REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, public;

-- ------------------------------------------------------------------------------
-- 10. RLS Policies for `tax_rate_config`
-- Global rates (business_id IS NULL) are readable by any authenticated user.
-- Business-specific rates are readable by members, mutable by admin/accountant.
-- ------------------------------------------------------------------------------
CREATE POLICY "tax_rate_config_select"
ON tax_rate_config
FOR SELECT
TO authenticated
USING (
    business_id IS NULL
    OR business_id IN (SELECT get_user_business_ids())
);

CREATE POLICY "tax_rate_config_insert_staff"
ON tax_rate_config
FOR INSERT
TO authenticated
WITH CHECK (
    business_id IS NOT NULL
    AND has_business_role(business_id, ARRAY['admin', 'accountant'])
);

CREATE POLICY "tax_rate_config_update_staff"
ON tax_rate_config
FOR UPDATE
TO authenticated
USING (
    business_id IS NOT NULL
    AND has_business_role(business_id, ARRAY['admin', 'accountant'])
)
WITH CHECK (
    business_id IS NOT NULL
    AND has_business_role(business_id, ARRAY['admin', 'accountant'])
);

CREATE POLICY "tax_rate_config_delete_staff"
ON tax_rate_config
FOR DELETE
TO authenticated
USING (
    business_id IS NOT NULL
    AND has_business_role(business_id, ARRAY['admin', 'accountant'])
);
