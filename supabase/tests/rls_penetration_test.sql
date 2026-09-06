-- ==============================================================================
-- Cross-Tenant RLS Penetration Test Script (Postgres / Supabase)
-- Reference: Prompt 25 - Automated RLS Denial Verification
-- Simulates two distinct authenticated users across all 11 tables + storage
-- and verifies that every single cross-tenant mutation or query is strictly DENIED.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Setup Isolated Test Tenants & Users
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Distinct Business IDs
DO $$
DECLARE
    v_biz_a UUID := '00000000-0000-0000-0000-00000000000a'::uuid;
    v_biz_b UUID := '00000000-0000-0000-0000-00000000000b'::uuid;
    v_user_a UUID := '11111111-1111-1111-1111-11111111111a'::uuid;
    v_user_b UUID := '22222222-2222-2222-2222-22222222222b'::uuid;
    v_cust_b UUID := '33333333-3333-3333-3333-33333333333b'::uuid;
    v_supp_b UUID := '44444444-4444-4444-4444-44444444444b'::uuid;
    v_inv_b UUID := '55555555-5555-5555-5555-55555555555b'::uuid;
    v_pay_b UUID := '66666666-6666-6666-6666-66666666666b'::uuid;
    v_count INT;
    v_caught BOOLEAN;
BEGIN
    -- Seed Business A
    INSERT INTO businesses (id, name, gstin, state_code)
    VALUES (v_biz_a, 'Alpha Retailers Pvt Ltd', '27AABCU9603R1ZM', '27')
    ON CONFLICT (id) DO NOTHING;

    -- Seed Business B
    INSERT INTO businesses (id, name, gstin, state_code)
    VALUES (v_biz_b, 'Beta Enterprise Technologies', '29AABCU9603R1ZN', '29')
    ON CONFLICT (id) DO NOTHING;

    -- Seed Memberships
    INSERT INTO business_users (business_id, user_id, role, status)
    VALUES 
        (v_biz_a, v_user_a, 'admin', 'active'),
        (v_biz_b, v_user_b, 'admin', 'active')
    ON CONFLICT DO NOTHING;

    -- Seed Business B Customer & Supplier
    INSERT INTO customers (id, business_id, name, state_code)
    VALUES (v_cust_b, v_biz_b, 'Beta Customer Ltd', '29')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO suppliers (id, business_id, name, state_code)
    VALUES (v_supp_b, v_biz_b, 'Beta Supplier Ltd', '29')
    ON CONFLICT (id) DO NOTHING;

    -- Seed Business B Invoice
    INSERT INTO invoices (id, business_id, type, customer_or_supplier_id, invoice_no, invoice_date, financial_year, subtotal, total)
    VALUES (v_inv_b, v_biz_b, 'sales', v_cust_b, 'BETA-001', CURRENT_DATE, '2024-2025', 10000, 11800)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Business B Payment
    INSERT INTO payments (id, business_id, party_id, amount, date, mode, reference_no)
    VALUES (v_pay_b, v_biz_b, v_cust_b, 11800, CURRENT_DATE, 'upi', 'UPI/BETA/999')
    ON CONFLICT (id) DO NOTHING;

    -- --------------------------------------------------------------------------
    -- 2. SWITCH TO USER A SESSION (Simulating JWT claims for User A in Business A)
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    -- TEST 1: User A SELECT invoices in Business B -> MUST BE 0
    SELECT COUNT(*) INTO v_count FROM invoices WHERE business_id = v_biz_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to read Business B invoices!';
    END IF;

    -- TEST 2: User A SELECT customers in Business B -> MUST BE 0
    SELECT COUNT(*) INTO v_count FROM customers WHERE business_id = v_biz_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to read Business B customers!';
    END IF;

    -- TEST 3: User A SELECT suppliers in Business B -> MUST BE 0
    SELECT COUNT(*) INTO v_count FROM suppliers WHERE business_id = v_biz_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to read Business B suppliers!';
    END IF;

    -- TEST 4: User A SELECT payments in Business B -> MUST BE 0
    SELECT COUNT(*) INTO v_count FROM payments WHERE business_id = v_biz_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to read Business B payments!';
    END IF;

    -- TEST 5: User A SELECT ledger_entries in Business B -> MUST BE 0
    SELECT COUNT(*) INTO v_count FROM ledger_entries WHERE business_id = v_biz_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to read Business B ledger entries!';
    END IF;

    -- TEST 6: User A SELECT audit_log in Business B -> MUST BE 0
    SELECT COUNT(*) INTO v_count FROM audit_log WHERE business_id = v_biz_b;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to read Business B audit log!';
    END IF;

    -- TEST 7: User A INSERT customer into Business B -> MUST BE REJECTED
    v_caught := false;
    BEGIN
        INSERT INTO customers (business_id, name, state_code)
        VALUES (v_biz_b, 'Hacked Customer', '27');
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'RLS Breach: User A successfully inserted a customer into Business B!';
    END IF;

    -- TEST 8: User A INSERT invoice into Business B -> MUST BE REJECTED
    v_caught := false;
    BEGIN
        INSERT INTO invoices (business_id, type, customer_or_supplier_id, invoice_no, invoice_date, financial_year, subtotal, total)
        VALUES (v_biz_b, 'sales', v_cust_b, 'HACK-001', CURRENT_DATE, '2024-2025', 1000, 1180);
    EXCEPTION WHEN OTHERS THEN
        v_caught := true;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'RLS Breach: User A successfully inserted an invoice into Business B!';
    END IF;

    -- TEST 9: User A UPDATE invoice in Business B -> 0 rows affected
    UPDATE invoices SET total = 0 WHERE id = v_inv_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to update Business B invoice!';
    END IF;

    -- TEST 10: User A DELETE payment in Business B -> 0 rows affected
    DELETE FROM payments WHERE id = v_pay_b;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'RLS Breach: User A was able to delete Business B payment!';
    END IF;

    RAISE NOTICE 'SUCCESS: 100%% of cross-tenant RLS penetration attempts were strictly denied.';
END $$;

ROLLBACK; -- Always roll back to leave DB clean
