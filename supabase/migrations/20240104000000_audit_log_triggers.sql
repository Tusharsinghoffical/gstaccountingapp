-- ==============================================================================
-- Migration: 20240104000000_audit_log_triggers.sql
-- Reference: Prompt 24 - Financial Mutation Audit Log Triggers & Admin RLS
-- Automatically populates audit_log via Postgres triggers on INSERT/UPDATE
-- to invoices, payments, and ledger_entries.
-- Restricts audit_log read access to administrators only.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Trigger Function: log_financial_mutation()
-- Extracts caller auth.uid(), operation (INSERT/UPDATE), computes column diff,
-- and records an immutable audit log entry.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_financial_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_business_id UUID;
    v_record_id UUID;
    v_action TEXT;
    v_diff JSONB := '{}'::jsonb;
BEGIN
    -- 1. Extract active user from Supabase auth session if available
    v_user_id := auth.uid();

    -- 2. Identify operation
    v_action := TG_OP;

    -- 3. Extract business and record IDs
    IF TG_OP = 'DELETE' THEN
        v_business_id := OLD.business_id;
        v_record_id := OLD.id;
        -- Capture deleted snapshot
        v_diff := jsonb_build_object('deleted', to_jsonb(OLD) - 'business_id');
    ELSIF TG_OP = 'INSERT' THEN
        v_business_id := NEW.business_id;
        v_record_id := NEW.id;
        -- Capture creation snapshot excluding internal technical metadata
        v_diff := jsonb_build_object(
            'created',
            to_jsonb(NEW) - 'business_id' - 'created_at' - 'updated_at'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_business_id := NEW.business_id;
        v_record_id := NEW.id;

        -- Compute delta between OLD and NEW rows, ignoring updated_at
        SELECT jsonb_object_agg(
            new_data.key,
            jsonb_build_object(
                'old', old_data.value,
                'new', new_data.value
            )
        )
        INTO v_diff
        FROM jsonb_each(to_jsonb(NEW)) AS new_data
        JOIN jsonb_each(to_jsonb(OLD)) AS old_data ON new_data.key = old_data.key
        WHERE new_data.value IS DISTINCT FROM old_data.value
          AND new_data.key NOT IN ('updated_at');

        -- If only updated_at changed or no net changes, skip insertion to prevent noise
        IF v_diff IS NULL OR v_diff = '{}'::jsonb THEN
            RETURN NEW;
        END IF;
    END IF;

    -- 4. Record audit entry
    INSERT INTO audit_log (
        business_id,
        user_id,
        action,
        table_name,
        record_id,
        diff,
        created_at
    ) VALUES (
        v_business_id,
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        v_record_id,
        COALESCE(v_diff, '{}'::jsonb),
        now()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Attach Triggers to Financial Tables (invoices, payments, ledger_entries)
-- ------------------------------------------------------------------------------

-- (a) Invoices trigger
DROP TRIGGER IF EXISTS trg_audit_invoices ON invoices;
CREATE TRIGGER trg_audit_invoices
AFTER INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION log_financial_mutation();

-- (b) Payments trigger
DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION log_financial_mutation();

-- (c) Ledger Entries trigger
DROP TRIGGER IF EXISTS trg_audit_ledger_entries ON ledger_entries;
CREATE TRIGGER trg_audit_ledger_entries
AFTER INSERT OR UPDATE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION log_financial_mutation();

-- ------------------------------------------------------------------------------
-- 3. Update RLS: Restrict SELECT on audit_log to Administrators Only
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_log_select_member" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;

CREATE POLICY "audit_log_select_admin"
ON audit_log
FOR SELECT
TO authenticated
USING (has_business_role(business_id, ARRAY['admin']::text[]));

-- Ensure RLS is enabled and UPDATE/DELETE remains strictly prohibited
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, public;

COMMENT ON FUNCTION log_financial_mutation() IS
'Automatically logs INSERT and UPDATE mutations to invoices, payments, and ledger_entries with before/after diffs.';
