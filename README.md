# GST Ledger — Full-Stack GST Accounting Application

A production-grade, multi-tenant GST accounting system built with **Next.js 14**, **Prisma**, **SQLite (WAL mode)**, **NextAuth.js**, and **Groq AI**. Designed for Indian SMEs to manage sales/purchase invoices, parties, payments, double-entry ledgers, GST reports (GSTR-1, Ageing), and AI-assisted document processing — running completely locally without third-party BaaS dependencies.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Local Storage & Security Architecture](#local-storage--security-architecture)
- [Quick Start (Windows `run.bat`)](#quick-start-windows-runbat)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Backup & Restore Tooling](#backup--restore-tooling)
- [CI / Testing Suite](#ci--testing-suite)
- [Zero Cloud-BaaS Audit Notice](#zero-cloud-baas-audit-notice)

---

## Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript 5 | Server Components, Client Modals, Server Actions |
| **Styling** | Tailwind CSS 3 | Utility-first design system with responsive layouts |
| **Database** | SQLite via Prisma ORM (`@prisma/client`) | `data/app.db` with WAL mode and Decimal currency precision |
| **Authentication** | NextAuth.js (Credentials Provider) + `bcryptjs` | Multi-tenant session cookies and role authorization |
| **Authorization** | Application-level tenant assertions (`lib/auth/authorize.ts`) | Strict `businessId` boundary on all queries (replacing RLS) |
| **Local File Storage** | Node.js File System (`lib/storage/local-files.ts`) | Streamed via authenticated `/api/files/[id]` |
| **AI / OCR** | Groq API (`gsk_...`) | LLaMA 3.2 Vision for invoice extraction and category classification |
| **Reports & Exports**| ExcelJS + GST Rule 46 Print Engine | Direct XLSX export and vector PDF print views |
| **Testing** | Node.js Test Runner with `tsx` | 193 automated unit, concurrency, and cross-tenant tests |

---

## Local Storage & Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 Application                    │
│  ├── /app/(dashboard)/...   (App Router pages)              │
│  ├── /app/api/...           (NextAuth, OCR, File Streaming) │
│  └── /app/actions/...       (Server Actions)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    Prisma + SQLite (WAL)    │ │     Local File Storage      │
│  ├── ./data/app.db          │ │  ├── ./storage/{bizId}/     │
│  ├── 12 Relational Tables   │ │  └── invoices/{uuid}.{ext}  │
│  └── Decimal currency math  │ │  Streamed via auth session  │
└─────────────────────────────┘ └─────────────────────────────┘
               ▲
               │
┌──────────────┴──────────────┐
│  lib/auth/authorize.ts      │
│  ├── assertBusinessMember() │
│  └── assertRole()           │
└─────────────────────────────┘
```

### Key Security Design
1. **Isolated Tenant Boundary**:
   Every database operation passes through `lib/data/*.ts` and `lib/auth/authorize.ts`. A user from Business A attempting to read or mutate Business B's data receives a strict **403 Forbidden** error.
2. **Atomic Invoicing with Serialized Numbering**:
   Invoice creation runs inside serialized transactions with SQLite WAL mode (`connection_limit=1&busy_timeout=30000`), guaranteeing zero skipped or duplicate invoice numbers even under concurrent load.
3. **Protected Local Storage**:
   Invoice attachments are saved to `./storage/{businessId}/invoices/`. Files are **never** directly exposed via static public directories; access is authenticated and streamed through `/api/files/[id]?businessId=...`.
4. **Direct Groq AI Integration**:
   OCR and category suggestions communicate directly with Groq via server-side Node.js route handlers with timeouts and fallback to manual entry.

---

## Quick Start (Windows `run.bat`)

If you are on Windows, you can start the application with a single click:

1. **Double-click `run.bat`** in the project folder, OR open terminal and run:
   ```cmd
   .\run.bat
   ```
2. You will see an interactive menu:
   ```text
   ============================================================================
     GST Ledger — Accounting Management Platform
   ============================================================================

     [1] Run Locally with Node.js (npm run dev)    - [Fastest / Recommended]
     [2] Run with Docker (Build + Start Container)
     [3] Run Automated Test Suite (npm test)
     [4] Build Production Application (npm run build)
     [5] Stop Docker Container
     [6] View Docker Container Logs
     [7] Exit

   ============================================================================
   Select an option (1-7) [Default: 1]:
   ```
3. Press **Enter** or select `1` to run locally:
   - Automatically initializes `.env.local` if missing.
   - Verifies SQLite database file and runs `prisma db push`.
   - Starts local server and opens your browser at [http://localhost:3000](http://localhost:3000).

### CLI Shortcut Flags for `run.bat`:
- `.\run.bat dev` — Launch local Next.js dev server directly
- `.\run.bat docker` — Build image and run Docker container
- `.\run.bat test` — Execute automated test suite (193 tests)
- `.\run.bat build` — Run production bundle build (`npm run build`)
- `.\run.bat stop` — Stop Docker container
- `.\run.bat logs` — Tail live Docker logs

---

## Environment Variables

Copy `.env.local.example` → `.env.local`:

```env
# Local SQLite Database
DATABASE_URL="file:../data/app.db"

# NextAuth Configuration
NEXTAUTH_SECRET="gst-ledger-local-development-secret-32-chars-minimum"
NEXTAUTH_URL="http://localhost:3000"

# AI / OCR Integration (Groq API Key)
GROQ_API_KEY="gsk_your_groq_api_key_here"
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Push Prisma schema to SQLite
npx prisma db push

# 3. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to log in with seeded demo credentials:
- **Admin**: `admin@gstledger.local` / `admin123`
- **Accountant**: `accountant@gstledger.local` / `acc123`

---

## Docker Deployment

Build and run a standalone self-contained container with persistent SQLite volume:

```bash
# Build and run with docker-compose
docker compose up -d --build

# Or use run.bat
.\run.bat docker
```

Persistent volume mounts:
- `./data` → Container SQLite database
- `./storage` → Container invoice files

---

## Backup & Restore Tooling

GST Ledger includes automated backup and restore scripts utilizing SQLite's atomic `VACUUM INTO` and ZIP compression:

```bash
# Create a timestamped backup in ./backups/
npm run backup

# Output:
# [Backup] Performing SQLite VACUUM INTO snapshot...
# [Backup] Archiving database and storage files...
# [Backup] Verified archive integrity (MD5 checksum matched).
# [Backup] Completed successfully: ./backups/gst-ledger-backup-2026-09-06T20-30-00.zip

# Restore from backup archive
npm run restore ./backups/gst-ledger-backup-2026-09-06T20-30-00.zip
```

---

## CI / Testing Suite

Execute the comprehensive automated test suite (193 tests):

```bash
npm test
```

### Key Test Suites:
- `invoice_concurrency_sqlite.test.ts`: Fires 20 concurrent transactions creating invoices in WAL mode, asserting zero duplicate numbers and zero sequence gaps.
- `cross_tenant_authorization.test.ts`: Asserts strict 403 Forbidden errors across all tables when accessing resources with a different tenant session.
- `invoice_immutability.test.ts`: Enforces GST compliance rules preventing mutation of confirmed invoices.
- `payment_allocation.test.ts`: Validates running ledger balances and FIFO payment allocations.
- `gstr1_report.test.ts`: Verifies B2B, B2CL, B2CS, and HSN summary calculations.

---

## Zero Cloud-BaaS Audit Notice

> ✅ **This project is 100% free of Supabase, AWS, Firebase, or external BaaS dependencies.**

- No `@supabase/supabase-js` or `@supabase/ssr` packages in dependency tree.
- No cloud database connections required.
- All database state is stored in `./data/app.db`.
- All document attachments are stored in `./storage/`.

---

## License

Private — All Rights Reserved © 2024-2026 Tushar Singh
