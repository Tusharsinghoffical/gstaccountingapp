-- ==============================================================================
-- GST Ledger: Sequential Invoice Numbering Migration
-- Reference: 05-BUILD-PROMPTS.md (Prompt 11)
-- Financial Year: April 1 - March 31
-- Format: INV/{FY}/{sequential number}, e.g. INV/2025-26/0001
-- Concurrency-Safe: Postgres row-level locking trigger
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper function to compute Indian Financial Year (April 1 - March 31)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_indian_financial_year(p_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_start_year INTEGER;
    v_end_year_short INTEGER;
BEGIN
    IF p_date IS NULL THEN
        p_date := CURRENT_DATE;
    END IF;

    v_year := EXTRACT(YEAR FROM p_date);
    v_month := EXTRACT(MONTH FROM p_date);

    -- If April or later (months 4-12), FY is current_year - (current_year + 1)
    -- If Jan-Mar (months 1-3), FY is (current_year - 1) - current_year
    IF v_month >= 4 THEN
        v_start_year := v_year;
    ELSE
        v_start_year := v_year - 1;
    END IF;

    v_end_year_short := (v_start_year + 1) % 100;

    RETURN v_start_year::TEXT || '-' || LPAD(v_end_year_short::TEXT, 2, '0');
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Concurrency-Safe Counter Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_counters (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sales', 'purchase')),
    financial_year VARCHAR(9) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, type, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_invoice_counters_lookup
ON invoice_counters(business_id, type, financial_year);

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_counters_access"
ON invoice_counters
FOR ALL
TO authenticated
USING (business_id IN (SELECT get_user_business_ids()))
WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- ------------------------------------------------------------------------------
-- 3. Trigger function to assign sequential, race-condition-free invoice_no
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

    -- Compute Indian FY
    v_fy_code := get_indian_financial_year(NEW.invoice_date);
    NEW.financial_year := v_fy_code;

    -- Only auto-generate if invoice_no is omitted, blank, or placeholder 'AUTO'
    IF NEW.invoice_no IS NULL OR trim(NEW.invoice_no) = '' OR NEW.invoice_no = 'AUTO' THEN
        v_prefix := CASE WHEN NEW.type = 'purchase' THEN 'PUR' ELSE 'INV' END;

        -- Atomic upsert: row-level lock serializes concurrent transactions
        -- Guaranteed sequential numbers with NO duplicates and NO gaps
        INSERT INTO invoice_counters (business_id, type, financial_year, last_number)
        VALUES (NEW.business_id, NEW.type, v_fy_code, 1)
        ON CONFLICT (business_id, type, financial_year)
        DO UPDATE SET
            last_number = invoice_counters.last_number + 1,
            updated_at = now()
        RETURNING last_number INTO v_next_num;

        -- Format: INV/{FY}/{sequential number} e.g. INV/2025-26/0001
        NEW.invoice_no := v_prefix || '/' || v_fy_code || '/' || LPAD(v_next_num::TEXT, 4, '0');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_invoice_number ON invoices;
CREATE TRIGGER trg_assign_invoice_number
BEFORE INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION assign_invoice_number_trigger();
