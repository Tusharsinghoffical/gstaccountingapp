# Build Prompt Set — Antigravity IDE
## GST Ledger — Local Storage (SQLite + Filesystem) + Groq, No Supabase, No AWS

You already built the Supabase version using the original 27 prompts. Two sections below:

- **Section A — Migration prompts**: use these on your existing codebase to rip out Supabase and replace it with local storage. This is almost certainly what you actually need right now.
- **Section B — Full prompt set, updated**: the complete from-scratch sequence, rewritten for the local-storage stack, kept for reference or if you ever rebuild clean.

Run Section A in order. Don't skip the test prompt (A9) — it's the one thing standing in for the RLS backstop you're giving up.

---

## SECTION A — Migration: Supabase → Local Storage

**Prompt A1 — Remove Supabase dependencies**
```
In this existing Next.js project, remove @supabase/supabase-js and @supabase/ssr
from package.json. Search the entire codebase for any import from these packages
or any reference to SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY
and list every file that needs changing before deleting anything — output that
list first, don't delete yet.
```

**Prompt A2 — Install local-storage stack**
```
Install Prisma with the SQLite provider, NextAuth.js (Auth.js) with the
Credentials provider, bcrypt for password hashing, and multer (or the
Next.js-native equivalent) for local file upload handling. Initialize
Prisma with `datasource db { provider = "sqlite" url = "file:./data/app.db" }`.
```

**Prompt A3 — Port the schema to Prisma**
```
Convert the existing Supabase Postgres schema (businesses, business_users,
customers, suppliers, invoices, invoice_items, payments, payment_allocations,
ledger_entries, audit_log, tax_rate_config) into a Prisma schema.prisma file
targeting SQLite. Preserve every field and relation exactly. Note: SQLite has
no native ENUM type — represent role and status fields as String with an
application-level TypeScript union type enforcing the allowed values. Note:
SQLite has no native DECIMAL — use Prisma's Decimal type backed by a String
column (Prisma handles this SQLite limitation automatically) to avoid floating-
point rounding errors in currency fields; do not use Float for any money field.
```

**Prompt A4 — Build the shared authorization layer**
```
Create lib/auth/authorize.ts with two functions: assertBusinessMembership(userId,
businessId) and assertRole(userId, businessId, allowedRoles[]) — both query
BusinessUser and throw a 403 if the check fails. Then create lib/data/*.ts
files (invoices.ts, customers.ts, suppliers.ts, payments.ts, ledger.ts) where
every exported function takes (session, businessId, ...) as its first two
arguments and calls the appropriate assert function before touching Prisma.
This replaces Supabase RLS — audit every existing route handler and Server
Action in the codebase and confirm none of them call `prisma` directly;
flag any that do so they can be refactored to go through lib/data/*.
```

**Prompt A5 — Migrate auth**
```
Replace all Supabase Auth calls (signUp, signInWithOtp, getSession, etc.)
with NextAuth.js equivalents: Credentials provider with email+password,
bcrypt.compare for login, bcrypt.hash on signup. Remove any OTP-related UI
and logic entirely. Update middleware.ts to use NextAuth's session check
instead of the Supabase SSR middleware pattern.
```

**Prompt A6 — Migrate file storage**
```
Replace every Supabase Storage upload/download call with a local filesystem
equivalent: save uploaded invoice files to ./storage/{businessId}/invoices/{uuid}.
Create a single authenticated route handler (e.g. /api/files/[id]) that checks
business membership via lib/auth/authorize.ts before streaming any file back —
files must never be placed under /public or any statically-served path.
```

**Prompt A7 — Migrate the Groq Edge Functions to local API routes**
```
Convert every Supabase Edge Function that called the Groq API (OCR structuring,
categorization, PDF generation, report export) into standard Next.js Route
Handlers running in the same Node.js process as the rest of the app. Keep the
GROQ_API_KEY as a server-only environment variable, never exposed to the client.
```

**Prompt A8 — Migrate invoice numbering off Postgres triggers**
```
Replace the Postgres sequence/trigger-based invoice numbering with a Prisma
transaction that: reads the current max sequence number for the given
business_id + financial_year inside the same transaction as the invoice
insert, using SQLite's transaction isolation to prevent duplicates. Enable
PRAGMA journal_mode=WAL for the SQLite connection. Write a test that fires
20 concurrent invoice-creation requests and asserts no duplicate or skipped
invoice numbers.
```

**Prompt A9 — Authorization test suite (replaces the RLS pen-test)**
```
Write an automated test suite using two seeded users belonging to two
different businesses. For every function in lib/data/*.ts, attempt the
call with a session from the "wrong" business and assert it throws a 403.
This test suite must run in CI on every change to lib/data/* or
lib/auth/authorize.ts — treat a failing test here as a release blocker,
since there is no database-level backstop catching a bug in this layer.
```

**Prompt A10 — Backup tooling**
```
Add an npm script `backup` that copies ./data/app.db (using SQLite's
.backup command, not a raw file copy, to avoid corrupting an in-use
database) and the ./storage folder into a timestamped folder under
./backups. Add a corresponding `restore` script. Document both in
README.md with the exact commands to run.
```

**Prompt A11 — Deployment sanity check**
```
Audit this project for anything that assumes a serverless/ephemeral
filesystem (Vercel-style deployment config, edge runtime declarations
on routes that touch Prisma/SQLite or the local filesystem). Remove any
such config. Confirm the app is set up to run as a single persistent
Node.js process (next start, not next build for static export) suitable
for deployment on a VPS or a PaaS plan with a persistent volume.
```

---

## SECTION B — Full Prompt Set (From Scratch, Local-Storage Stack)

### PHASE 1 — Project Setup & Local Data Foundation

**Prompt 1**
```
Create a new Next.js 14 (App Router, TypeScript) project named "gst-ledger".
Install and configure: Tailwind CSS, Prisma (SQLite provider), NextAuth.js
(Credentials provider), bcrypt, zod, react-hook-form. Folder structure:
/app, /components, /lib/data, /lib/auth, /lib/validation, /types.
Do not install @supabase/*, any AWS SDK, or any cloud BaaS package.
```

**Prompt 2**
```
Initialize Prisma with datasource provider "sqlite", url "file:./data/app.db".
Create a .env.local.example listing: DATABASE_URL, NEXTAUTH_SECRET,
NEXTAUTH_URL, GROQ_API_KEY. Ensure ./data/ and ./storage/ are gitignored
but the directories themselves exist with a .gitkeep so first-run doesn't fail.
```

**Prompt 3 — Core schema**
```
Write schema.prisma with models: Business, User, BusinessUser, Customer,
Supplier, Invoice, InvoiceItem, Payment, PaymentAllocation, LedgerEntry,
AuditLog, TaxRateConfig. Use the exact model shapes from 03-ARCHITECTURE.md
§4. Denormalize businessId directly onto every business-scoped table.
Use Decimal (not Float) for every currency field.
```

**Prompt 4 — Authorization layer**
```
Create lib/auth/authorize.ts with assertBusinessMembership(userId, businessId)
and assertRole(userId, businessId, allowedRoles[]), both querying BusinessUser
and throwing 403 on failure. Create lib/data/*.ts (one file per entity) where
every function requires a session + businessId and calls these asserts first.
This is the sole authorization boundary for the whole app — document that in
a comment at the top of authorize.ts.
```

**Prompt 5 — Auth flow**
```
Implement NextAuth.js Credentials provider: email+password signup (bcrypt hash)
and login (bcrypt compare). On first login with no BusinessUser row, redirect
to onboarding to create a business (name, GSTIN, state_code). Use middleware.ts
to protect all authenticated routes.
```

---

### PHASE 2 — UI Foundation (Stitch handoff)

**Prompt 6**
```
Import a Stitch-generated component library (Tailwind classes). Configure
tailwind.config.ts to match the exported design tokens (colors, spacing,
fonts). Scaffold /components/ui: Button, Input, DataTable, StatusBadge,
CurrencyInput, EmptyState, BackupStatusChip — matching the Stitch spec.
```

**Prompt 7**
```
Create /lib/format.ts: formatINR(amount) using the Indian numbering system
(1,00,000 grouping), formatDateIN(date) as DD/MM/YYYY. Add unit tests
covering zero, negative, and values above 1 crore.
```

**Prompt 8**
```
Build the authenticated app shell: sidebar (Dashboard, Invoices, OCR Upload,
Customers, Suppliers, Reports, Backup & Data, Settings), top bar with
business switcher and user menu. Responsive: collapses to bottom nav under
768px. Use the Stitch layout as the visual reference.
```

---

### PHASE 3 — Core Invoicing

**Prompt 9 — Customer & Supplier CRUD**
```
Build CRUD pages for Customers and Suppliers via lib/data/customers.ts and
lib/data/suppliers.ts: list (DataTable, searchable/filterable by state_code),
create/edit form with GSTIN format+checksum validation (client and server
side, no external GSTN API call), detail view with ledger history.
```

**Prompt 10 — Invoice creation form**
```
Build Create Invoice: header (customer/supplier picker, date, type), dynamic
line-item table (description, HSN, qty, rate, gst_rate, computed amount),
live tax summary panel (CGST+SGST vs IGST based on state code match). All
tax math computed server-side inside lib/data/invoices.ts on save — never
trust client-computed totals.
```

**Prompt 11 — Invoice numbering**
```
Implement sequential, per-financial-year, per-business invoice numbering
inside a Prisma transaction (read-max-then-insert pattern, relying on
SQLite's transaction serialization to prevent races). Enable
PRAGMA journal_mode=WAL. Format: INV/{FY}/{seq}, e.g. INV/2025-26/0001.
Write a concurrency test firing 20 simultaneous creates.
```

**Prompt 12 — Invoice states & immutability**
```
Implement draft -> final -> cancelled transitions. Enforce immutability of
finalized invoices inside lib/data/invoices.ts (reject any update call once
status is 'final', not just disable it in the UI). Corrections go through a
separate credit_note/debit_note record referencing the original invoice.
```

**Prompt 13 — Invoice PDF generation**
```
Build a PDF export for finalized invoices (GSTIN, invoice number, HSN-wise
line items, tax breakup, amount in words) as a Next.js Route Handler
running server-side, writing the output to ./storage/{businessId}/exports/
and streaming it back through an authenticated download endpoint.
```

---

### PHASE 4 — Payments & Ledger

**Prompt 14 — Payment recording & allocation**
```
Build Record Payment: select party, amount, date, allocate across one or
more open invoices (partial allocation supported). On save, insert Payment
and PaymentAllocation rows inside a single Prisma transaction — if
allocation logic fails, the payment insert rolls back too.
```

**Prompt 15 — Ledger balance computation**
```
Implement a function in lib/data/ledger.ts that computes a party's running
balance by summing LedgerEntry rows at query time — never store balance as
a mutable column. Add a composite index on (businessId, partyId, createdAt).
Build the party detail page showing chronological ledger with computed
running balance.
```

---

### PHASE 5 — OCR + Groq AI Pipeline

**Prompt 16 — Local file upload**
```
Build the OCR Upload screen: drag-drop/file-picker, save to
./storage/{businessId}/invoices/{uuid}.{ext} via a Route Handler that checks
business membership first (never write to /public). Show upload progress
and a loading state during extraction.
```

**Prompt 17 — OCR text extraction stage**
```
Create a Route Handler that receives a stored file path, runs OCR. First
check whether a vision-capable model is available on the Groq account — if
yes, use it directly on the image. Otherwise, run Tesseract.js locally
(Node.js) on the file to extract raw text as a fallback. Return raw text
plus a confidence flag.
```

**Prompt 18 — Groq structuring stage**
```
Create a second Route Handler that sends raw OCR text to the Groq API with
a strict JSON-mode/function-calling prompt, extracting vendor_name,
vendor_gstin, invoice_number, invoice_date, line_items[], total_amount.
Validate the response against a zod schema before returning it — on
validation failure, return an error state, never pass malformed data forward.
```

**Prompt 19 — OCR review & confirm screen**
```
Build the OCR Review screen: source file displayed alongside an editable
form pre-filled from Prompt 18's output. Persistent banner: "Review
extracted data — nothing is saved yet." On confirm, call the same
lib/data/invoices.ts creation path used by manual entry (Prompt 10) —
do not create a separate, less-validated write path for OCR-sourced invoices.
```

**Prompt 20 — Expense categorization suggestion**
```
Add an AI-suggested category to purchase invoices via a Groq call classifying
vendor name + line-item descriptions into [Office Supplies, Raw Materials,
Utilities, Professional Services, Travel, Other]. Show as a suggestion chip
the user must explicitly accept — never auto-apply.
```

---

### PHASE 6 — Reports, RBAC, Backup

**Prompt 21 — GSTR-1 summary report**
```
Build the GSTR-1 Summary: B2B by customer GSTIN, B2C by state and tax rate,
HSN-wise summary table. Month/quarter filter. XLSX export via exceljs,
generated server-side, written to ./storage/{businessId}/exports/.
```

**Prompt 22 — Ageing & outstanding report**
```
Build the Outstanding/Ageing report: bucket unpaid/partial invoice amounts
into 0-30/31-60/61-90/90+ day buckets based on invoice date vs today. Sort
by total outstanding descending. XLSX and PDF export.
```

**Prompt 23 — Role management UI**
```
Build Settings > User Management (admin-only, guarded both in the UI route
and via lib/auth/authorize.ts): invite a user by email to the current
business (create a pending BusinessUser + send them a signup link, since
there's no hosted invite-email service now — generate the link and display
it for the admin to send manually, or wire up a simple SMTP/email API if
one is available), assign role, revoke access.
```

**Prompt 24 — Audit log viewer**
```
Build a read-only Audit Log screen (admin-only): timestamp, user, action,
table, human-readable diff. Populate AuditLog by writing a row inside the
same transaction as every mutation in lib/data/*.ts — do not rely on a
database trigger (SQLite support for this is weaker than Postgres); make
it an explicit, tested part of each data-access function instead.
```

**Prompt 25 — Backup & Data screen**
```
Build the Backup & Data screen: show last-backup timestamp (read from a
backups metadata file or table), a "Backup now" button that triggers the
backup script from Prompt A10/below, and a link to the documented restore
procedure. Surface a warning state on the Dashboard's BackupStatusChip if
the last backup is older than a configurable threshold (e.g. 24 hours).
```

**Prompt 26 — Backup tooling**
```
Add an npm script `backup` using SQLite's .backup command (not a raw file
copy) for ./data/app.db, plus a copy of ./storage, into a timestamped
folder under ./backups. Add a `restore` script. Document exact commands
in README.md, including how to verify a restore actually worked.
```

---

### PHASE 7 — Hardening & Deployment

**Prompt 27 — Authorization test suite**
```
Write an automated test suite with two seeded users in different
businesses. For every function in lib/data/*.ts, attempt each call from
the "wrong" business's session and assert every one throws a 403. This
must run in CI before any change to lib/data/* or lib/auth/* is mergeable
— it is the direct replacement for RLS and there is no other layer
catching a mistake here.
```

**Prompt 28 — Error handling & fallback paths**
```
Audit every Groq API call site and ensure each has a try/catch with a
graceful fallback: OCR failure or timeout redirects the user to manual
invoice entry with a clear message, never a stuck loading state.
```

**Prompt 29 — Deployment configuration**
```
Prepare this project to run as a single persistent Node.js process
(next start) on a host with persistent disk — a VPS or a PaaS plan with
an attached volume, not serverless/Vercel functions. Document the exact
deploy steps and required environment variables in README.md. Run a
dependency audit and confirm zero AWS SDK, zero Supabase package, and
zero other cloud-BaaS dependency remains anywhere in the tree.
```
