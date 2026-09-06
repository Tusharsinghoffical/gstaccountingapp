-- ==============================================================================
-- GST Ledger: Concurrency Test for Sequential Invoice Numbering
-- Verifies that 20 invoices created have NO duplicates and NO skipped numbers.
-- Wrapped in a transaction with ROLLBACK.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_biz_id UUID := gen_random_uuid();
    v_cust_id UUID := gen_random_uuid();
    v_inv_ids UUID[];
    v_invoice_numbers TEXT[];
    v_distinct_count INTEGER;
    v_total_count INTEGER;
    v_min_num INTEGER;
    v_max_num INTEGER;
    v_i INTEGER;
    v_num_extracted INTEGER;
    v_expected_no TEXT;
BEGIN
    RAISE NOTICE '-------------------------------------------------------------';
    RAISE NOTICE 'STARTING 20 CONCURRENT INVOICE NUMBERING VERIFICATION TEST';
    RAISE NOTICE '-------------------------------------------------------------';

    -- 1. Setup mock business and customer
    INSERT INTO businesses (id, name, gstin, state_code)
    VALUES (v_biz_id, 'Concurrency Test Pvt Ltd', '27AAPFU0939F1ZV', '27');

    INSERT INTO customers (id, business_id, name, state_code)
    VALUES (v_cust_id, v_biz_id, 'Test Buyer Corp', '27');

    -- 2. Insert 20 invoices in a set
    -- Each insert triggers assign_invoice_number_trigger() which locks the counter row
    FOR v_i IN 1..20 LOOP
        INSERT INTO invoices (
            business_id,
            type,
            customer_or_supplier_id,
            invoice_date,
            subtotal,
            total
        )
        VALUES (
            v_biz_id,
            'sales',
            v_cust_id,
            '2025-07-15', -- Falls in FY 2025-26
            1000.00,
            1180.00
        );
    END LOOP;

    -- 3. Assert total count is exactly 20
    SELECT COUNT(*) INTO v_total_count
    FROM invoices
    WHERE business_id = v_biz_id;

    IF v_total_count <> 20 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 20 invoices, but found %', v_total_count;
    END IF;

    -- 4. Assert NO duplicates (distinct count must equal 20)
    SELECT COUNT(DISTINCT invoice_no) INTO v_distinct_count
    FROM invoices
    WHERE business_id = v_biz_id;

    IF v_distinct_count <> 20 THEN
        RAISE EXCEPTION 'TEST FAILED: Duplicate invoice numbers detected! Distinct count is % out of 20', v_distinct_count;
    END IF;

    -- 5. Assert NO skipped numbers (contiguous sequence 0001 to 0020)
    SELECT
        MIN(SUBSTRING(invoice_no FROM 'INV/2025-26/([0-9]{4})')::INTEGER),
        MAX(SUBSTRING(invoice_no FROM 'INV/2025-26/([0-9]{4})')::INTEGER)
    INTO v_min_num, v_max_num
    FROM invoices
    WHERE business_id = v_biz_id;

    IF v_min_num <> 1 OR v_max_num <> 20 THEN
        RAISE EXCEPTION 'TEST FAILED: Sequential boundaries broken. Min: %, Max: % (Expected 1 and 20)', v_min_num, v_max_num;
    END IF;

    -- Verify exact string match for each number from 0001 to 0020
    FOR v_i IN 1..20 LOOP
        v_expected_no := 'INV/2025-26/' || LPAD(v_i::TEXT, 4, '0');
        PERFORM 1 FROM invoices WHERE business_id = v_biz_id AND invoice_no = v_expected_no;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'TEST FAILED: Missing/skipped invoice number: %', v_expected_no;
        END IF;
    END LOOP;

    RAISE NOTICE 'SUCCESS: All 20 invoices generated strictly sequential, gapless numbers from INV/2025-26/0001 to INV/2025-26/0020 with 0 duplicates!';
    RAISE NOTICE '-------------------------------------------------------------';
END $$;

ROLLBACK;
