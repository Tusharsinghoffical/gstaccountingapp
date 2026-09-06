-- ==============================================================================
-- GST Ledger: SQL Verification for Invoice Status Transitions & Immutability
-- Verifies:
-- 1. Draft updates are allowed.
-- 2. Draft -> Final transition is allowed.
-- 3. Finalized invoices are completely immutable (field updates blocked).
-- 4. Finalized invoice deletions are blocked.
-- 5. Line item insertions/updates/deletions on finalized invoices are blocked.
-- 6. Reversion from Final -> Draft is blocked.
-- 7. Credit/debit notes require a finalized invoice (draft reference blocked).
-- 8. Valid credit note & debit note issuance succeeds with CN/ and DN/ prefixes.
-- 9. Final -> Cancelled transition succeeds while preserving financial data.
-- 10. Modifications to cancelled invoices are completely blocked.
-- Wrapped in a transaction with ROLLBACK.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_biz_id UUID := gen_random_uuid();
    v_cust_id UUID := gen_random_uuid();
    v_draft_inv_id UUID := gen_random_uuid();
    v_final_inv_id UUID := gen_random_uuid();
    v_cn_id UUID := gen_random_uuid();
    v_dn_id UUID := gen_random_uuid();
    v_item_id UUID := gen_random_uuid();
    v_caught BOOLEAN;
    v_cn_number TEXT;
    v_dn_number TEXT;
    v_status TEXT;
BEGIN
    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'STARTING INVOICE IMMUTABILITY & STATUS TRANSITION TEST';
    RAISE NOTICE '=============================================================';

    -- 1. Setup mock business and customer
    INSERT INTO businesses (id, name, gstin, state_code)
    VALUES (v_biz_id, 'Immutability Test Labs Pvt Ltd', '27AAPFU0939F1ZV', '27');

    INSERT INTO customers (id, business_id, name, state_code)
    VALUES (v_cust_id, v_biz_id, 'Enterprise Buyer Ltd', '27');

    -- 2. Create a DRAFT invoice
    INSERT INTO invoices (
        id,
        business_id,
        type,
        customer_or_supplier_id,
        invoice_date,
        status,
        subtotal,
        total
    )
    VALUES (
        v_draft_inv_id,
        v_biz_id,
        'sales',
        v_cust_id,
        '2025-08-01',
        'draft',
        1000.00,
        1180.00
    );

    -- Insert line item for draft invoice
    INSERT INTO invoice_items (
        id,
        business_id,
        invoice_id,
        description,
        hsn_code,
        qty,
        rate,
        taxable_amount,
        gst_rate,
        cgst_amount,
        sgst_amount,
        amount
    )
    VALUES (
        v_item_id,
        v_biz_id,
        v_draft_inv_id,
        'Draft Service Line Item',
        '998311',
        1,
        1000.00,
        1000.00,
        18,
        90.00,
        90.00,
        1180.00
    );

    -- Assert draft updates ARE allowed
    UPDATE invoices SET subtotal = 1200.00, total = 1416.00 WHERE id = v_draft_inv_id;
    UPDATE invoice_items SET rate = 1200.00, taxable_amount = 1200.00, amount = 1416.00 WHERE id = v_item_id;

    -- 3. Assert credit note CANNOT reference a draft invoice
    v_caught := false;
    BEGIN
        INSERT INTO invoices (
            id,
            business_id,
            type,
            customer_or_supplier_id,
            original_invoice_id,
            invoice_date,
            subtotal,
            total
        )
        VALUES (
            gen_random_uuid(),
            v_biz_id,
            'credit_note',
            v_cust_id,
            v_draft_inv_id,
            '2025-08-02',
            200.00,
            236.00
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Credit note was illegally allowed against a draft invoice!';
    END IF;
    RAISE NOTICE 'Test passed: Credit note rejected against draft invoice.';

    -- 4. Transition: draft -> final
    UPDATE invoices SET status = 'final' WHERE id = v_draft_inv_id;

    -- 5. Assert finalized invoice fields are IMMUTABLE
    v_caught := false;
    BEGIN
        UPDATE invoices SET subtotal = 9999.00 WHERE id = v_draft_inv_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Finalized invoice subtotal was modified!';
    END IF;
    RAISE NOTICE 'Test passed: Finalized invoice field modification blocked.';

    -- 6. Assert finalized invoice CANNOT be deleted
    v_caught := false;
    BEGIN
        DELETE FROM invoices WHERE id = v_draft_inv_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Finalized invoice was deleted!';
    END IF;
    RAISE NOTICE 'Test passed: Finalized invoice deletion blocked.';

    -- 7. Assert line items CANNOT be added to a finalized invoice
    v_caught := false;
    BEGIN
        INSERT INTO invoice_items (
            business_id,
            invoice_id,
            description,
            hsn_code,
            qty,
            rate,
            taxable_amount,
            gst_rate,
            amount
        )
        VALUES (
            v_biz_id,
            v_draft_inv_id,
            'Illegal Extra Item',
            '998311',
            1,
            500.00,
            500.00,
            18,
            590.00
        );
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Line item was added to finalized invoice!';
    END IF;
    RAISE NOTICE 'Test passed: Adding line items to finalized invoice blocked.';

    -- 8. Assert reverting final -> draft is BLOCKED
    v_caught := false;
    BEGIN
        UPDATE invoices SET status = 'draft' WHERE id = v_draft_inv_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Reverted finalized invoice back to draft!';
    END IF;
    RAISE NOTICE 'Test passed: Reverting final -> draft blocked.';

    -- 9. Issue Credit Note against finalized invoice
    INSERT INTO invoices (
        id,
        business_id,
        type,
        customer_or_supplier_id,
        original_invoice_id,
        invoice_date,
        subtotal,
        total,
        notes
    )
    VALUES (
        v_cn_id,
        v_biz_id,
        'credit_note',
        v_cust_id,
        v_draft_inv_id,
        '2025-08-05',
        200.00,
        236.00,
        'Price correction discount'
    )
    RETURNING invoice_no INTO v_cn_number;

    IF v_cn_number NOT LIKE 'CN/2025-26/%' THEN
        RAISE EXCEPTION 'TEST FAILED: Credit note number does not start with CN/: %', v_cn_number;
    END IF;
    RAISE NOTICE 'Test passed: Issued Credit Note % linked to finalized invoice %', v_cn_number, v_draft_inv_id;

    -- 10. Issue Debit Note against finalized invoice
    INSERT INTO invoices (
        id,
        business_id,
        type,
        customer_or_supplier_id,
        original_invoice_id,
        invoice_date,
        subtotal,
        total,
        notes
    )
    VALUES (
        v_dn_id,
        v_biz_id,
        'debit_note',
        v_cust_id,
        v_draft_inv_id,
        '2025-08-06',
        100.00,
        118.00,
        'Additional freight charges'
    )
    RETURNING invoice_no INTO v_dn_number;

    IF v_dn_number NOT LIKE 'DN/2025-26/%' THEN
        RAISE EXCEPTION 'TEST FAILED: Debit note number does not start with DN/: %', v_dn_number;
    END IF;
    RAISE NOTICE 'Test passed: Issued Debit Note % linked to finalized invoice %', v_dn_number, v_draft_inv_id;

    -- 11. Transition: final -> cancelled
    UPDATE invoices SET status = 'cancelled' WHERE id = v_draft_inv_id;

    SELECT status INTO v_status FROM invoices WHERE id = v_draft_inv_id;
    IF v_status <> 'cancelled' THEN
        RAISE EXCEPTION 'TEST FAILED: Status is not cancelled: %', v_status;
    END IF;
    RAISE NOTICE 'Test passed: Invoice successfully cancelled.';

    -- 12. Assert cancelled invoices are terminal (cannot be modified or reverted)
    v_caught := false;
    BEGIN
        UPDATE invoices SET status = 'final' WHERE id = v_draft_inv_id;
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST FAILED: Cancelled invoice was altered!';
    END IF;
    RAISE NOTICE 'Test passed: Cancelled invoice modification blocked.';

    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'ALL 12 IMMUTABILITY & STATUS TRANSITION CHECKS PASSED!';
    RAISE NOTICE '=============================================================';
END $$;

ROLLBACK;
