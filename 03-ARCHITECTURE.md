# Technical Architecture
## GST Ledger — Stack: Local Storage (SQLite + Filesystem) + Groq + Stitch-generated UI

> Structural note: this replaces the Supabase-based architecture entirely. This is not a small substitution — Supabase was providing four things at once (managed Postgres, hosted auth, RLS-based tenant isolation, and cloud file storage). Removing it means each of those four now needs its own answer. This doc gives you all four.

---

## 1. What Changes, Precisely

| Capability | Supabase version | Local-storage version |
|---|---|---|
| Database | Managed Postgres | SQLite file on local disk, via Prisma ORM |
| Auth | Supabase Auth (hosted, OTP built in) | NextAuth.js (Credentials provider) + bcrypt, self-hosted |
| Tenant isolation | Postgres RLS (DB-enforced) | Application-layer authorization module (code-enforced — see §5) |
| File storage | Supabase Storage (cloud) | Local filesystem, served via authenticated route handlers |
| Realtime | Supabase Realtime (available, unused in v1 anyway) | Not available — out of scope, matches v1 needs |
| Hosting implication | Frontend on Vercel, backend fully managed | Needs **persistent disk** — see §6, this rules out pure serverless hosting |

The one thing that doesn't change: Groq for AI inference, and Stitch for UI generation. Those were never coupled to Supabase.

---

## 2. High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Next.js App (single persistent Node.js process)               │
│  - App Router pages (UI, scaffolded via Stitch)                │
│  - API/Route Handlers (business logic)                         │
│  - NextAuth.js (auth)                                          │
│  - Prisma ORM ──────────────► SQLite file (./data/app.db)       │
│  - File upload handlers ────► Local filesystem (./storage/)     │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │  Groq API             │
              │  (Llama-family models)│
              │  - OCR text structuring│
              │  - Categorization      │
              └────────────────────────┘
```

**Why one process, not split frontend/backend:** SQLite is a single-file, single-machine database. Splitting the frontend onto Vercel (serverless, ephemeral filesystem) while the "backend" tries to read/write a SQLite file somewhere else defeats the entire point of local storage — there'd be no single place the file reliably lives. Keep the whole app as one deployable Next.js unit running as a persistent process (see §6 for where that process actually runs).

---

## 3. AI Pipeline (OCR + Groq) — unchanged from before, still the assumption to verify

**Groq is an inference API — it is not, by itself, an OCR engine.** Pipeline:

1. **Vision/OCR stage** — extract raw text/layout from the image or PDF.
   - Check whether a vision-capable model is available on your Groq account first
   - Fallback: Tesseract.js running as a local Node process (fits the local-first theme well — no external OCR API dependency either)
2. **Structuring stage** — Groq (text) LLM takes raw OCR text and returns structured JSON via a strict JSON-mode/function-calling prompt, validated against a zod schema before use

Files uploaded for OCR are written to `./storage/{business_id}/invoices/` and never exposed via a public static path — see §5.

---

## 4. Data Model (Core Tables — same shape, now expressed as SQLite/Prisma)

```prisma
model Business {
  id         String   @id @default(uuid())
  name       String
  gstin      String
  stateCode  String
  createdAt  DateTime @default(now())
  users      BusinessUser[]
  customers  Customer[]
  suppliers  Supplier[]
  invoices   Invoice[]
}

model BusinessUser {
  businessId String
  userId     String
  role       Role     // admin | accountant | auditor
  business   Business @relation(fields: [businessId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
  @@id([businessId, userId])
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
  businesses    BusinessUser[]
}

model Invoice {
  id             String   @id @default(uuid())
  businessId     String
  type           String   // sales | purchase
  partyId        String
  invoiceNo      String
  invoiceDate    DateTime
  status         String   // draft | final | cancelled
  subtotal       Decimal
  cgst           Decimal
  sgst           Decimal
  igst           Decimal
  total          Decimal
  financialYear  String
  items          InvoiceItem[]
  business       Business @relation(fields: [businessId], references: [id])
  @@index([businessId])
}

// InvoiceItem, Customer, Supplier, Payment, PaymentAllocation,
// LedgerEntry, AuditLog, TaxRateConfig — same fields/relations as the
// Supabase-version schema, ported 1:1 into Prisma models. businessId
// stays denormalized onto every business-scoped table (unchanged reasoning:
// keeps every authorization check a single indexed lookup, not a join).
```

**Ledger balances remain derived, never stored** — same reasoning as before, unrelated to which database sits underneath.

**SQLite-specific note:** enable `PRAGMA journal_mode=WAL;` at startup — allows concurrent readers while a write is in progress, which matters once OCR extraction, report generation, and normal invoice entry are all hitting the DB around the same time.

---

## 5. Security Model — the part that changed the most

With no RLS, tenant isolation and RBAC live entirely in one place: a **data-access layer** that every part of the app must go through.

```
lib/data/invoices.ts
  export async function getInvoices(session: Session, businessId: string) {
    assertBusinessMembership(session.user.id, businessId);   // throws if not a member
    return prisma.invoice.findMany({ where: { businessId } });
  }

  export async function createInvoice(session: Session, businessId: string, data: ...) {
    assertRole(session.user.id, businessId, ['admin', 'accountant']);
    return prisma.invoice.create({ data: { ...data, businessId } });
  }
```

**Rules, non-negotiable given there's no DB-level backstop:**
1. **No route handler or Server Action calls `prisma` directly.** Every read/write goes through a function in `lib/data/*` that takes the session and does the membership/role check first.
2. `assertBusinessMembership` and `assertRole` live in exactly one file (`lib/auth/authorize.ts`) — never reimplemented inline in a route.
3. File access (`FR-3.5`) goes through the same pattern: check business membership before streaming any file from `./storage/`.
4. Audit log writes happen inside the same data-access functions (e.g., `createInvoice` also writes an `AuditLog` row in the same transaction) — not bolted on separately where it's easy to forget.
5. **Automated authorization test suite is mandatory before merge** on any change to `lib/data/*` or `lib/auth/*` — see Build Prompts §Phase 7. This is the direct replacement for the old "RLS penetration test," and it matters more now, not less, because there's no second layer catching a mistake.

---

## 6. Deployment & The Persistent-Disk Constraint

This is the part most likely to bite you if skipped: **local storage means the app needs to run somewhere with a persistent, writable disk that survives restarts.**

Options, ranked by fit for your no-budget constraint:

1. **Run it locally** (your own machine or office server) — zero cost, zero external dependency, but only reachable on that machine/local network unless you set up your own tunneling (e.g., a reverse proxy) — fine for a single-business pilot, not for a CA managing remote clients
2. **A cheap VPS** (e.g., a $4-6/mo box) with the SQLite file and `./storage` folder on its normal disk — simplest mental model, full control, small but nonzero recurring cost
3. **A PaaS with a persistent volume** (e.g., Render/Railway/Fly.io free or low tiers that support attached disks) — closer to zero-ops than a raw VPS, but confirm the free tier actually persists a volume across deploys before relying on it — some free tiers reset ephemeral storage
4. **Do not use Vercel (or any pure serverless host) for this app** — serverless functions do not guarantee a persistent local filesystem between invocations; a SQLite file written in one request may not exist in the next. This isn't a configuration detail to work around, it's a fundamental mismatch with the architecture you've chosen.

Whichever you pick, back it up (FR-9) — a VPS or PaaS box is still a single point of failure without one.

---

## 7. Second-Order Considerations (updated for local storage)

1. **Single-writer ceiling**: SQLite serializes writes. Fine at one-business/SME scale; if this product ever needs many businesses writing concurrently on one shared instance, that's the point to evaluate moving to Postgres — which is why the ORM abstraction (§4) matters: that migration should be schema/connection-string work, not a rewrite.
2. **No automatic offsite redundancy** — you are now solely responsible for backup cadence and restore testing (FR-9). This is the single biggest operational responsibility this pivot adds.
3. **RBAC has no second line of defense** — worth repeating from §5: a bug in the data-access layer is now a direct tenant-isolation breach, not something RLS catches as a backstop. Treat that layer with the same rigor as payment code.
4. **GST rate changes** — unchanged: `TaxRateConfig` table with effective-date ranges keeps this a data update, not a deploy.
5. **Groq rate limits under OCR load** — unchanged reasoning, still queue extraction jobs rather than calling Groq synchronously from the upload request.
