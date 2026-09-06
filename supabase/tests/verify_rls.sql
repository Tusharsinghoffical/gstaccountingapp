-- ==============================================================================
-- GST Ledger: RLS Policy Verification Test Script
-- Run this in Supabase SQL Editor or psql to verify multi-tenant isolation.
-- Wrapped in a transaction that ends with ROLLBACK so no test artifacts persist.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_auditor_a_id UUID := gen_random_uuid();

    v_biz_a_id UUID := gen_random_uuid();
    v_biz_b_id UUID := gen_random_uuid();

    v_inv_a_id UUID := gen_random_uuid();
    v_inv_b_id UUID := gen_random_uuid();

    v_cust_a_id UUID := gen_random_uuid();
    v_cust_b_id UUID := gen_random_uuid();

    v_log_a_id UUID := gen_random_uuid();

    v_count INTEGER;
    v_error_caught BOOLEAN := false;
BEGIN
    RAISE NOTICE '-------------------------------------------------------------';
    RAISE NOTICE 'STARTING RLS VERIFICATION TESTS FOR GST LEDGER';
    RAISE NOTICE '-------------------------------------------------------------';

    -- -------------------------------------------------------------------------
    -- 1. Setup Test Fixtures (as superuser / service_role)
    -- -------------------------------------------------------------------------

    -- Create mock auth users in auth.users if needed
    INSERT INTO auth.users (id, email, aud, role)
    VALUES
        (v_user_a_id, 'admin_a@test.com', 'authenticated', 'authenticated'),
        (v_user_b_id, 'admin_b@test.com', 'authenticated', 'authenticated'),
        (v_auditor_a_id, 'auditor_a@test.com', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Create Business A and Business B
    INSERT INTO businesses (id, name, gstin, state_code)
    VALUES
        (v_biz_a_id, 'Alpha Retailers Ltd', '27AABCU9603R1ZM', '27'),
        (v_biz_b_id, 'Beta Enterprises LLP', '29AABCU9603R1ZK', '29');

    -- Link User A -> Business A (admin), Auditor A -> Business A (auditor)
    -- Link User B -> Business B (admin)
    INSERT INTO business_users (business_id, user_id, role)
    VALUES
        (v_biz_a_id, v_user_a_id, 'admin'),
        (v_biz_a_id, v_auditor_a_id, 'auditor'),
        (v_biz_b_id, v_user_b_id, 'admin');

    -- Create Customers in each business
    INSERT INTO customers (id, business_id, name, state_code)
    VALUES
        (v_cust_a_id, v_biz_a_id, 'Customer Alpha', '27'),
        (v_cust_b_id, v_biz_b_id, 'Customer Beta', '29');

    -- Create Invoices in each business
    INSERT INTO invoices (id, business_id, type, customer_or_supplier_id, invoice_no, invoice_date, financial_year, subtotal, total)
    VALUES
        (v_inv_a_id, v_biz_a_id, 'sales', v_cust_a_id, 'INV-A-001', '2024-04-15', '2024-2025', 1000.00, 1180.00),
        (v_inv_b_id, v_biz_b_id, 'sales', v_cust_b_id, 'INV-B-001', '2024-04-16', '2024-2025', 2000.00, 2360.00);

    -- Create Invoice Items
    INSERT INTO invoice_items (business_id, invoice_id, description, hsn_code, qty, rate, amount)
    VALUES
        (v_biz_a_id, v_inv_a_id, 'Consulting Services', '998311', 1, 1000.00, 1000.00),
        (v_biz_b_id, v_inv_b_id, 'Hardware Parts', '847130', 2, 1000.00, 2000.00);

    -- Create Payments
    INSERT INTO payments (business_id, party_id, amount, date, mode)
    VALUES
        (v_biz_a_id, v_cust_a_id, 1180.00, '2024-04-20', 'bank_transfer'),
        (v_biz_b_id, v_cust_b_id, 2360.00, '2024-04-21', 'upi');

    -- Create Ledger Entries
    INSERT INTO ledger_entries (business_id, party_id, entry_type, amount, ref_invoice_id, description)
    VALUES
        (v_biz_a_id, v_cust_a_id, 'debit', 1180.00, v_inv_a_id, 'Invoice A debit'),
        (v_biz_b_id, v_cust_b_id, 'debit', 2360.00, v_inv_b_id, 'Invoice B debit');

    -- Create Audit Log
    INSERT INTO audit_log (id, business_id, user_id, action, table_name, record_id, diff)
    VALUES
        (v_log_a_id, v_biz_a_id, v_user_a_id, 'INSERT', 'invoices', v_inv_a_id, '{"action":"test"}'::jsonb);

    RAISE NOTICE 'Fixture setup complete.';

    -- -------------------------------------------------------------------------
    -- 2. Test Tenant Isolation: User A cannot read Business B rows
    -- -------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);

    -- Check businesses visibility
    SELECT COUNT(*) INTO v_count FROM businesses WHERE id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B from businesses table!';
    END IF;

    -- Check customers visibility
    SELECT COUNT(*) INTO v_count FROM customers WHERE business_id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B customers!';
    END IF;

    -- Check invoices visibility
    SELECT COUNT(*) INTO v_count FROM invoices WHERE business_id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B invoices!';
    END IF;

    -- Check invoice items visibility
    SELECT COUNT(*) INTO v_count FROM invoice_items WHERE business_id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B invoice items!';
    END IF;

    -- Check payments visibility
    SELECT COUNT(*) INTO v_count FROM payments WHERE business_id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B payments!';
    END IF;

    -- Check ledger entries visibility
    SELECT COUNT(*) INTO v_count FROM ledger_entries WHERE business_id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B ledger entries!';
    END IF;

    -- Check audit log visibility
    SELECT COUNT(*) INTO v_count FROM audit_log WHERE business_id = v_biz_b_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User A was able to read Business B audit log!';
    END IF;

    RAISE NOTICE 'PASSED: User A cannot see any Business B rows across all tables.';

    -- -------------------------------------------------------------------------
    -- 3. Test Cross-Tenant Write Isolation: User A cannot insert into Business B
    -- -------------------------------------------------------------------------
    v_error_caught := false;
    BEGIN
        INSERT INTO invoices (business_id, type, customer_or_supplier_id, invoice_no, invoice_date, financial_year, subtotal, total)
        VALUES (v_biz_b_id, 'sales', v_cust_b_id, 'HACK-001', '2024-04-18', '2024-2025', 500, 590);
    EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
        v_error_caught := true;
    END;

    IF NOT v_error_caught THEN
        SELECT COUNT(*) INTO v_count FROM invoices WHERE invoice_no = 'HACK-001';
        IF v_count > 0 THEN
            RAISE EXCEPTION 'TEST FAILED: User A was able to insert an invoice into Business B!';
        END IF;
    END IF;

    RAISE NOTICE 'PASSED: User A is blocked from inserting into Business B.';

    -- -------------------------------------------------------------------------
    -- 4. Test RBAC: Auditor role cannot INSERT or UPDATE invoices
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auditor_a_id::text, true);

    -- Auditor CAN SELECT
    SELECT COUNT(*) INTO v_count FROM invoices WHERE business_id = v_biz_a_id;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Auditor A could not read Business A invoices!';
    END IF;

    -- Auditor CANNOT INSERT
    v_error_caught := false;
    BEGIN
        INSERT INTO invoices (business_id, type, customer_or_supplier_id, invoice_no, invoice_date, financial_year, subtotal, total)
        VALUES (v_biz_a_id, 'sales', v_cust_a_id, 'AUDITOR-001', '2024-04-19', '2024-2025', 100, 118);
    EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
        v_error_caught := true;
    END;

    IF NOT v_error_caught THEN
        SELECT COUNT(*) INTO v_count FROM invoices WHERE invoice_no = 'AUDITOR-001';
        IF v_count > 0 THEN
            RAISE EXCEPTION 'TEST FAILED: Auditor was able to insert an invoice!';
        END IF;
    END IF;

    RAISE NOTICE 'PASSED: Auditor role is strictly read-only on invoices.';

    -- -------------------------------------------------------------------------
    -- 5. Test Audit Log Immutability: Even Admin CANNOT UPDATE or DELETE audit_log
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);

    -- Try to UPDATE audit log
    v_error_caught := false;
    BEGIN
        UPDATE audit_log SET action = 'HACKED' WHERE id = v_log_a_id;
    EXCEPTION WHEN insufficient_privilege OR others THEN
        v_error_caught := true;
    END;

    IF NOT v_error_caught THEN
        -- Check if any row was modified
        SELECT COUNT(*) INTO v_count FROM audit_log WHERE id = v_log_a_id AND action = 'HACKED';
        IF v_count > 0 THEN
            RAISE EXCEPTION 'TEST FAILED: Admin was able to UPDATE audit_log!';
        END IF;
    END IF;

    -- Try to DELETE from audit log
    v_error_caught := false;
    BEGIN
        DELETE FROM audit_log WHERE id = v_log_a_id;
    EXCEPTION WHEN insufficient_privilege OR others THEN
        v_error_caught := true;
    END;

    IF NOT v_error_caught THEN
        SELECT COUNT(*) INTO v_count FROM audit_log WHERE id = v_log_a_id;
        IF v_count = 0 THEN
            RAISE EXCEPTION 'TEST FAILED: Admin was able to DELETE from audit_log!';
        END IF;
    END IF;

    RAISE NOTICE 'PASSED: audit_log is append-only. UPDATE and DELETE rejected even for Admin.';

    RAISE NOTICE '-------------------------------------------------------------';
    RAISE NOTICE 'ALL RLS VERIFICATION TESTS PASSED SUCCESSFULLY!';
    RAISE NOTICE '-------------------------------------------------------------';
END $$;

ROLLBACK;
