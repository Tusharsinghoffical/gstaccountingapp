# Product Requirements Document (PRD)
## Product: GST Ledger — AI-Native GST Accounting Platform for Indian SMEs

> Assumption flagged: app name left blank in your brief — using "GST Ledger" from your README. Swap in final branding later; nothing here is name-coupled.

---

## 1. Problem Statement

Indian SMEs, retailers, and CAs currently split their workflow across 3–4 disconnected tools: Tally/Excel for books, WhatsApp/email for invoice collection, a separate GST portal for filing, and manual reconciliation in between. The load-bearing pain points:

- **Manual data entry** from physical/PDF invoices into ledgers (error-prone, time-sunk)
- **GST return prep** is a monthly fire-drill — reconciling GSTR-1/GSTR-3B against books
- **No real-time visibility** into outstanding receivables, cash position, or filing status
- **CAs manage 20–50 clients** with no unified dashboard — everything is file-transfer based

## 2. Product Vision

A single-tenant-to-multi-tenant capable, AI-assisted accounting system where:
1. Invoices are captured via OCR + LLM extraction (not manual entry)
2. GST compliance (GSTR-1, GSTR-3B, GSTR-2B reconciliation) is computed automatically from ledger data
3. Every business gets real-time financial visibility without needing an accountant to generate a report

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
- Role-based access: Admin, Accountant, Auditor (read-only)
- Auth (email/password + OTP) via Supabase Auth

**Explicitly out of scope for v1** (load-bearing scope cut — do not silently creep):
- Direct GSTN portal API filing (v1 produces filing-ready exports, not auto-filing — GSTN API access requires GSP registration, a separate compliance/cost track)
- Inventory management (listed in original roadmap as "Future")
- Payroll
- Mobile native app (responsive web only for v1)
- Multi-currency / export invoicing

## 5. Non-Goals (explicit, to prevent scope drift)
- Not a replacement for a CA's professional judgment on tax filing — it's a data-prep and visibility layer
- Not competing with Tally on desktop/offline-first use cases

## 6. Success Metrics

| Metric | v1 Target |
|---|---|
| Invoice creation time | < 60 sec manual, < 15 sec via OCR |
| OCR extraction accuracy (field-level) | > 90% on typed invoices, > 75% on handwritten/scanned |
| GST calculation accuracy | 100% (deterministic — this is non-negotiable, see Architecture doc) |
| Time-to-first-invoice (new user) | < 5 minutes from signup |

## 7. Competitive Framing (3 lenses)

1. **Vs. Tally/Busy** — optimizes for cloud-native, real-time collaboration, zero installation; sacrifices deep offline reliability and India's incumbent trust/habit moat.
2. **Vs. Zoho Books/QuickBooks India** — optimizes for GST-first design + AI-native data entry; sacrifices the broader ERP feature depth those platforms already have after years of iteration.
3. **Vs. staying on Excel + CA WhatsApp group** — optimizes for structure and automation; sacrifices the zero-cost, zero-learning-curve status quo — this is the actual competitor for the bottom of the SME market, not other SaaS tools.

## 8. Monetization (tentative — not v1-blocking)
- Freemium: 1 business, up to 20 invoices/month, 1 user
- Paid tier: unlimited invoicing, multi-user RBAC, OCR quota, GST report exports
- CA tier: multi-client workspace switcher

## 9. Risks (explicit, ranked)

| Risk | Severity | Mitigation |
|---|---|---|
| GST rate/rule changes (government-driven) | High | Keep tax rules in a versioned config table, not hardcoded logic |
| Groq API rate limits/downtime blocking OCR | Medium | Queue-based extraction with retry + manual-entry fallback always available |
| Supabase RLS misconfiguration exposing cross-tenant data | Critical | Mandatory RLS policy tests before any schema migration ships (see Architecture doc §Security) |
| OCR accuracy on poor-quality scans | Medium | Always show extracted data in an editable review screen before commit — never auto-commit OCR output |
