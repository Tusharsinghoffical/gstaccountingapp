# UI/UX Development Plan
## GST Ledger — Design via Google Stitch

---

## 1. Design Principles

- **Zero accounting-jargon by default** — surface "money in / money out / owed to you / you owe" language; GST terminology (CGST/SGST/IGST) shown but not load-bearing for the primary dashboard read
- **OCR-review is a first-class screen, not a modal afterthought** — since extracted data is never auto-committed (per Requirements FR-3.3), the review/edit screen needs the same design care as invoice creation itself
- **Mobile-responsive, not mobile-native** — v1 is web-only (per PRD scope cut); design must not assume touch-only interaction, but must not break on a phone browser either

## 2. Screen Inventory (build these in Stitch, in this order)

| # | Screen | Priority | Key elements |
|---|---|---|---|
| 1 | Auth — Sign up / Login / OTP | P0 | Email input, OTP field, business-creation step on first login |
| 2 | Dashboard | P0 | Cash position, outstanding receivables, recent invoices, GST filing status widget |
| 3 | Create/Edit Invoice | P0 | Line-item table, live GST calc preview, customer picker, PDF preview |
| 4 | Invoice List | P0 | Filter by status/date, search, bulk export |
| 5 | OCR Upload & Review | P0 | Drag-drop upload, extracted-fields editable form side-by-side with the source image |
| 6 | Customer/Supplier List + Detail | P1 | Ledger history per party, running balance, GSTIN validation indicator |
| 7 | Payment Recording | P1 | Allocate against open invoices (multi-select), partial payment support |
| 8 | Reports Hub | P1 | GSTR-1 summary, ageing report, P&L snapshot — each with export button |
| 9 | Settings / Business Profile | P2 | GSTIN, state code, invoice numbering config, user/role management |
| 10 | Role Management (admin only) | P2 | Invite user, assign role, revoke access |

## 3. Core User Flows

### Flow A: First-time onboarding
```
Sign up → Verify OTP → Create business (name, GSTIN, state)
→ Land on empty Dashboard with a single CTA: "Create your first invoice"
```

### Flow B: OCR invoice capture (the differentiator flow — design this carefully)
```
Upload photo/PDF → Loading state (extraction in progress, ~10-15s)
→ Review screen: extracted fields shown editable, source image pinned alongside
→ User confirms/corrects → Save → Supplier ledger + purchase invoice created
```
Design requirement: the review screen must make it *obvious* nothing is final yet — visually distinct from a normal "confirmed" invoice view (e.g., a persistent "Review extracted data" banner, not just a subtle label).

### Flow C: Monthly GST filing prep
```
Reports Hub → GSTR-1 Summary → Review B2B/B2C split
→ Export XLSX → (hand off to CA / GSTN portal manually — v1 has no auto-filing)
```

## 4. Component System (for Stitch generation prompts)

Ask Stitch to generate a consistent component library first, then screens — not the reverse. Components to establish early:
- Data table (sortable, filterable — reused across Invoice List, Customer List, Reports)
- Status badge (draft/final/cancelled, paid/partial/overdue)
- Currency input (₹, always 2-decimal, right-aligned per accounting convention)
- Line-item editor row (used in both manual invoice creation and OCR review)
- Empty states (every list screen needs one — first-time users will hit these constantly)

## 5. Accessibility & Locale Notes
- Currency formatting: Indian numbering system (₹1,00,000 not ₹100,000) — this is a real user-trust signal for an Indian accounting tool, not a cosmetic detail
- Date format: DD/MM/YYYY throughout (Indian convention, GST documents use this)
- Support for regional language labels is a post-v1 consideration — flag in Settings as a future toggle point, don't build the i18n scaffolding now if it's not in v1 scope

## 6. Handoff to Antigravity
Once Stitch screens are approved, export components/assets and feed them as reference context into Antigravity per the prompt sequence in `05-BUILD-PROMPTS.md` — Stitch produces the visual/component layer, Antigravity wires it to Supabase + Groq logic.
