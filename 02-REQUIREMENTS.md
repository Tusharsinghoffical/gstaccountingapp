# Requirements Specification
## GST Ledger — Functional & Non-Functional Requirements (Local-Storage Architecture)

---

## 1. Functional Requirements (FR)

### FR-1: Authentication & Multi-Tenancy
- FR-1.1: Email + password signup/login via NextAuth.js (Credentials provider), passwords hashed with bcrypt — no OTP in v1 (see PRD §4 for why this is a deliberate cut, not an oversight)
- FR-1.2: Each user belongs to one or more `businesses` (tenant boundary), tracked in a `business_users` table
- FR-1.3: Role assignment per business: `admin`, `accountant`, `auditor` (read-only)
- FR-1.4: Business switcher UI for users belonging to multiple businesses (CA use case)
- FR-1.5: Session strategy: JWT-based sessions (stateless) or database sessions stored in SQLite — pick JWT unless you need server-side session revocation, in which case use DB sessions and accept the extra query per request

### FR-2: Invoicing (Sales & Purchase)
- FR-2.1: Create invoice with line items (item, HSN/SAC code, qty, rate, discount)
- FR-2.2: Auto-calculate GST split: CGST+SGST (intra-state) vs IGST (inter-state) based on business state code vs customer state code
- FR-2.3: Support GST rate slabs: 0%, 5%, 12%, 18%, 28% — configurable per line item via HSN lookup or manual override
- FR-2.4: Generate invoice PDF (GST-compliant format: invoice no., GSTIN, HSN summary, tax breakup)
- FR-2.5: Invoice numbering: sequential, per-financial-year, per-business (cannot skip/duplicate — GST audit requirement); implemented as a single-writer transaction against SQLite (see Architecture §4 — SQLite's write concurrency model matters here)
- FR-2.6: Draft → Finalized → Cancelled states (finalized invoices are immutable; corrections via credit/debit notes only)

### FR-3: OCR-Based Invoice Ingestion
- FR-3.1: User uploads photo/PDF of a purchase invoice; file is written to local disk under a business-scoped folder path (e.g. `/storage/{business_id}/invoices/{uuid}.pdf`)
- FR-3.2: System extracts: vendor name, GSTIN, invoice number, date, line items, tax amounts
- FR-3.3: Extracted data shown in an editable review form — **never auto-committed**
- FR-3.4: On confirm, creates a purchase invoice + updates supplier ledger
- FR-3.5: Uploaded files must never be served as static/public files — always streamed through an authenticated route handler that checks the requesting user's business membership first

### FR-4: Ledger & Payments
- FR-4.1: Running balance per customer/supplier, computed from invoice + payment entries (never stored as a mutable field — always derived/recalculated to avoid drift)
- FR-4.2: Record payment (full/partial), allocate against one or more open invoices
- FR-4.3: Cash & bank ledger — manual entries + auto-entries from payment allocation

### FR-5: Reporting
- FR-5.1: GSTR-1 summary report (B2B/B2C split, HSN-wise summary, tax rate-wise summary)
- FR-5.2: Outstanding/ageing report (0-30 / 31-60 / 61-90 / 90+ days buckets)
- FR-5.3: P&L snapshot (revenue, expense, tax collected vs tax paid — Input Tax Credit view)
- FR-5.4: Export all reports as XLSX and PDF, written to a local `/exports` folder and offered as a download

### FR-6: Customer/Supplier Management
- FR-6.1: CRUD for customers/suppliers with GSTIN validation (format + checksum, not live GSTN lookup in v1)
- FR-6.2: Contact info, billing address, state code (derived from GSTIN for tax-split logic)

### FR-7: Role-Based Access Control
- FR-7.1: `admin` — full CRUD across all modules
- FR-7.2: `accountant` — CRUD on invoices/payments/ledger, no user-management access
- FR-7.3: `auditor` — read-only across all modules, exportable reports only
- FR-7.4: **All RBAC checks happen in a single shared authorization layer** (server-side, wrapping every data-access function) — with no DB-level RLS to fall back on, there is no second line of defense if this layer has a bug, so it must be the one place every query/mutation passes through, never re-implemented ad hoc per route

### FR-8: AI-Assisted Features (Groq-powered)
- FR-8.1: OCR-extracted-text → structured JSON via Groq LLM (post-processing after a vision/OCR pass — see Architecture §3)
- FR-8.2: Expense auto-categorization suggestion (user confirms, never auto-applies)
- FR-8.3: Natural-language query over reports (v1.1 stretch)

### FR-9: Backup & Data Durability (new — direct consequence of local storage)
- FR-9.1: Scheduled automated backup of the SQLite database file and the local file-storage folder (e.g. nightly cron/scheduled task)
- FR-9.2: A documented, tested restore procedure — untested backups are not backups
- FR-9.3: Admin-facing "last backup: [timestamp]" indicator so data-loss risk is visible, not silent

---

## 2. Non-Functional Requirements (NFR)

### NFR-1: Compliance
- NFR-1.1: Must align with GST invoice format rules (Rule 46, CGST Rules) — mandatory fields on every generated invoice
- NFR-1.2: Data residency/privacy — align with India's DPDP Act 2023. Local storage arguably *simplifies* this (data never leaves infrastructure you control) but you now own 100% of the security and breach-notification burden that a managed provider previously shared
- NFR-1.3: Financial calculations must be deterministic — **no LLM involvement in tax math**, ever

### NFR-2: Security
- NFR-2.1: No DB-level Row-Level Security exists on SQLite — tenant isolation is enforced entirely by a shared server-side authorization/data-access layer. Every query must pass through it; direct ad-hoc Prisma/SQL calls elsewhere in the codebase are a standing risk and should be linted against if possible
- NFR-2.2: Uploaded files served only via authenticated route handlers (never a public static path) — see FR-3.5
- NFR-2.3: Audit log table for all financial mutations (who, what, when — append-only, enforced by not exposing any UPDATE/DELETE path for it in the data-access layer, since SQLite has no grant-level enforcement to fall back on either)
- NFR-2.4: Password hashing via bcrypt (or argon2), never plaintext or reversible encryption

### NFR-3: Performance
- NFR-3.1: Invoice list/dashboard load < 2s at 10K invoices/business
- NFR-3.2: OCR extraction round-trip < 15s for a single-page invoice
- NFR-3.3: SQLite write concurrency — enable WAL (Write-Ahead Logging) mode to allow concurrent reads during writes; be aware SQLite still serializes writes, which is fine at SME single-business scale but is a real ceiling if this ever needs many businesses writing simultaneously on one instance (see Architecture §6)

### NFR-4: Scalability
- NFR-4.1: Schema must support multi-tenancy from day one (even if v1 UI is single-business-focused)
- NFR-4.2: Report generation must be async/queued once invoice volume exceeds a threshold
- NFR-4.3: Keep the ORM layer (Prisma) as the only thing that knows it's talking to SQLite — if this product ever needs to scale beyond one server, migrating to Postgres later should be a connection-string and schema-dialect change, not a rewrite. This is the main reason to use an ORM here rather than raw SQLite calls.

### NFR-5: Cost Constraint (explicit, per your brief)
- NFR-5.1: **No AWS. No Supabase / managed BaaS.** Infra: local SQLite file, local filesystem storage, self-hosted Node.js server, Groq (LLM inference, free-tier eligible)
- NFR-5.2: Hosting note: if/when this needs to be reachable outside one machine, it needs a host with **persistent disk** (a VPS, or a PaaS plan with a persistent volume) — plain serverless hosting (e.g. Vercel functions) is incompatible with a local SQLite file + local filesystem storage, since serverless instances don't guarantee persistent local disk between invocations. Flag this before choosing a deploy target (see Architecture §6).

### NFR-6: Reliability
- NFR-6.1: OCR/AI pipeline failure must never block manual invoice entry
- NFR-6.2: Single point of failure is now explicit: one server, one SQLite file. NFR-9 (backup) exists specifically to bound this risk, not eliminate it — be honest with users about this trade-off in onboarding copy
