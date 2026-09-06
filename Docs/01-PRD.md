# Product Requirements Document (PRD)
## Product: GST Ledger — AI-Native GST Accounting Platform for Indian SMEs

> Stack update: Supabase removed per your instruction — replaced with a local-storage architecture (SQLite + local filesystem, no external BaaS). This is a bigger structural change than it looks; see Architecture doc §1 for what you gain/lose. Name assumption unchanged — using "GST Ledger" from your README.

---

## 1. Problem Statement

Indian SMEs, retailers, and CAs currently split their workflow across 3–4 disconnected tools: Tally/Excel for books, WhatsApp/email for invoice collection, a separate GST portal for filing, and manual reconciliation in between. The load-bearing pain points:

- **Manual data entry** from physical/PDF invoices into ledgers (error-prone, time-sunk)
- **GST return prep** is a monthly fire-drill — reconciling GSTR-1/GSTR-3B against books
- **No real-time visibility** into outstanding receivables, cash position, or filing status
- **CAs manage 20–50 clients** with no unified dashboard — everything is file-transfer based

## 2. Product Vision

A local-first, AI-assisted accounting system where:
1. Invoices are captured via OCR + LLM extraction (not manual entry)
2. GST compliance (GSTR-1, GSTR-3B, GSTR-2B reconciliation) is computed automatically from ledger data
3. Every business gets real-time financial visibility without needing an accountant to generate a report
4. All data lives on infrastructure you control — a local SQLite database and local filesystem, not a third-party managed backend

## 3. Target Users (Primary Personas)

| Persona | Core Need | Success Signal |
|---|---|---|
| SME Owner (1–20 employees) | "Am I profitable, who owes me money, is my GST filed" | Checks dashboard weekly instead of asking CA |
| Chartered Accountant | Manage multiple client books without file-swapping | Reduces per-client reconciliation time by 50%+ |
| Retailer/Wholesaler | Fast invoice creation, stock-linked billing | Invoice creation under 60 seconds |
| Solo Service Provider | Simple invoicing + payment tracking, minimal accounting knowledge | Zero accounting-jargon UI needed |

## 4. Goals — v1 (MVP) Scope

**In scope:**
- Sales & purchase invoicing (GST-compliant: CGST/SGST/IGST auto-split by state code)
- Customer/Supplier ledger with running balance
- Payment tracking & allocation against invoices
- OCR-based invoice ingestion (photo/PDF → structured data via Groq)
- Core reports: GSTR-1 summary, outstanding/ageing report, P&L snapshot
- Role-based access: Admin, Accountant, Auditor (read-only) — enforced in application code (see Architecture §5, no DB-level RLS available on SQLite)
- Auth: email + password (self-hosted, via NextAuth.js + bcrypt)

**Explicitly out of scope for v1** (load-bearing scope cut — do not silently creep):
- Direct GSTN portal API filing (v1 produces filing-ready exports, not auto-filing)
- OTP/SMS-based login — dropped as a direct consequence of removing Supabase Auth; self-hosting OTP requires a paid SMS/email-OTP provider, which conflicts with the no-budget constraint. Email + password is the v1 default; flag this as a deliberate trade, not an oversight.
- Inventory management
- Payroll
- Mobile native app (responsive web only for v1)
- Multi-currency / export invoicing
- Multi-device realtime sync (local storage is single-instance by design — see Architecture §6)

## 5. Non-Goals (explicit, to prevent scope drift)
- Not a replacement for a CA's professional judgment on tax filing — it's a data-prep and visibility layer
- Not competing with Tally on desktop/offline-first use cases — though the local-storage pivot moves this product structurally *closer* to that category than the original cloud-SaaS framing; worth naming since it changes who you're actually competing with (see §7)

## 6. Success Metrics

| Metric | v1 Target |
|---|---|
| Invoice creation time | < 60 sec manual, < 15 sec via OCR |
| OCR extraction accuracy (field-level) | > 90% on typed invoices, > 75% on handwritten/scanned |
| GST calculation accuracy | 100% (deterministic — non-negotiable, see Architecture doc) |
| Time-to-first-invoice (new user) | < 5 minutes from signup |
| Data durability | Automated local backup of the SQLite file + storage folder on a defined schedule — no cloud redundancy exists by default now, so this is a hard requirement, not a nice-to-have |

## 7. Competitive Framing (3 lenses) — updated for the local-storage pivot

1. **Vs. Tally/Busy** — this comparison is now sharper than before: both are local-data-model products. GST Ledger's edge is AI-native data entry (OCR + Groq) and a modern web UI; it sacrifices Tally's decades of offline-reliability hardening and enterprise trust.
2. **Vs. Zoho Books/QuickBooks India (cloud SaaS)** — GST Ledger now sacrifices the things cloud SaaS is good at (access-anywhere, automatic backup, multi-device sync) in exchange for zero recurring infra cost and full data control. This is a real strategic fork — be explicit with users about which world they're buying into.
3. **Vs. staying on Excel + CA WhatsApp group** — unchanged: still the actual bottom-of-market competitor. Local storage doesn't change this dynamic.

## 8. Monetization (tentative — not v1-blocking)
- Local/self-hosted version: one-time license or free, since there's no recurring cloud cost to recoup
- Optional future "hosted" tier (re-introducing a managed backend) could be a v2 upsell path — explicitly note this so the local-first architecture doesn't accidentally foreclose it (see Architecture §6 on keeping the data layer swappable)

## 9. Risks (explicit, ranked — updated for local storage)

| Risk | Severity | Mitigation |
|---|---|---|
| GST rate/rule changes (government-driven) | High | Keep tax rules in a versioned config table, not hardcoded logic |
| Groq API rate limits/downtime blocking OCR | Medium | Queue-based extraction with retry + manual-entry fallback always available |
| **Application-layer authorization bug exposing cross-tenant data** (was: Supabase RLS misconfiguration) | Critical | With no DB-level RLS, every query must go through a single shared data-access layer that enforces business_id + role scoping — see Architecture §5. Mandatory authorization test suite before any query-layer change ships. |
| **Data loss** (single SQLite file + local disk, no automatic cloud redundancy) | Critical (new, direct consequence of dropping Supabase) | Automated scheduled backup (file copy or SQLite `.backup` command) to a separate location; document a restore procedure before go-live |
| **No multi-device/multi-location access** by default | Medium (new) | If a business needs multi-location access, the app must run on a reachable server (VPS/local network), not a laptop — flag this to users during onboarding, don't let them discover it after data entry |
| OCR accuracy on poor-quality scans | Medium | Always show extracted data in an editable review screen before commit — never auto-commit OCR output |
