-- ==============================================================================
-- GST Ledger: SQL Verification for Atomic Payment Recording & Allocation
-- Verifies:
-- 1. Partial allocation across multiple open invoices succeeds atomically.
-- 2. Over-allocation exceeding invoice remaining balance aborts & rolls back.
-- 3. Over-allocation exceeding payment amount aborts & rolls back.
-- 4. Allocation against a draft invoice aborts & rolls back.
-- 5. Ledger credit/debit entry is posted atomically.
-- Wrapped in a transaction with ROLLBACK.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_biz_id UUID := gen_random_uuid();
    v_cust_id UUID := gen_random_uuid();
    v_inv1_id UUID := gen_random_uuid();
    v_inv2_id UUID := gen_random_uuid();
    v_draft_id UUID := gen_random_uuid();
    v_payment_id UUID;
    v_payment_count_before INTEGER;
    v_payment_count_after INTEGER;
    v_bal1 NUMERIC(12, 2);
    v_bal2 NUMERIC(12, 2);
    v_caught BOOLEAN;
BEGIN
    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'STARTING ATOMIC PAYMENT & ALLOCATION VERIFICATION TEST';
    RAISE NOTICE '=============================================================';

    -- 1. Setup mock business and customer
    INSERT INTO businesses (id, name, gstin, state_code)
    VALUES (v_biz_id, 'Payment Testing Corp', '27AAPFU0939F1ZV', '27');

    INSERT INTO customers (id, business_id, name, state_code)
    VALUES (v_cust_id, v_biz_id, 'Global Retailers Ltd', '27');

    -- 2. Create 2 finalized invoices
    -- Invoice 1: ₹1,000.00
    INSERT INTO invoices (
        id, business_id, type, customer_or_supplier_id, invoice_date, status, subtotal, total
    )
    VALUES (
        v_inv1_id, v_biz_id, 'sales', v_cust_id, '2025-06-01', 'final', 1000.00, 1000.00
    );

    -- Invoice 2: ₹2,000.00
    INSERT INTO invoices (
        id, business_id, type, customer_or_supplier_id, invoice_date, status, subtotal, total
    )
    VALUES (
        v_inv2_id, v_biz_id, 'sales', v_cust_id, '2025-06-02', 'final', 2000.00, 2000.00
    );

    -- Invoice 3: Draft invoice (₹500.00)
    INSERT INTO invoices (
        id, business_id, type, customer_or_supplier_id, invoice_date, status, subtotal, total
    )
    VALUES (
        v_draft_id, v_biz_id, 'sales', v_cust_id, '2025-06-03', 'draft', 500.00, 500.00
    );

    -- Assert initial balances
    v_bal1 := get_invoice_remaining_balance(v_inv1_id);
    v_bal2 := get_invoice_remaining_balance(v_inv2_id);

    IF v_bal1 <> 1000.00 OR v_bal2 <> 2000.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Initial balances incorrect. Inv 1: %, Inv 2: %', v_bal1, v_bal2;
    END IF;

    -- 3. Execute valid atomic payment with partial allocations
    -- Total payment: ₹1,500
    -- Allocate ₹1,000 to Inv 1 (fully paid), ₹500 to Inv 2 (partially paid, ₹1,500 balance remaining)
    v_payment_id := record_payment_atomic(
        v_biz_id,
        v_cust_id,
        1500.00,
        '2025-06-10',
        'bank_transfer',
        'UTR99887766',
        'Advance part payment',
        jsonb_build_array(
            jsonb_build_object('invoice_id', v_inv1_id, 'allocated_amount', 1000.00),
            jsonb_build_object('invoice_id', v_inv2_id, 'allocated_amount', 500.00)
        )
    );

    -- Assert balances after successful payment
    v_bal1 := get_invoice_remaining_balance(v_inv1_id);
    v_bal2 := get_invoice_remaining_balance(v_inv2_id);

    IF v_bal1 <> 0.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Invoice 1 should be fully paid (0 balance), but found %', v_bal1;
    END IF;

    IF v_bal2 <> 1500.00 THEN
        RAISE EXCEPTION 'TEST FAILED: Invoice 2 should have 1500.00 remaining, but found %', v_bal2;
    END IF;

    -- Assert ledger entry was created
    PERFORM 1 FROM ledger_entries
    WHERE business_id = v_biz_id AND party_id = v_cust_id AND entry_type = 'credit' AND amount = 1500.00;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST FAILED: Customer ledger credit entry was not posted!';
    END IF;

    RAISE NOTICE 'Test passed: Valid payment of 1500.00 with partial allocations recorded successfully.';

    -- 4. Failure Case: Over-allocation on invoice remaining balance
    -- Inv 2 only has 1500.00 balance. Trying to allocate 1600.00 must FAIL and ROLL BACK payment.
    SELECT COUNT(*) INTO v_payment_count_before FROM payments WHERE business_id = v_biz_id;

    v_caught := false;
    BEGIN
        PERFORM record_payment_atomic(
            v_biz_id,
            v_cust_id,
            2000.00,
            '2025-06-11',
            'upi',
            'UPI123456',
            'Invalid over-allocation test',
            jsonb_build_array(
                jsonb_build_object('invoice_id', v_inv2_id, 'allocated_amount', 1600.00)
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed allocation exceeding invoice remaining balance!';
    END IF;

    -- Assert transaction rolled back (payment row was NOT inserted)
    SELECT COUNT(*) INTO v_payment_count_after FROM payments WHERE business_id = v_biz_id;
    IF v_payment_count_after <> v_payment_count_before THEN
        RAISE EXCEPTION 'TEST FAILED: Payment row was not rolled back after allocation failure!';
    END IF;

    RAISE NOTICE 'Test passed: Over-allocation exceeding invoice balance rejected and rolled back.';

    -- 5. Failure Case: Sum of allocations exceeds total payment amount
    -- Payment amount: 500.00, Total allocations: 1000.00. Must FAIL and ROLL BACK.
    v_caught := false;
    BEGIN
        PERFORM record_payment_atomic(
            v_biz_id,
            v_cust_id,
            500.00,
            '2025-06-12',
            'cash',
            NULL,
            'Invalid payment amount allocation',
            jsonb_build_array(
                jsonb_build_object('invoice_id', v_inv2_id, 'allocated_amount', 1000.00)
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed allocations exceeding total payment amount!';
    END IF;

    SELECT COUNT(*) INTO v_payment_count_after FROM payments WHERE business_id = v_biz_id;
    IF v_payment_count_after <> v_payment_count_before THEN
        RAISE EXCEPTION 'TEST FAILED: Payment row was not rolled back after allocation failure!';
    END IF;

    RAISE NOTICE 'Test passed: Allocations exceeding payment amount rejected and rolled back.';

    -- 6. Failure Case: Attempting to allocate against a draft invoice
    v_caught := false;
    BEGIN
        PERFORM record_payment_atomic(
            v_biz_id,
            v_cust_id,
            500.00,
            '2025-06-13',
            'bank_transfer',
            NULL,
            'Draft invoice allocation test',
            jsonb_build_array(
                jsonb_build_object('invoice_id', v_draft_id, 'allocated_amount', 500.00)
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed allocation against a draft invoice!';
    END IF;

    SELECT COUNT(*) INTO v_payment_count_after FROM payments WHERE business_id = v_biz_id;
    IF v_payment_count_after <> v_payment_count_before THEN
        RAISE EXCEPTION 'TEST FAILED: Payment row was not rolled back after draft allocation failure!';
    END IF;

    RAISE NOTICE 'Test passed: Allocation against draft invoice rejected and rolled back.';

    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'ALL ATOMIC PAYMENT & ALLOCATION TESTS PASSED!';
    RAISE NOTICE '=============================================================';
END $$;

ROLLBACK;
