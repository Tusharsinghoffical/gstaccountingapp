-- ==============================================================================
-- GST Ledger: Atomic Payment Recording & Allocation Stored Procedure
-- Reference: 05-BUILD-PROMPTS.md (Prompt 14)
-- Specification: Single transaction ACID execution. If any allocation fails
-- (over-allocation, invalid invoice, non-final status), the entire operation
-- including the payment insertion rolls back completely.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper function: Compute remaining unallocated balance for an invoice
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_invoice_remaining_balance(p_invoice_id UUID)
RETURNS NUMERIC(12, 2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total NUMERIC(12, 2);
    v_allocated NUMERIC(12, 2);
BEGIN
    SELECT total INTO v_total
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RETURN 0.00;
    END IF;

    SELECT COALESCE(SUM(allocated_amount), 0.00) INTO v_allocated
    FROM payment_allocations
    WHERE invoice_id = p_invoice_id;

    RETURN GREATEST(0.00, v_total - v_allocated);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Atomic Stored Procedure: Record Payment with Allocations
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_payment_atomic(
    p_business_id UUID,
    p_party_id UUID,
    p_amount NUMERIC(12, 2),
    p_date DATE,
    p_mode TEXT,
    p_reference_no TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_allocations JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_payment_id UUID;
    v_allocation_elem JSONB;
    v_alloc_inv_id UUID;
    v_alloc_amount NUMERIC(12, 2);
    v_total_allocated NUMERIC(12, 2) := 0.00;
    v_inv_total NUMERIC(12, 2);
    v_inv_status TEXT;
    v_inv_biz_id UUID;
    v_inv_party_id UUID;
    v_inv_no TEXT;
    v_inv_type TEXT;
    v_remaining NUMERIC(12, 2);
    v_party_is_customer BOOLEAN;
BEGIN
    -- 1. Validate payment amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero. Provided: %', p_amount;
    END IF;

    -- 2. Validate payment date
    IF p_date IS NULL THEN
        p_date := CURRENT_DATE;
    END IF;

    -- 3. Validate payment mode
    IF p_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other') THEN
        RAISE EXCEPTION 'Invalid payment mode: %. Allowed modes: cash, bank_transfer, upi, cheque, other', p_mode;
    END IF;

    -- 4. Verify party exists (check customers or suppliers)
    SELECT EXISTS(SELECT 1 FROM customers WHERE id = p_party_id AND business_id = p_business_id) INTO v_party_is_customer;
    IF NOT v_party_is_customer THEN
        IF NOT EXISTS(SELECT 1 FROM suppliers WHERE id = p_party_id AND business_id = p_business_id) THEN
            RAISE EXCEPTION 'Party ID % does not exist in business %', p_party_id, p_business_id;
        END IF;
    END IF;

    -- 5. Insert payment record (starts transaction)
    INSERT INTO payments (
        business_id,
        party_id,
        amount,
        date,
        mode,
        reference_no,
        notes
    )
    VALUES (
        p_business_id,
        p_party_id,
        p_amount,
        p_date,
        p_mode,
        p_reference_no,
        p_notes
    )
    RETURNING id INTO v_payment_id;

    -- 6. Process allocations (if provided)
    IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
        FOR v_allocation_elem IN SELECT * FROM jsonb_array_elements(p_allocations)
        LOOP
            v_alloc_inv_id := (v_allocation_elem->>'invoice_id')::UUID;
            v_alloc_amount := (v_allocation_elem->>'allocated_amount')::NUMERIC(12, 2);

            -- Validate single allocation amount
            IF v_alloc_amount IS NULL OR v_alloc_amount <= 0 THEN
                RAISE EXCEPTION 'Allocated amount must be positive. Provided: % for invoice %',
                    v_alloc_amount, v_alloc_inv_id;
            END IF;

            -- Fetch and lock invoice row to prevent race conditions during concurrent payments
            SELECT total, status, business_id, customer_or_supplier_id, invoice_no, type
            INTO v_inv_total, v_inv_status, v_inv_biz_id, v_inv_party_id, v_inv_no, v_inv_type
            FROM invoices
            WHERE id = v_alloc_inv_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Invoice % not found for payment allocation', v_alloc_inv_id;
            END IF;

            -- Check business tenant isolation
            IF v_inv_biz_id <> p_business_id THEN
                RAISE EXCEPTION 'Cannot allocate payment to an invoice belonging to a different business';
            END IF;

            -- Check party match
            IF v_inv_party_id <> p_party_id THEN
                RAISE EXCEPTION 'Invoice % belongs to counterparty %, not payment counterparty %',
                    v_inv_no, v_inv_party_id, p_party_id;
            END IF;

            -- Only finalized invoices can receive payments
            IF v_inv_status <> 'final' THEN
                RAISE EXCEPTION 'Cannot allocate payment to invoice % in "%" state. Only finalized invoices can receive payment allocations.',
                    v_inv_no, v_inv_status;
            END IF;

            -- Calculate remaining balance
            v_remaining := get_invoice_remaining_balance(v_alloc_inv_id);

            IF v_alloc_amount > v_remaining THEN
                RAISE EXCEPTION 'Allocation of ₹% exceeds remaining balance of ₹% on invoice %',
                    v_alloc_amount, v_remaining, v_inv_no;
            END IF;

            -- Insert payment allocation
            INSERT INTO payment_allocations (
                business_id,
                payment_id,
                invoice_id,
                allocated_amount
            )
            VALUES (
                p_business_id,
                v_payment_id,
                v_alloc_inv_id,
                v_alloc_amount
            );

            v_total_allocated := v_total_allocated + v_alloc_amount;
        END LOOP;

        -- 7. Ensure total allocated does not exceed payment amount
        IF v_total_allocated > p_amount THEN
            RAISE EXCEPTION 'Total allocated amount (₹%) exceeds total payment amount (₹%)',
                v_total_allocated, p_amount;
        END IF;
    END IF;

    -- 8. Post Ledger Entry (Double-entry event log)
    -- Customer payment = credit (reduces customer balance)
    -- Supplier payment = debit (reduces supplier payable)
    INSERT INTO ledger_entries (
        business_id,
        party_id,
        entry_type,
        amount,
        ref_invoice_id,
        notes
    )
    VALUES (
        p_business_id,
        p_party_id,
        CASE WHEN v_party_is_customer THEN 'credit' ELSE 'debit' END,
        p_amount,
        v_alloc_inv_id,
        'Payment recorded via ' || UPPER(p_mode) || COALESCE(' (Ref: ' || p_reference_no || ')', '')
    );

    -- 9. Audit log entry
    INSERT INTO audit_log (
        business_id,
        action,
        table_name,
        record_id,
        diff
    )
    VALUES (
        p_business_id,
        'INSERT',
        'payments',
        v_payment_id,
        jsonb_build_object(
            'amount', p_amount,
            'party_id', p_party_id,
            'mode', p_mode,
            'allocated_total', v_total_allocated
        )
    );

    RETURN v_payment_id;
END;
$$;
