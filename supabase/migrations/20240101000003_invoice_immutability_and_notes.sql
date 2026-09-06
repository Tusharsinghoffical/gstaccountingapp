-- ==============================================================================
-- GST Ledger: Invoice Immutability, Status Transitions & Credit/Debit Notes
-- Reference: 05-BUILD-PROMPTS.md (Prompt 12)
-- Status Transitions: draft -> final -> cancelled
-- Immutability: Triggers + RLS prevent any modification or deletion of finalized invoices
-- Adjustments: Allowed only via credit_note / debit_note referencing original_invoice_id
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Schema Extensions on `invoices` and `invoice_counters`
-- ------------------------------------------------------------------------------

-- Add original_invoice_id for credit_note and debit_note references
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS original_invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_invoices_original_id ON invoices(original_invoice_id);

-- Update invoices.type CHECK constraint to support credit_note and debit_note
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_type_check
CHECK (type IN ('sales', 'purchase', 'credit_note', 'debit_note'));

-- Update invoice_counters.type CHECK constraint
ALTER TABLE invoice_counters DROP CONSTRAINT IF EXISTS invoice_counters_type_check;
ALTER TABLE invoice_counters ADD CONSTRAINT invoice_counters_type_check
CHECK (type IN ('sales', 'purchase', 'credit_note', 'debit_note'));

-- ------------------------------------------------------------------------------
-- 2. Update assign_invoice_number_trigger to support CN and DN prefixes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_invoice_number_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_fy_code TEXT;
    v_prefix TEXT;
    v_next_num INTEGER;
BEGIN
    -- Ensure invoice_date is set
    IF NEW.invoice_date IS NULL THEN
        NEW.invoice_date := CURRENT_DATE;
    END IF;

    -- Compute Indian FY (April 1 - March 31)
    v_fy_code := get_indian_financial_year(NEW.invoice_date);
    NEW.financial_year := v_fy_code;

    -- Only auto-generate if invoice_no is omitted, blank, or placeholder 'AUTO'
    IF NEW.invoice_no IS NULL OR trim(NEW.invoice_no) = '' OR NEW.invoice_no = 'AUTO' THEN
        v_prefix := CASE
            WHEN NEW.type = 'purchase' THEN 'PUR'
            WHEN NEW.type = 'credit_note' THEN 'CN'
            WHEN NEW.type = 'debit_note' THEN 'DN'
            ELSE 'INV'
        END;

        -- Atomic upsert: row-level lock serializes concurrent transactions per business, type & FY
        INSERT INTO invoice_counters (business_id, type, financial_year, last_number)
        VALUES (NEW.business_id, NEW.type, v_fy_code, 1)
        ON CONFLICT (business_id, type, financial_year)
        DO UPDATE SET
            last_number = invoice_counters.last_number + 1,
            updated_at = now()
        RETURNING last_number INTO v_next_num;

        -- Format: {PREFIX}/{FY}/{sequential number} e.g. INV/2025-26/0001 or CN/2025-26/0001
        NEW.invoice_no := v_prefix || '/' || v_fy_code || '/' || LPAD(v_next_num::TEXT, 4, '0');
    END IF;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Validation Trigger for Credit Notes & Debit Notes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_credit_debit_note_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_orig_status TEXT;
    v_orig_biz_id UUID;
    v_orig_invoice_no TEXT;
BEGIN
    IF NEW.type IN ('credit_note', 'debit_note') THEN
        -- 1. Must reference an original invoice
        IF NEW.original_invoice_id IS NULL THEN
            RAISE EXCEPTION 'A % must reference an original invoice (original_invoice_id is required)', NEW.type;
        END IF;

        -- 2. Must not reference itself
        IF NEW.id IS NOT NULL AND NEW.id = NEW.original_invoice_id THEN
            RAISE EXCEPTION 'A % cannot reference itself as the original invoice', NEW.type;
        END IF;

        -- 3. Original invoice must exist and have status 'final'
        SELECT status, business_id, invoice_no
        INTO v_orig_status, v_orig_biz_id, v_orig_invoice_no
        FROM invoices
        WHERE id = NEW.original_invoice_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Original invoice % not found', NEW.original_invoice_id;
        END IF;

        IF v_orig_biz_id <> NEW.business_id THEN
            RAISE EXCEPTION 'Cannot issue % against an invoice belonging to a different business', NEW.type;
        END IF;

        IF v_orig_status <> 'final' THEN
            RAISE EXCEPTION 'Credit/debit notes can only be issued against finalized invoices. Invoice % is currently in "%" state.',
                v_orig_invoice_no, v_orig_status;
        END IF;
    ELSE
        -- Standard sales/purchase invoices should not reference another invoice
        IF NEW.original_invoice_id IS NOT NULL AND TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Standard % invoices cannot reference an original_invoice_id. Use credit_note or debit_note instead.', NEW.type;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_credit_debit_note ON invoices;
CREATE TRIGGER trg_validate_credit_debit_note
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION validate_credit_debit_note_trigger();

-- ------------------------------------------------------------------------------
-- 4. Database Immutability & Status Transition Trigger on `invoices`
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_invoice_status_and_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- --------------------------------------------------------------------------
    -- A. Handle DELETE operations
    -- --------------------------------------------------------------------------
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('final', 'cancelled') THEN
            RAISE EXCEPTION 'Cannot delete % invoice % (ID: %). Finalized and cancelled invoices are permanent audit records.',
                OLD.status, OLD.invoice_no, OLD.id;
        END IF;
        RETURN OLD;
    END IF;

    -- --------------------------------------------------------------------------
    -- B. Handle UPDATE operations
    -- --------------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        -- Case 1: Cancelled invoices are in a terminal state
        IF OLD.status = 'cancelled' THEN
            RAISE EXCEPTION 'Cancelled invoice % is in a terminal state and cannot be modified.', OLD.invoice_no;
        END IF;

        -- Case 2: Invoices currently in 'final' status
        IF OLD.status = 'final' THEN
            -- Cannot revert back to draft
            IF NEW.status = 'draft' THEN
                RAISE EXCEPTION 'Cannot revert finalized invoice % back to draft. Corrections must be made via credit_note or debit_note.', OLD.invoice_no;
            END IF;

            -- Invalid transition
            IF NEW.status NOT IN ('final', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid invoice status transition from final to "%"', NEW.status;
            END IF;

            -- Transition: final -> cancelled
            IF NEW.status = 'cancelled' THEN
                -- When cancelling, ALL financial, party, and date fields MUST remain intact
                IF (
                    NEW.business_id IS DISTINCT FROM OLD.business_id OR
                    NEW.type IS DISTINCT FROM OLD.type OR
                    NEW.customer_or_supplier_id IS DISTINCT FROM OLD.customer_or_supplier_id OR
                    NEW.original_invoice_id IS DISTINCT FROM OLD.original_invoice_id OR
                    NEW.invoice_no IS DISTINCT FROM OLD.invoice_no OR
                    NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
                    NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
                    NEW.cgst IS DISTINCT FROM OLD.cgst OR
                    NEW.sgst IS DISTINCT FROM OLD.sgst OR
                    NEW.igst IS DISTINCT FROM OLD.igst OR
                    NEW.total IS DISTINCT FROM OLD.total OR
                    NEW.financial_year IS DISTINCT FROM OLD.financial_year
                ) THEN
                    RAISE EXCEPTION 'Cannot modify financial, counterparty, or numbering fields of finalized invoice % during cancellation.', OLD.invoice_no;
                END IF;

                -- Log audit trail for cancellation
                INSERT INTO audit_log (business_id, action, table_name, record_id, diff)
                VALUES (
                    OLD.business_id,
                    'STATUS_CHANGE',
                    'invoices',
                    OLD.id,
                    jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status), 'reason', 'Invoice cancelled')
                );

                RETURN NEW;
            END IF;

            -- Status remains 'final': strict immutability check
            IF NEW.status = 'final' THEN
                IF (
                    NEW.business_id IS DISTINCT FROM OLD.business_id OR
                    NEW.type IS DISTINCT FROM OLD.type OR
                    NEW.customer_or_supplier_id IS DISTINCT FROM OLD.customer_or_supplier_id OR
                    NEW.original_invoice_id IS DISTINCT FROM OLD.original_invoice_id OR
                    NEW.invoice_no IS DISTINCT FROM OLD.invoice_no OR
                    NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
                    NEW.due_date IS DISTINCT FROM OLD.due_date OR
                    NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
                    NEW.cgst IS DISTINCT FROM OLD.cgst OR
                    NEW.sgst IS DISTINCT FROM OLD.sgst OR
                    NEW.igst IS DISTINCT FROM OLD.igst OR
                    NEW.total IS DISTINCT FROM OLD.total OR
                    NEW.financial_year IS DISTINCT FROM OLD.financial_year OR
                    NEW.notes IS DISTINCT FROM OLD.notes
                ) THEN
                    RAISE EXCEPTION 'Invoice % is finalized and immutable. Corrections must be made via a separate credit_note or debit_note referencing this invoice.', OLD.invoice_no;
                END IF;
            END IF;
        END IF;

        -- Case 3: Invoices currently in 'draft' status
        IF OLD.status = 'draft' THEN
            IF NEW.status NOT IN ('draft', 'final', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid invoice status transition from draft to "%"', NEW.status;
            END IF;

            -- Log audit trail when draft is finalized
            IF NEW.status = 'final' THEN
                INSERT INTO audit_log (business_id, action, table_name, record_id, diff)
                VALUES (
                    OLD.business_id,
                    'STATUS_CHANGE',
                    'invoices',
                    OLD.id,
                    jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status))
                );
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_status_and_immutability ON invoices;
CREATE TRIGGER trg_enforce_invoice_status_and_immutability
BEFORE UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION enforce_invoice_status_and_immutability();

-- ------------------------------------------------------------------------------
-- 5. Line Items Immutability Trigger on `invoice_items`
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_invoice_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_status TEXT;
    v_parent_inv_no TEXT;
    v_target_invoice_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_target_invoice_id := OLD.invoice_id;
    ELSE
        v_target_invoice_id := NEW.invoice_id;
    END IF;

    SELECT status, invoice_no INTO v_parent_status, v_parent_inv_no
    FROM invoices
    WHERE id = v_target_invoice_id;

    IF FOUND AND v_parent_status IN ('final', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot % line items on % invoice % (ID: %). Line items are immutable once an invoice is finalized.',
            TG_OP, v_parent_status, v_parent_inv_no, v_target_invoice_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_items_immutability ON invoice_items;
CREATE TRIGGER trg_enforce_invoice_items_immutability
BEFORE INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION enforce_invoice_items_immutability();

-- ------------------------------------------------------------------------------
-- 6. Updated RLS Policies Enforcing Database-Level Immutability
-- ------------------------------------------------------------------------------

-- Invoices DELETE: strictly prohibited for non-draft invoices at RLS layer
DROP POLICY IF EXISTS "invoices_delete_staff" ON invoices;
CREATE POLICY "invoices_delete_staff"
ON invoices
FOR DELETE
TO authenticated
USING (
    has_business_role(business_id, ARRAY['admin', 'accountant'])
    AND status = 'draft'
);

-- Invoice items modifications: strictly prohibited if parent invoice is finalized/cancelled
DROP POLICY IF EXISTS "invoice_items_insert_staff" ON invoice_items;
CREATE POLICY "invoice_items_insert_staff"
ON invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
    has_business_role(business_id, ARRAY['admin', 'accountant'])
    AND invoice_id IN (SELECT id FROM invoices WHERE status = 'draft')
);

DROP POLICY IF EXISTS "invoice_items_update_staff" ON invoice_items;
CREATE POLICY "invoice_items_update_staff"
ON invoice_items
FOR UPDATE
TO authenticated
USING (
    has_business_role(business_id, ARRAY['admin', 'accountant'])
    AND invoice_id IN (SELECT id FROM invoices WHERE status = 'draft')
)
WITH CHECK (
    has_business_role(business_id, ARRAY['admin', 'accountant'])
    AND invoice_id IN (SELECT id FROM invoices WHERE status = 'draft')
);

DROP POLICY IF EXISTS "invoice_items_delete_staff" ON invoice_items;
CREATE POLICY "invoice_items_delete_staff"
ON invoice_items
FOR DELETE
TO authenticated
USING (
    has_business_role(business_id, ARRAY['admin', 'accountant'])
    AND invoice_id IN (SELECT id FROM invoices WHERE status = 'draft')
);
