-- ==============================================================================
-- GST Ledger: SQL Verification for Party Running Balance Computation
-- Verifies:
-- 1. Balances are derived dynamically by summing ledger_entries at query time.
-- 2. Neither 'customers' nor 'suppliers' contains a mutable 'balance' column.
-- 3. Dedicated index on (business_id, party_id, created_at) exists.
-- 4. Running balances correctly compute chronological cumulative sum with Dr/Cr.
-- 5. Tie-breaking by created_at works on same-day transactions.
-- Wrapped in a transaction with ROLLBACK.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_biz_id UUID := gen_random_uuid();
    v_party_id UUID := gen_random_uuid();
    v_has_customer_balance_col BOOLEAN;
    v_has_supplier_balance_col BOOLEAN;
    v_has_created_index BOOLEAN;
    v_row RECORD;
    v_running_bal NUMERIC(12, 2);
    v_summary RECORD;
BEGIN
    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'TEST SUITE: Party Running Balance Computation & Zero Mutable Storage';
    RAISE NOTICE '=============================================================';

    -- --------------------------------------------------------------------------
    -- 1. Verify schema: Ensure NO mutable 'balance' column exists on customers/suppliers
    -- --------------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'balance'
    ) INTO v_has_customer_balance_col;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'balance'
    ) INTO v_has_supplier_balance_col;

    IF v_has_customer_balance_col THEN
        RAISE EXCEPTION 'TEST FAILED: customers table must NOT have a mutable balance column!';
    END IF;

    IF v_has_supplier_balance_col THEN
        RAISE EXCEPTION 'TEST FAILED: suppliers table must NOT have a mutable balance column!';
    END IF;

    RAISE NOTICE '✔ TEST 1 PASSED: Zero mutable balance columns exist on customers/suppliers tables.';

    -- --------------------------------------------------------------------------
    -- 2. Verify Performance Index exists
    -- --------------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'ledger_entries' 
          AND indexname = 'idx_ledger_entries_party_created'
    ) INTO v_has_created_index;

    IF NOT v_has_created_index THEN
        RAISE EXCEPTION 'TEST FAILED: idx_ledger_entries_party_created on (business_id, party_id, created_at) is missing!';
    END IF;

    RAISE NOTICE '✔ TEST 2 PASSED: Performance index idx_ledger_entries_party_created exists.';

    -- --------------------------------------------------------------------------
    -- 3. Insert test ledger entries with varying dates and timestamps
    -- Setup:
    -- Entry 1: 2024-04-10 10:00:00 - Debit ₹50,000 (Invoice 1) -> Running Bal: +50,000 (Dr)
    -- Entry 2: 2024-04-12 14:00:00 - Credit ₹20,000 (Part Payment) -> Running Bal: +30,000 (Dr)
    -- Entry 3: 2024-04-15 09:00:00 - Debit ₹40,000 (Invoice 2) -> Running Bal: +70,000 (Dr)
    -- Entry 4: 2024-04-15 16:30:00 - Credit ₹80,000 (Excess Payment) -> Running Bal: -10,000 (Cr)
    -- --------------------------------------------------------------------------
    INSERT INTO ledger_entries (
        id, business_id, party_id, entry_type, amount, description, entry_date, created_at
    ) VALUES 
    (gen_random_uuid(), v_biz_id, v_party_id, 'debit', 50000.00, 'Invoice 1', '2024-04-10', '2024-04-10 10:00:00+00'),
    (gen_random_uuid(), v_biz_id, v_party_id, 'credit', 20000.00, 'Part Payment', '2024-04-12', '2024-04-12 14:00:00+00'),
    (gen_random_uuid(), v_biz_id, v_party_id, 'debit', 40000.00, 'Invoice 2', '2024-04-15', '2024-04-15 09:00:00+00'),
    (gen_random_uuid(), v_biz_id, v_party_id, 'credit', 80000.00, 'Excess Payment', '2024-04-15', '2024-04-15 16:30:00+00');

    -- --------------------------------------------------------------------------
    -- 4. Query view and verify chronological running balances
    -- --------------------------------------------------------------------------
    SELECT running_balance INTO v_running_bal
    FROM party_running_balances_view
    WHERE business_id = v_biz_id AND party_id = v_party_id AND description = 'Invoice 1';
    IF v_running_bal <> 50000.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Invoice 1 running balance expected 50000.00, got %', v_running_bal;
    END IF;

    SELECT running_balance INTO v_running_bal
    FROM party_running_balances_view
    WHERE business_id = v_biz_id AND party_id = v_party_id AND description = 'Part Payment';
    IF v_running_bal <> 30000.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Part Payment running balance expected 30000.00, got %', v_running_bal;
    END IF;

    -- Same date (2024-04-15) entries: Invoice 2 is earlier (09:00), Excess Payment is later (16:30)
    SELECT running_balance INTO v_running_bal
    FROM party_running_balances_view
    WHERE business_id = v_biz_id AND party_id = v_party_id AND description = 'Invoice 2';
    IF v_running_bal <> 70000.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Invoice 2 running balance expected 70000.00, got %', v_running_bal;
    END IF;

    SELECT running_balance INTO v_running_bal
    FROM party_running_balances_view
    WHERE business_id = v_biz_id AND party_id = v_party_id AND description = 'Excess Payment';
    IF v_running_bal <> -10000.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Excess Payment running balance expected -10000.00, got %', v_running_bal;
    END IF;

    RAISE NOTICE '✔ TEST 3 PASSED: Chronological running balance window function correctly calculates cumulative Dr/Cr balances.';

    -- --------------------------------------------------------------------------
    -- 5. Verify Stored Function: get_party_balance
    -- Total Debit = 90,000, Total Credit = 100,000, Net = -10,000, Dr/Cr = 'Cr'
    -- --------------------------------------------------------------------------
    SELECT * INTO v_summary
    FROM get_party_balance(v_biz_id, v_party_id);

    IF v_summary.total_debit <> 90000.00 OR v_summary.total_credit <> 100000.00 OR v_summary.net_balance <> -10000.00 OR v_summary.dr_cr <> 'Cr' THEN
        RAISE EXCEPTION 'TEST FAILED: get_party_balance mismatch! Got debit: %, credit: %, net: %, dr_cr: %',
            v_summary.total_debit, v_summary.total_credit, v_summary.net_balance, v_summary.dr_cr;
    END IF;

    RAISE NOTICE '✔ TEST 4 PASSED: get_party_balance() returns accurate net closing balance (% % with % entries).',
        ABS(v_summary.net_balance), v_summary.dr_cr, v_summary.entry_count;

    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'ALL RUNNING BALANCE TESTS PASSED SUCCESSFULLY.';
    RAISE NOTICE '=============================================================';
END $$;

ROLLBACK;
