-- ==============================================================================
-- GST Ledger: Core Database Schema Migration
-- Reference: 03-ARCHITECTURE.md (Section 4) & 02-REQUIREMENTS.md
-- AWS-Free Stack: Supabase (Postgres + Auth + Storage + RLS)
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Helper trigger function for updating updated_at timestamp
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Businesses (Tenant Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gstin VARCHAR(15) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    legal_name TEXT,
    trade_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    pincode VARCHAR(6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_business_state_code CHECK (state_code ~ '^[0-9]{2}$'),
    CONSTRAINT chk_business_gstin CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
);

CREATE INDEX IF NOT EXISTS idx_businesses_gstin ON businesses(gstin);

CREATE TRIGGER trg_businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. Business Users (RBAC mapping: Admin, Accountant, Auditor)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'auditor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_user UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_users_business ON business_users(business_id);
CREATE INDEX IF NOT EXISTS idx_business_users_user ON business_users(user_id);
CREATE INDEX IF NOT EXISTS idx_business_users_lookup ON business_users(user_id, business_id, role);

-- ------------------------------------------------------------------------------
-- 4. Customers (Sales counterparties)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gstin VARCHAR(15),
    state_code VARCHAR(2) NOT NULL,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    shipping_address TEXT,
    pan VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_customer_state_code CHECK (state_code ~ '^[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON customers(business_id, name);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. Suppliers (Purchase counterparties / vendors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gstin VARCHAR(15),
    state_code VARCHAR(2) NOT NULL,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    pan VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_supplier_state_code CHECK (state_code ~ '^[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_business_name ON suppliers(business_id, name);

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. Invoices (Sales and Purchase headers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sales', 'purchase')),
    customer_or_supplier_id UUID NOT NULL,
    invoice_no TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'final', 'cancelled')) DEFAULT 'draft',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    financial_year VARCHAR(9) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invoice_number_per_business UNIQUE (business_id, type, financial_year, invoice_no),
    CONSTRAINT chk_invoice_amounts CHECK (
        subtotal >= 0 AND
        cgst >= 0 AND
        sgst >= 0 AND
        igst >= 0 AND
        total >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(business_id, customer_or_supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(business_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_type_status ON invoices(business_id, type, status);
CREATE INDEX IF NOT EXISTS idx_invoices_fy ON invoices(business_id, financial_year);

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. Invoice Items (Line items with direct business_id for RLS performance)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    hsn_code VARCHAR(10) NOT NULL,
    qty NUMERIC(12, 3) NOT NULL DEFAULT 1.000 CHECK (qty > 0),
    rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (taxable_amount >= 0),
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (gst_rate >= 0),
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cgst_amount >= 0),
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (sgst_amount >= 0),
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (igst_amount >= 0),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_business ON invoice_items(business_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_hsn ON invoice_items(business_id, hsn_code);

-- ------------------------------------------------------------------------------
-- 8. Payments (Payments made or received)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    party_id UUID NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
    reference_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(business_id, party_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(business_id, date DESC);

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 9. Payment Allocations (Mapping payments to invoices)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_invoice_allocation UNIQUE (payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_business ON payment_allocations(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);

-- ------------------------------------------------------------------------------
-- 10. Ledger Entries (Double-entry event log for customer/supplier ledgers)
-- Note: Balances are derived by summing debit/credit entries, never stored mutably.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    party_id UUID NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    ref_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    ref_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    description TEXT,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_business ON ledger_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_party ON ledger_entries(business_id, party_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ref_invoice ON ledger_entries(ref_invoice_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ref_payment ON ledger_entries(ref_payment_id);

-- ------------------------------------------------------------------------------
-- 11. Audit Log (Append-only audit trail for all financial mutations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'RECONCILE', 'SYSTEM')),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    diff JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_business ON audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(business_id, table_name, record_id);

-- ------------------------------------------------------------------------------
-- 12. Tax Rate Config (Versioned HSN GST rate rules, effective date ranges)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rate_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, -- NULL indicates global/system default
    hsn_code VARCHAR(10) NOT NULL,
    description TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL CHECK (gst_rate >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_tax_rate_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tax_rate_lookup ON tax_rate_config(hsn_code, effective_from);
CREATE INDEX IF NOT EXISTS idx_tax_rate_business ON tax_rate_config(business_id);

-- Seed standard Indian GST rate slabs (0%, 5%, 12%, 18%, 28%)
INSERT INTO tax_rate_config (business_id, hsn_code, description, gst_rate, effective_from, effective_to)
VALUES
    (NULL, 'DEFAULT_0', 'Exempt / Nil Rated Goods and Services', 0.00, '2017-07-01', NULL),
    (NULL, 'DEFAULT_5', 'Standard Lower Rate 5% (Essential commodities)', 5.00, '2017-07-01', NULL),
    (NULL, 'DEFAULT_12', 'Standard Concessional Rate 12%', 12.00, '2017-07-01', NULL),
    (NULL, 'DEFAULT_18', 'Standard Rate 18% (General goods and services)', 18.00, '2017-07-01', NULL),
    (NULL, 'DEFAULT_28', 'Standard Peak Rate 28% (Luxury / sin goods)', 28.00, '2017-07-01', NULL)
ON CONFLICT DO NOTHING;
