# Technical Architecture
## GST Ledger — Stack: Supabase + Groq + Stitch-generated UI (No AWS)

> Structural note: your original README specified Django + SQLite + Render. Your new brief (Antigravity IDE, Groq, Stitch, Supabase) implies a stack pivot — this doc reflects the **new** stack, not the README's. Flagging this explicitly so it's a deliberate decision, not a drift.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js + Tailwind, UI scaffolded via Stitch)     │
│  - Deployed on Vercel (free tier)                            │
└───────────────┬───────────────────────────┬──────────────────┘
                │                            │
                ▼                            ▼
┌───────────────────────────┐   ┌────────────────────────────┐
│  Supabase                 │   │  Supabase Edge Functions    │
│  - Postgres (RLS enabled) │   │  (Deno runtime)             │
│  - Auth (email+OTP)       │   │  - GST calc logic            │
│  - Storage (invoice files)│◄──┤  - Groq API calls             │
│  - Realtime (optional)    │   │  - Report generation          │
└───────────────────────────┘   └──────────────┬──────────────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │  Groq API               │
                                    │  (Llama-family models)  │
                                    │  - Text structuring      │
                                    │  - Categorization        │
                                    └────────────────────────┘
```

**Why this shape, not client-calls-everything:** all Groq calls and all tax-math writes go through Edge Functions, never directly from the browser. Two reasons — (1) the Groq API key must never reach the client bundle, (2) tax calculations are a compliance-critical path and need one server-side choke point for auditability, not scattered client-side logic that's easy to tamper with or get inconsistent across app versions.

---

## 2. Stack Breakdown

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js (App Router) | Stitch exports React/Tailwind components cleanly into this; Vercel deploy is zero-config |
| Styling | Tailwind CSS | Matches Stitch's output format directly — no translation layer needed |
| Backend/DB | Supabase (Postgres) | Free tier covers MVP; built-in RLS solves multi-tenant isolation without custom middleware |
| Auth | Supabase Auth | Email/OTP out of the box, JWT claims usable directly in RLS policies |
| File storage | Supabase Storage | Invoice scans/PDFs, bucket-per-business with RLS |
| Serverless compute | Supabase Edge Functions (Deno) | Where Groq calls + tax math + report generation live |
| AI inference | Groq API (Llama 3.x / vision-capable model where available) | Fast inference, generous free tier — replaces any AWS-based ML infra |
| Hosting | Vercel (frontend) | Free tier, git-push deploy, pairs natively with Next.js |
| IDE/build agent | Google Antigravity | Used to scaffold and iterate the codebase from the prompt set in doc 05 |
| UI design | Google Stitch | Generates the screen designs/components consumed by the frontend |

**Explicitly removed:** AWS (S3, Lambda, RDS, etc.) — every function AWS would have served here (file storage, serverless compute, DB) has a direct Supabase/Vercel equivalent above, at $0 for MVP scale.

---

## 3. AI Pipeline (OCR + Groq) — Load-Bearing Assumption to Verify

**Groq is an inference API — it is not, by itself, an OCR engine.** This is the one assumption in your brief I'd stress-test before building on it. The pipeline needs two stages:

1. **Vision/OCR stage** — extract raw text/layout from the image or PDF. Options, ranked:
   - A Groq-hosted vision-capable model (if one is available on your Groq account — check current model list before committing; this changes frequently)
   - Fallback: Tesseract.js (free, client or Edge Function side) for raw text extraction, then pass that text to Groq
2. **Structuring stage** — Groq (text) LLM takes raw OCR text and returns structured JSON (vendor, GSTIN, line items, amounts) via a strict JSON-mode/function-calling prompt

**Action item before Prompt Set execution:** confirm in Antigravity/Groq console whether a vision model is available on your plan. If not, the architecture defaults to Tesseract.js → Groq text model, which is fully free-tier compatible.

---

## 4. Data Model (Core Tables)

```sql
businesses (id, name, gstin, state_code, created_at)
business_users (business_id, user_id, role) -- role: admin|accountant|auditor
customers (id, business_id, name, gstin, state_code, ...)
suppliers (id, business_id, name, gstin, state_code, ...)
invoices (id, business_id, type[sales|purchase], customer_or_supplier_id,
          invoice_no, invoice_date, status[draft|final|cancelled],
          subtotal, cgst, sgst, igst, total, financial_year)
invoice_items (id, invoice_id, description, hsn_code, qty, rate, gst_rate, amount)
payments (id, business_id, party_id, amount, date, mode)
payment_allocations (id, payment_id, invoice_id, allocated_amount)
ledger_entries (id, business_id, party_id, entry_type, amount, ref_invoice_id, created_at)
audit_log (id, business_id, user_id, action, table_name, record_id, diff, created_at)
tax_rate_config (id, hsn_code, gst_rate, effective_from, effective_to) -- versioned, not hardcoded
```

**Design decision worth naming explicitly:** `ledger_entries` balances are always *derived* by summing entries, never stored as a mutable running-total column. A stored running-total is the classic source of silent drift once concurrent writes or corrections happen — recompute-on-read (with caching if performance demands it later) is the safer default here.

---

## 5. Security Model

- **RLS on every table**, policy pattern: `business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid())`
- Role-specific write policies: `accountant`/`admin` can INSERT/UPDATE invoices; `auditor` — SELECT only, enforced at the RLS layer, not just hidden in the UI (UI-only restriction is not security)
- Service-role key lives only in Edge Function environment variables, never in frontend `.env` exposed to the browser
- Audit log is append-only (no UPDATE/DELETE grant to any role, including admin, at the DB level)

---

## 6. Second-Order Considerations (things that bite at scale, not at MVP)

1. **Supabase free tier pauses projects after inactivity** — fine for dev, plan a keep-alive or paid tier before real users onboard.
2. **RLS performance at scale**: policies with subqueries (as above) can slow down at high row counts — plan to denormalize `business_id` onto every table directly (already done above) rather than joining through a middle table, to keep RLS checks cheap.
3. **GST rate changes are a government-driven external event**, not a code bug — the `tax_rate_config` table with effective-date ranges exists specifically so a rate change is a data update, not a deploy.
4. **Groq rate limits under OCR load**: if many businesses upload invoices simultaneously, queue extraction jobs (Supabase Edge Function + a simple jobs table) rather than calling Groq synchronously from the upload request — protects UX from API throttling.
