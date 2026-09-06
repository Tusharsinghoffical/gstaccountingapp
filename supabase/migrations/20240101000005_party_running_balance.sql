-- ==============================================================================
-- GST Ledger: Party Running Balance Computation & Chronological Ledger View
-- Reference: 05-BUILD-PROMPTS.md (Prompt 15)
-- Specification:
-- 1. Balances are derived dynamically by summing ledger_entries at query time.
-- 2. Balances are NEVER stored as a mutable column on customers or suppliers.
-- 3. Dedicated index on (business_id, party_id, created_at) to ensure fast
--    chronological window queries as transaction volume scales.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Performance Indexes for Ledger Queries
-- ------------------------------------------------------------------------------
-- Required by Prompt 15: Index on (business_id, party_id, created_at)
CREATE INDEX IF NOT EXISTS idx_ledger_entries_party_created 
ON ledger_entries(business_id, party_id, created_at ASC);

-- Composite chronological index covering entry_date and created_at for tie-breaking
CREATE INDEX IF NOT EXISTS idx_ledger_entries_party_chronological 
ON ledger_entries(business_id, party_id, entry_date ASC, created_at ASC);

-- ------------------------------------------------------------------------------
-- 2. SQL View: party_running_balances_view
-- Computes the running balance across all ledger entries per party at query time
-- using PostgreSQL window functions.
--
-- Convention:
-- - Debit (Dr) increases receivable (e.g. Sales Invoice to customer)
-- - Credit (Cr) reduces receivable / records receipt (e.g. Customer payment)
-- - Running balance = SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW party_running_balances_view AS
SELECT 
    le.id,
    le.business_id,
    le.party_id,
    le.entry_type,
    le.amount,
    CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0.00 END AS debit,
    CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0.00 END AS credit,
    le.ref_invoice_id,
    le.ref_payment_id,
    le.description,
    le.entry_date,
    le.created_at,
    -- Query-time running balance computation (partitioned by business and party)
    SUM(
        CASE 
            WHEN le.entry_type = 'debit' THEN le.amount 
            ELSE -le.amount 
        END
    ) OVER (
        PARTITION BY le.business_id, le.party_id 
        ORDER BY le.entry_date ASC, le.created_at ASC, le.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance,
    -- Direction indicator
    CASE 
        WHEN SUM(
            CASE 
                WHEN le.entry_type = 'debit' THEN le.amount 
                ELSE -le.amount 
            END
        ) OVER (
            PARTITION BY le.business_id, le.party_id 
            ORDER BY le.entry_date ASC, le.created_at ASC, le.id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) >= 0 THEN 'Dr'
        ELSE 'Cr'
    END AS dr_cr
FROM ledger_entries le;

-- ------------------------------------------------------------------------------
-- 3. Stored Function: get_party_balance
-- Returns the current net balance, total debits, and total credits for a party.
-- Calculated entirely on-the-fly with 0 persisted/mutable balance state.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_party_balance(
    p_business_id UUID,
    p_party_id UUID
)
RETURNS TABLE (
    party_id UUID,
    net_balance NUMERIC(12, 2),
    total_debit NUMERIC(12, 2),
    total_credit NUMERIC(12, 2),
    entry_count BIGINT,
    dr_cr TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total_debit NUMERIC(12, 2);
    v_total_credit NUMERIC(12, 2);
    v_net NUMERIC(12, 2);
    v_count BIGINT;
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0.00 END), 0.00),
        COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0.00 END), 0.00),
        COUNT(*)
    INTO v_total_debit, v_total_credit, v_count
    FROM ledger_entries
    WHERE business_id = p_business_id AND party_id = p_party_id;

    v_net := v_total_debit - v_total_credit;

    RETURN QUERY
    SELECT 
        p_party_id,
        v_net,
        v_total_debit,
        v_total_credit,
        v_count,
        CASE WHEN v_net >= 0 THEN 'Dr'::TEXT ELSE 'Cr'::TEXT END;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Stored Function: get_party_ledger_chronological
-- Fetches full chronological ledger statement for a party with running balance.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_party_ledger_chronological(
    p_business_id UUID,
    p_party_id UUID
)
RETURNS TABLE (
    id UUID,
    entry_date DATE,
    created_at TIMESTAMPTZ,
    entry_type TEXT,
    description TEXT,
    ref_invoice_id UUID,
    ref_payment_id UUID,
    debit NUMERIC(12, 2),
    credit NUMERIC(12, 2),
    running_balance NUMERIC(12, 2),
    dr_cr TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.entry_date,
        v.created_at,
        v.entry_type,
        v.description,
        v.ref_invoice_id,
        v.ref_payment_id,
        v.debit,
        v.credit,
        v.running_balance,
        v.dr_cr
    FROM party_running_balances_view v
    WHERE v.business_id = p_business_id AND v.party_id = p_party_id
    ORDER BY v.entry_date ASC, v.created_at ASC, v.id ASC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RLS Policies on View & Functions
-- ------------------------------------------------------------------------------
GRANT SELECT ON party_running_balances_view TO authenticated;
