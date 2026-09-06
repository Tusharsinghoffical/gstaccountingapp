# Build Prompt Set — Antigravity IDE
## GST Ledger — Stitch + Supabase + Groq, No AWS

Use these sequentially. Each is copy-paste ready into Antigravity. Don't skip ahead — later prompts assume earlier scaffolding exists (schema, auth, RLS) or Antigravity will hallucinate structure that conflicts with what you build next.

---

### PHASE 1 — Project Setup & Supabase Foundation

**Prompt 1 — Project scaffold**
```
Create a new Next.js 14 (App Router, TypeScript) project named "gst-ledger".
Install and configure: Tailwind CSS, @supabase/supabase-js, @supabase/ssr,
zod for validation, react-hook-form. Set up the folder structure:
/app, /components, /lib/supabase, /lib/validation, /types.
Do not use any AWS SDK or AWS-dependent package anywhere in this project.
```

**Prompt 2 — Supabase project + env config**
```
Set up Supabase client configuration in /lib/supabase/client.ts (browser client)
and /lib/supabase/server.ts (server client for Server Components/Route Handlers),
using @supabase/ssr. Read SUPABASE_URL and SUPABASE_ANON_KEY from environment
variables. Add a .env.local.example file listing required vars:
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
GROQ_API_KEY. Never expose SUPABASE_SERVICE_ROLE_KEY or GROQ_API_KEY to client code.
```

**Prompt 3 — Core database schema**
```
Write a Supabase SQL migration file that creates these tables with appropriate
foreign keys and NOT NULL constraints: businesses, business_users, customers,
suppliers, invoices, invoice_items, payments, payment_allocations,
ledger_entries, audit_log, tax_rate_config.
Use this schema as the exact reference: [paste schema from 03-ARCHITECTURE.md
section 4]. Every business-scoped table must include a business_id column
directly (not via a join table) for RLS performance.
```

**Prompt 4 — Row-Level Security policies**
```
Write Supabase RLS policies for every table in the schema. Pattern:
users can only access rows where business_id is in the set of businesses
they belong to via business_users. Additionally: only 'admin' and
'accountant' roles can INSERT/UPDATE/DELETE on invoices, payments,
ledger_entries; 'auditor' role gets SELECT only on all tables.
audit_log must have no UPDATE or DELETE grant for any role — insert only,
even for admins. Include a SQL test script that verifies a user from
Business A cannot read Business B's rows.
```

**Prompt 5 — Auth flow**
```
Implement Supabase Auth email + OTP sign-up and login flow in Next.js.
On first successful login where the user has no business_users row,
redirect to an onboarding screen to create their first business
(name, GSTIN, state_code). Store the session using @supabase/ssr
middleware pattern so Server Components can read the authenticated user.
```

---

### PHASE 2 — UI Foundation (Stitch handoff)

**Prompt 6 — Design tokens from Stitch**
```
I'm importing a component library generated in Google Stitch using Tailwind
CSS classes. Set up a tailwind.config.ts theme extension matching this design
token set: [paste color palette, spacing scale, and font tokens exported from
your Stitch project]. Create a /components/ui folder and scaffold the base
components: Button, Input, DataTable, StatusBadge, CurrencyInput, EmptyState —
matching the Stitch visual spec exactly, not a generic shadcn default.
```

**Prompt 7 — Currency & date formatting utilities**
```
Create /lib/format.ts with two functions: formatINR(amount: number) that
formats numbers in the Indian numbering system (e.g. 100000 -> "₹1,00,000"),
and formatDateIN(date: Date) that outputs DD/MM/YYYY. Add unit tests for
both covering edge cases: zero, negative numbers, values above 1 crore.
```

**Prompt 8 — App shell & navigation**
```
Build the authenticated app shell: a left sidebar (Dashboard, Invoices,
OCR Upload, Customers, Suppliers, Reports, Settings) and a top bar with
business switcher (for users belonging to multiple businesses) and user
menu. Use the Stitch-exported layout as the visual reference. Make it
responsive: sidebar collapses to a bottom nav bar under 768px width.
```

---

### PHASE 3 — Core Invoicing

**Prompt 9 — Customer & Supplier CRUD**
```
Build full CRUD pages for Customers and Suppliers: list view (DataTable
component, searchable, filterable by state_code), create/edit form with
GSTIN format + checksum validation (do not call any external GSTN API —
validate the 15-character format and checksum algorithm client-side and
server-side), and a detail view showing ledger history for that party.
```

**Prompt 10 — Invoice creation form**
```
Build the Create Invoice page: header fields (customer/supplier picker,
invoice date, invoice type sales/purchase), a dynamic line-item table
(description, HSN code, qty, rate, gst_rate, computed amount), and a
live-updating tax summary panel showing CGST+SGST or IGST split based on
whether the business state_code matches the customer's state_code.
All tax math must be calculated server-side on save (Route Handler or
Edge Function) — do not trust client-computed totals as the source of truth.
```

**Prompt 11 — Invoice numbering logic**
```
Implement sequential, per-financial-year, per-business invoice numbering
as a Postgres function/trigger (not application-code counter, to avoid
race conditions under concurrent invoice creation). Financial year in
India runs April 1 - March 31. Format: INV/{FY}/{sequential number},
e.g. INV/2025-26/0001. Write a test that creates 20 invoices concurrently
and asserts no duplicate or skipped numbers.
```

**Prompt 12 — Invoice states & immutability**
```
Implement invoice status transitions: draft -> final -> cancelled.
Once an invoice is 'final', all its fields become immutable at the
database level (RLS/trigger enforced, not just UI-disabled). Corrections
to a finalized invoice must be done via a separate credit_note or
debit_note record type that references the original invoice_id.
```

**Prompt 13 — Invoice PDF generation**
```
Build a PDF export for a finalized invoice matching GST-compliant format
requirements: business GSTIN, invoice number, HSN-wise line items, tax
breakup table, amount in words (use a number-to-words library for INR).
Generate this as a Supabase Edge Function so the PDF library dependency
doesn't bloat the client bundle.
```

---

### PHASE 4 — Payments & Ledger

**Prompt 14 — Payment recording & allocation**
```
Build a Record Payment flow: select a customer/supplier, enter amount
and date, then allocate the payment across one or more of their open
invoices (support partial allocation). On save, create a payments row
and one or more payment_allocations rows atomically (single transaction —
if allocation fails, the payment insert must roll back too).
```

**Prompt 15 — Ledger balance computation**
```
Implement a function (SQL view or Edge Function) that computes a party's
running balance by summing all ledger_entries for that party — never
store balance as a mutable column. Build the party detail page to show
a chronological ledger with running balance calculated at query time.
Add an index on (business_id, party_id, created_at) to keep this fast
as entry volume grows.
```

---

### PHASE 5 — OCR + Groq AI Pipeline

**Prompt 16 — File upload to Supabase Storage**
```
Build the OCR Upload screen: drag-and-drop or file-picker for image/PDF,
upload to a Supabase Storage bucket scoped per business_id with RLS
matching the pattern used on database tables. Show upload progress and
a loading state while extraction (next prompt) runs.
```

**Prompt 17 — OCR text extraction stage**
```
Create a Supabase Edge Function that receives a Storage file reference,
runs OCR text extraction. First check whether a vision-capable model is
available on my Groq account — if yes, use it directly on the image.
If not, use Tesseract.js to extract raw text from the image/PDF as a
fallback, then pass that raw text to the structuring stage below.
Return raw extracted text plus a confidence flag.
```

**Prompt 18 — Groq structuring stage**
```
Create a second Edge Function that takes raw OCR text and calls the Groq
API with a strict JSON-mode/function-calling prompt to extract: vendor_name,
vendor_gstin, invoice_number, invoice_date, line_items (description, hsn,
qty, rate, gst_rate), and total_amount. Validate the returned JSON against
a zod schema before returning it to the client — if validation fails,
return an error state, do not pass malformed data forward.
```

**Prompt 19 — OCR review & confirm screen**
```
Build the OCR Review screen: source image/PDF displayed alongside an
editable form pre-filled with the extracted JSON from Prompt 18. Every
field must be user-editable before save. Add a persistent visual banner
"Review extracted data — nothing is saved yet" per the UX plan. On confirm,
create the purchase invoice and supplier ledger entry through the same
validated path as manual invoice creation (Prompt 10) — do not create a
separate, less-validated write path for OCR-sourced invoices.
```

**Prompt 20 — Expense categorization suggestion**
```
Add an AI-suggested category field to purchase invoices, populated by a
Groq call that classifies the invoice based on vendor name and line-item
descriptions into categories: [Office Supplies, Raw Materials, Utilities,
Professional Services, Travel, Other]. Display it as a suggestion chip
the user must explicitly accept — never auto-apply the category.
```

---

### PHASE 6 — Reports & RBAC

**Prompt 21 — GSTR-1 summary report**
```
Build the GSTR-1 Summary report: B2B invoices grouped by customer GSTIN,
B2C invoices summarized by state and tax rate, and an HSN-wise summary
table (HSN code, description, total quantity, total value, tax amount).
Add month/quarter filter. Add XLSX export using a library like exceljs,
generated server-side via Edge Function.
```

**Prompt 22 — Ageing & outstanding report**
```
Build the Outstanding/Ageing report: for each customer with unpaid or
partially paid invoices, bucket the outstanding amount into 0-30, 31-60,
61-90, and 90+ day buckets based on invoice date vs today. Sort by total
outstanding descending. Add XLSX and PDF export.
```

**Prompt 23 — Role management UI**
```
Build the Settings > User Management screen (admin-only, enforce this
both in the UI route guard and via RLS): invite a user by email to the
current business, assign role (accountant/auditor), and revoke access.
Sending the invite should trigger Supabase Auth's invite flow, not a
custom email system.
```

**Prompt 24 — Audit log viewer**
```
Build a read-only Audit Log screen (admin-only) showing all financial
mutations: timestamp, user, action, table, and a human-readable diff of
what changed. Populate audit_log automatically via Postgres triggers on
INSERT/UPDATE to invoices, payments, and ledger_entries — do not rely on
application code to remember to log every mutation.
```

---

### PHASE 7 — Hardening & Deployment

**Prompt 25 — RLS penetration test suite**
```
Write an automated test suite (using two test users in different
businesses) that attempts every CRUD operation across every table from
the "wrong" business's session and asserts every single one is denied.
This must run in CI before any schema or policy change is considered
mergeable.
```

**Prompt 26 — Error handling & fallback paths**
```
Audit every Groq API call site in the codebase and ensure each has a
try/catch with a graceful fallback: if OCR extraction fails or times out,
the user must be redirected to manual invoice entry with a clear message,
never left on a stuck loading state.
```

**Prompt 27 — Deployment configuration**
```
Prepare this project for deployment on Vercel (frontend) and Supabase
(backend, already hosted). Create vercel.json if needed, document all
required environment variables in README.md, and verify no AWS SDK,
AWS credentials, or AWS-specific configuration exists anywhere in the
codebase or dependency tree — run a dependency audit and remove any
AWS-related packages if found.
```
