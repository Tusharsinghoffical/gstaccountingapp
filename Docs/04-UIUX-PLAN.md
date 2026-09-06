# UI/UX Development Plan
## GST Ledger — Design via Google Stitch (Local-Storage Architecture)

---

## 1. Design Principles

- **Zero accounting-jargon by default** — surface "money in / money out / owed to you / you owe" language; GST terminology (CGST/SGST/IGST) shown but not load-bearing for the primary dashboard read
- **OCR-review is a first-class screen, not a modal afterthought** — extracted data is never auto-committed (Requirements FR-3.3), so the review/edit screen needs the same design care as invoice creation itself
- **Mobile-responsive, not mobile-native** — v1 is web-only
- **New, local-storage-specific principle: make the single-server nature visible, not hidden.** Since there's no cloud redundancy or multi-device sync now (Architecture §6-7), the UI should never imply "your data is safely in the cloud" — a visible backup-status indicator (FR-9.3) and an honest "this runs from one server" framing during onboarding prevents users from assuming guarantees the architecture doesn't provide

## 2. Screen Inventory (build these in Stitch, in this order)

| # | Screen | Priority | Key elements |
|---|---|---|---|
| 1 | Auth — Sign up / Login | P0 | Email + password fields only (no OTP step — see PRD §4) |
| 2 | Dashboard | P0 | Cash position, outstanding receivables, recent invoices, GST filing status widget, **backup status indicator** |
| 3 | Create/Edit Invoice | P0 | Line-item table, live GST calc preview, customer picker, PDF preview |
| 4 | Invoice List | P0 | Filter by status/date, search, bulk export |
| 5 | OCR Upload & Review | P0 | Drag-drop upload, extracted-fields editable form side-by-side with the source image |
| 6 | Customer/Supplier List + Detail | P1 | Ledger history per party, running balance, GSTIN validation indicator |
| 7 | Payment Recording | P1 | Allocate against open invoices (multi-select), partial payment support |
| 8 | Reports Hub | P1 | GSTR-1 summary, ageing report, P&L snapshot — each with export button |
| 9 | Settings / Business Profile | P2 | GSTIN, state code, invoice numbering config, user/role management |
| 10 | Role Management (admin only) | P2 | Invite user, assign role, revoke access |
| 11 | **Backup & Data (new)** | P1 | Last backup timestamp, manual "backup now" trigger, restore instructions link — a direct UI consequence of dropping managed cloud storage |

## 3. Core User Flows

### Flow A: First-time onboarding
```
Sign up (email + password) → Create business (name, GSTIN, state)
→ Onboarding screen explicitly states: "Your data lives on this server —
   set up a backup schedule before entering real invoices"
→ Land on empty Dashboard with a single CTA: "Create your first invoice"
```
Design requirement: the backup callout in onboarding isn't a legal disclaimer buried in fine print — it's a first-class onboarding step, because a cloud-SaaS user's mental model ("my data is just safe somewhere") no longer holds and the UI has to correct that assumption once, upfront, not let the user discover it after data loss.

### Flow B: OCR invoice capture (the differentiator flow — design this carefully)
```
Upload photo/PDF → Loading state (extraction in progress, ~10-15s)
→ Review screen: extracted fields shown editable, source image pinned alongside
→ User confirms/corrects → Save → Supplier ledger + purchase invoice created
```
Design requirement: the review screen must make it obvious nothing is final yet — a persistent "Review extracted data" banner, not a subtle label.

### Flow C: Monthly GST filing prep
```
Reports Hub → GSTR-1 Summary → Review B2B/B2C split
→ Export XLSX → (hand off to CA / GSTN portal manually — v1 has no auto-filing)
```

### Flow D: Backup check-in (new)
```
Dashboard backup widget shows "Last backup: 2 days ago" in a warning color
if overdue → click-through to Backup & Data screen → manual trigger or
confirmation that the scheduled job is running
```

## 4. Component System (for Stitch generation prompts)

Ask Stitch to generate a consistent component library first, then screens:
- Data table (sortable, filterable — reused across Invoice List, Customer List, Reports)
- Status badge (draft/final/cancelled, paid/partial/overdue)
- Currency input (₹, always 2-decimal, right-aligned per accounting convention)
- Line-item editor row (used in both manual invoice creation and OCR review)
- Empty states (every list screen needs one)
- **Backup status chip** (new — green/amber/red based on last-backup recency)

## 5. Accessibility & Locale Notes
- Currency formatting: Indian numbering system (₹1,00,000 not ₹100,000)
- Date format: DD/MM/YYYY throughout
- Regional language labels: post-v1 consideration, don't build i18n scaffolding now

## 6. Handoff to Antigravity
Once Stitch screens are approved, export components/assets and feed them as reference context into Antigravity per the prompt sequence in `05-BUILD-PROMPTS.md` — Stitch produces the visual/component layer, Antigravity wires it to the local Prisma/SQLite data layer + Groq logic (no Supabase wiring anymore).
