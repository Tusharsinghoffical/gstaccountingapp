# Requirements Specification
## GST Ledger — Functional & Non-Functional Requirements

---

## 1. Functional Requirements (FR)

### FR-1: Authentication & Multi-Tenancy
- FR-1.1: Email/password + OTP-based signup/login (Supabase Auth)
- FR-1.2: Each user belongs to one or more `businesses` (tenant boundary)
- FR-1.3: Role assignment per business: `admin`, `accountant`, `auditor` (read-only)
- FR-1.4: Business switcher UI for users belonging to multiple businesses (CA use case)

### FR-2: Invoicing (Sales & Purchase)
- FR-2.1: Create invoice with line items (item, HSN/SAC code, qty, rate, discount)
- FR-2.2: Auto-calculate GST split: CGST+SGST (intra-state) vs IGST (inter-state) based on business state code vs customer state code
- FR-2.3: Support GST rate slabs: 0%, 5%, 12%, 18%, 28% — configurable per line item via HSN lookup or manual override
- FR-2.4: Generate invoice PDF (GST-compliant format: invoice no., GSTIN, HSN summary, tax breakup)
- FR-2.5: Invoice numbering: sequential, per-financial-year, per-business (cannot skip/duplicate — GST audit requirement)
- FR-2.6: Draft → Finalized → Cancelled states (finalized invoices are immutable; corrections via credit/debit notes only)

### FR-3: OCR-Based Invoice Ingestion
- FR-3.1: User uploads photo/PDF of a purchase invoice
- FR-3.2: System extracts: vendor name, GSTIN, invoice number, date, line items, tax amounts
- FR-3.3: Extracted data shown in an editable review form — **never auto-committed** (see PRD Risk table)
- FR-3.4: On confirm, creates a purchase invoice + updates supplier ledger

### FR-4: Ledger & Payments
- FR-4.1: Running balance per customer/supplier, computed from invoice + payment entries (never stored as a mutable field — always derived/recalculated to avoid drift)
- FR-4.2: Record payment (full/partial), allocate against one or more open invoices
- FR-4.3: Cash & bank ledger — manual entries + auto-entries from payment allocation

### FR-5: Reporting
- FR-5.1: GSTR-1 summary report (B2B/B2C split, HSN-wise summary, tax rate-wise summary)
- FR-5.2: Outstanding/ageing report (0-30 / 31-60 / 61-90 / 90+ days buckets)
- FR-5.3: P&L snapshot (revenue, expense, tax collected vs tax paid — Input Tax Credit view)
- FR-5.4: Export all reports as XLSX and PDF

### FR-6: Customer/Supplier Management
- FR-6.1: CRUD for customers/suppliers with GSTIN validation (format + checksum, not live GSTN lookup in v1)
- FR-6.2: Contact info, billing address, state code (derived from GSTIN for tax-split logic)

### FR-7: Role-Based Access Control
- FR-7.1: `admin` — full CRUD across all modules
- FR-7.2: `accountant` — CRUD on invoices/payments/ledger, no user-management access
- FR-7.3: `auditor` — read-only across all modules, exportable reports only

### FR-8: AI-Assisted Features (Groq-powered)
- FR-8.1: OCR-extracted-text → structured JSON via Groq LLM (post-processing after a vision/OCR pass — see Architecture §AI Pipeline for why Groq alone is not an OCR engine)
- FR-8.2: Expense auto-categorization suggestion (user confirms, never auto-applies)
- FR-8.3: Natural-language query over reports (v1.1 stretch — "show me last month's unpaid invoices")

---

## 2. Non-Functional Requirements (NFR)

### NFR-1: Compliance
- NFR-1.1: Must align with GST invoice format rules (Rule 46, CGST Rules) — mandatory fields on every generated invoice
- NFR-1.2: Data residency/privacy — align with India's DPDP Act 2023 (consent for storing customer PII, right-to-deletion support)
- NFR-1.3: Financial calculations must be deterministic — **no LLM involvement in tax math**, ever (LLM touches text extraction and categorization only; all currency/tax arithmetic is server-side deterministic code)

### NFR-2: Security
- NFR-2.1: Row-Level Security (RLS) on every Supabase table scoped by `business_id`
- NFR-2.2: No service-role key ever shipped to client; all privileged writes go through Edge Functions
- NFR-2.3: Audit log table for all financial mutations (who, what, when — append-only)

### NFR-3: Performance
- NFR-3.1: Invoice list/dashboard load < 2s at 10K invoices/business
- NFR-3.2: OCR extraction round-trip < 15s for a single-page invoice

### NFR-4: Scalability
- NFR-4.1: Schema must support multi-tenancy from day one (even if v1 UI is single-business-focused) — retrofitting tenant isolation later is the single most expensive architecture mistake in this category of product
- NFR-4.2: Report generation must be async/queued once invoice volume exceeds a threshold (avoid synchronous heavy queries blocking UI)

### NFR-5: Cost Constraint (explicit, per your brief)
- NFR-5.1: **No AWS.** Infra must run on free/low-cost tiers: Supabase (DB/Auth/Storage/Edge Functions), Vercel/Netlify (frontend hosting), Groq (LLM inference — has a generous free tier)
- NFR-5.2: Design must degrade gracefully if a paid tier is delayed — e.g., Supabase free tier pauses inactive projects; note this as an operational risk, not a blocker

### NFR-6: Reliability
- NFR-6.1: OCR/AI pipeline failure must never block manual invoice entry — manual path is always available as fallback
