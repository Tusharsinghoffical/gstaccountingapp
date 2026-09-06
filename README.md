# GST Ledger — Full-Stack GST Accounting Application

A production-grade, multi-tenant GST accounting system built with **Next.js 14**, **Supabase**, and **Groq AI**. Designed for Indian SMEs to manage sales/purchase invoices, parties, payments, ledgers, GST reports (GSTR-1), and AI-assisted document processing.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Supabase Setup](#supabase-setup)
- [Render Deployment](#render-deployment)
- [CI / Testing](#ci--testing)
- [Security](#security)
- [AWS Audit Notice](#aws-audit-notice)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3 |
| Backend / DB | Supabase (PostgreSQL, Edge Functions, Auth, Storage) |
| AI / OCR | Groq API (Vision + Chat Completions), Tesseract.js fallback |
| Excel Export | ExcelJS (server-side, Edge Functions) |
| Testing | Node.js built-in test runner (`node:test`) |
| CI | GitHub Actions |
| Hosting | Render (frontend) + Supabase (backend, already hosted) |

---

## Features

- **Multi-tenant** with strict Row-Level Security (RLS) — every row is business-scoped
- **Sales & Purchase Invoices** — GST-compliant with CGST/SGST/IGST, HSN codes, line items
- **Party Ledger** — Running balance maintained atomically via Postgres triggers
- **Payments & Allocation** — Full payment reconciliation with atomic ledger entries
- **OCR Invoice Scanning** — Upload PDF/image → Groq Vision extracts data → user reviews & edits → saves via validated path
- **AI Category Suggestion** — Groq classifies purchase invoices; user must explicitly accept
- **GSTR-1 Report** — B2B/B2C/HSN summary with month/quarter filter and XLSX export
- **Outstanding & Ageing Report** — 0-30/31-60/61-90/90+ day buckets with XLSX and PDF export
- **User Management** — Admin-only; invite by email via Supabase Auth, assign roles
- **Audit Log** — Admin-only read-only view of all financial mutations (triggers, not app code)
- **RLS Penetration Tests** — 800+ automated cross-tenant isolation assertions run in CI

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Render (Frontend)               │
│  Next.js 14 App Router                          │
│  ├── /app/(dashboard)/...  (authenticated pages) │
│  ├── /app/actions/...      (Server Actions)      │
│  └── /app/api/...          (Route Handlers)      │
└───────────────────┬─────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────┐
│                Supabase (Backend)                │
│  ├── PostgreSQL (multi-tenant, RLS enforced)     │
│  ├── Edge Functions (OCR, GSTR-1 XLSX export)    │
│  ├── Auth (email/password + invite flow)         │
│  └── Storage (invoice-documents bucket)          │
└───────────────────┬─────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────┐
│                 Groq API (AI)                    │
│  ├── Vision — OCR extraction from images/PDF    │
│  └── Chat — Invoice category classification     │
└─────────────────────────────────────────────────┘
```

---

## Environment Variables

> ⚠️ **Never commit real secrets.** Copy `.env.local.example` → `.env.local` and fill in values.

### Required Variables

All variables below **must** be set in your Vercel project settings (Project → Settings → Environment Variables) and in `.env.local` for local development.

| Variable | Required | Exposed to Browser | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | ✅ Yes | Your Supabase project URL (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | ✅ Yes | Supabase anonymous/public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | ❌ No | Supabase service role key — **server-only**, full DB access |
| `GROQ_API_KEY` | ✅ Yes | ❌ No | Groq API key (`gsk_...`) — **server-only**, used for OCR and AI classification |

### Variable Details

#### `NEXT_PUBLIC_SUPABASE_URL`
- **Format**: `https://<project-id>.supabase.co`
- **Where to get it**: Supabase Dashboard → Project Settings → API → Project URL
- **Used in**: Supabase client initialization (browser and server)

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Format**: JWT string starting with `eyJ...`
- **Where to get it**: Supabase Dashboard → Project Settings → API → `anon` `public` key
- **Used in**: Supabase client initialization for browser-side auth flows
- **Safety**: This key is subject to Supabase RLS policies — it cannot bypass row-level security

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Format**: JWT string starting with `eyJ...`
- **Where to get it**: Supabase Dashboard → Project Settings → API → `service_role` key
- **⚠️ Warning**: This key bypasses RLS. Only used server-side for admin operations (invite user, system triggers).
- **Used in**: `lib/supabase/admin.ts`, `app/actions/users.ts`

#### `GROQ_API_KEY`
- **Format**: `gsk_<random-string>`
- **Where to get it**: [console.groq.com](https://console.groq.com) → API Keys
- **Used in**: `lib/ai/classifyInvoice.ts`, `app/api/ocr/`, `supabase/functions/`
- **Timeouts enforced**: All Groq calls have `AbortSignal.timeout()` — if Groq is unavailable, users are gracefully redirected to manual entry

### Setting Variables in Vercel

1. Go to [vercel.com](https://vercel.com) → your project
2. Click **Settings** → **Environment Variables**
3. Add each variable above with its value
4. Set environment scope to **Production**, **Preview**, and **Development** as appropriate
5. Redeploy after adding variables

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier works)
- A Groq API key (free tier works)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Tusharsinghoffical/gstaccountingapp.git
cd gstaccountingapp

# 2. Install dependencies
npm ci

# 3. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your actual Supabase and Groq credentials

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Supabase Setup

### Database Migrations

Apply all migrations in order from `supabase/migrations/`:

```bash
# Using Supabase CLI
npx supabase db push

# Or manually via Supabase Dashboard SQL Editor, run each file in order:
# 1. 20240101000000_core_schema.sql
# 2. 20240101000001_rls_policies.sql
# 3. 20240101000002_invoice_numbering.sql
# 4. 20240101000003_invoice_immutability_and_notes.sql
# 5. 20240101000004_atomic_payments.sql
# 6. 20240101000005_party_running_balance.sql
# 7. 20240101000006_storage_buckets_and_rls.sql
# 8. 20240102000000_invoice_category.sql
# 9. 20240103000000_user_management.sql
# 10. 20240104000000_audit_log_triggers.sql
```

### Edge Functions

Deploy Edge Functions from `supabase/functions/`:

```bash
npx supabase functions deploy extract-invoice-ocr
npx supabase functions deploy structure-invoice-data
npx supabase functions deploy gstr1-export
npx supabase functions deploy ageing-report-export
```

### Storage Bucket

Create a private storage bucket named `invoice-documents` in your Supabase project:

```
Supabase Dashboard → Storage → New Bucket
Name: invoice-documents
Public: No (private)
```

The RLS policies for this bucket are already defined in `20240101000006_storage_buckets_and_rls.sql`.

### Auth Configuration

In Supabase Dashboard → Authentication → Settings:
- Enable **Email** provider
- Enable **Email confirmations** for production
- Set **Site URL** to your Vercel deployment URL
- Add your Vercel preview URL to **Additional redirect URLs**

---

## Render Deployment

### One-Click via Blueprint

This repo includes a [`render.yaml`](render.yaml) blueprint. Render auto-detects it:

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect your GitHub account and select **`gstaccountingapp`**
3. Render reads `render.yaml` and creates a **Web Service** automatically
4. Fill in the 4 secret environment variables when prompted (see below)
5. Click **Apply** — your app is live in ~3 minutes

### Setting Environment Variables in Render

In the Render Dashboard → your service → **Environment**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `GROQ_API_KEY` | `gsk_...` |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` are server-only secrets — never prefix them with `NEXT_PUBLIC_`.

### Manual Deploy via Render CLI

```bash
# Install Render CLI
npm i -g @render-com/cli

# Deploy
render up
```

### Post-Deploy Checklist

- [ ] All 4 environment variables set in Render service settings
- [ ] Supabase Auth **Site URL** updated to your Render service URL (e.g. `https://gst-ledger.onrender.com`)
- [ ] Supabase Auth **Additional redirect URLs** includes the Render URL
- [ ] All 10 database migrations applied in Supabase
- [ ] All Edge Functions deployed to Supabase
- [ ] `invoice-documents` storage bucket created (private)
- [ ] Verify `/` → redirects to login for unauthenticated users
- [ ] Verify admin-only routes (`/settings/users`, `/settings/audit-log`) are blocked for non-admin roles

---

## CI / Testing

### Test Suite

```bash
# Run all tests (18 test files, 200+ assertions)
npm test

# Run a specific test file
node --test tests/rls_penetration.test.ts
```

### Test Files

| File | Description |
|---|---|
| `rls_penetration.test.ts` | **Cross-tenant RLS isolation** — 800+ assertions across all tables |
| `invoice_immutability.test.ts` | Immutability rules for confirmed invoices |
| `invoice_concurrency.test.ts` | Concurrent invoice creation safety |
| `payment_allocation.test.ts` | Payment allocation and ledger consistency |
| `party_running_balance.test.ts` | Running balance correctness |
| `gstr1_report.test.ts` | GSTR-1 report generation and grouping |
| `ageing_report.test.ts` | Ageing bucket calculation correctness |
| `audit_log.test.ts` | Audit log trigger behavior |
| `user_management.test.ts` | RBAC and user invite logic |
| `invoice_category_ai.test.ts` | AI category suggestion and fallback |
| `ocr_extraction.test.ts` | OCR extraction pipeline |
| `ocr_review_flow.test.ts` | OCR review → invoice creation path |
| `ocr_structuring.test.ts` | Groq JSON structuring with fallbacks |
| `ocr_upload.test.ts` | File upload and validation |
| `format.test.ts` | Currency and number formatting |
| `gstin.test.ts` | GSTIN validation |
| `tax.test.ts` | GST tax calculation |
| `numberToWords.test.ts` | Number to Indian words conversion |

### GitHub Actions CI

Every push and pull request to `main` runs:
1. `npm test` — full test suite including RLS penetration matrix
2. `npm run build` — Next.js production build verification

**Schema or RLS policy changes must pass the full CI suite before merging.**

---

## Security

### Row-Level Security (RLS)

Every table is protected by PostgreSQL RLS policies:
- All data is scoped to `business_id`
- Users can only access rows belonging to businesses they are members of
- Admin-only operations (`audit_log`, `business_users`) have additional role checks
- RLS cannot be bypassed by the `anon` key — only the service role can bypass (server-only)

### Audit Trail

Financial mutations (invoices, payments, ledger entries) are automatically logged to `audit_log` via **Postgres triggers** — not application code. This ensures:
- No mutation can be silently unlogged
- Audit records are immutable (no `UPDATE`/`DELETE` RLS policies on `audit_log`)
- Diffs of what changed (before/after) are stored as JSONB

### Key Management

- `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` are **never** prefixed with `NEXT_PUBLIC_`
- These variables are only loaded in Server Actions, Route Handlers, and Edge Functions
- They are never bundled into client-side JavaScript

---

## AWS Audit Notice

> ✅ **This project contains zero AWS dependencies.**

A full audit was performed against:
- `package.json` dependencies and devDependencies
- `package-lock.json` resolved dependency tree
- All source files in `lib/`, `app/`, `components/`, `supabase/`

**No AWS SDK, AWS credentials, AWS-specific configuration, or AWS-hosted services exist anywhere in this codebase.**

Infrastructure is exclusively:
- **Supabase** (PostgreSQL, Auth, Storage, Edge Functions)
- **Render** (Frontend hosting)
- **Groq** (AI/OCR API)

---

## License

Private — All Rights Reserved © 2024 Tushar Singh
