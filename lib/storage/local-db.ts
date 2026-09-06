/**
 * LocalDB — localStorage-backed persistence layer
 * ============================================================================
 * Persists all application data to the browser's localStorage so that:
 *  - Data survives page refreshes (unlike in-memory module-level variables)
 *  - The app works fully offline when Supabase is unreachable
 *  - Data is automatically synced back to Supabase when connection restores
 *
 * Keys are namespaced under "gst_ledger_" to avoid clashes.
 * All data is stored as JSON arrays, matching the Supabase table shapes.
 */

import type {
  Customer,
  Supplier,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentAllocation,
  LedgerEntry,
  AuditAction,
} from "@/types";

// ── Key Registry ─────────────────────────────────────────────────────────────

const KEYS = {
  customers: "gst_ledger_customers",
  suppliers: "gst_ledger_suppliers",
  invoices: "gst_ledger_invoices",
  invoice_items: "gst_ledger_invoice_items",
  payments: "gst_ledger_payments",
  payment_allocations: "gst_ledger_payment_allocations",
  ledger_entries: "gst_ledger_ledger_entries",
  audit_log: "gst_ledger_audit_log",
  settings: "gst_ledger_settings",
} as const;

// ── Audit log entry shape ────────────────────────────────────────────────────

export interface LocalAuditLogEntry {
  id: string;
  business_id: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string;
  diff: Record<string, unknown> | null;
  created_at: string;
}

// ── Safe localStorage helpers ────────────────────────────────────────────────

function isAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const k = "__gst_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function load<T>(key: string, fallback: T[]): T[] {
  if (!isAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T[]): void {
  if (!isAvailable()) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // Storage quota exceeded — log and continue
    console.warn("[LocalDB] Could not persist to localStorage:", e);
  }
}

// ── Seed data (used on first run when localStorage is empty) ─────────────────

const SEED_CUSTOMERS: Customer[] = [
  {
    id: "cust-1", business_id: "biz-local-1",
    name: "Bharat Enterprises", gstin: "27AAPFU0939F1ZV",
    state_code: "27", email: "accounts@bharatent.in", phone: "9820012345",
    billing_address: "Plot 42, MIDC Industrial Area, Pune, MH 411018",
    pan: "AAPFU0939F", is_active: true,
    created_at: "2024-04-01T10:00:00Z", updated_at: "2024-04-01T10:00:00Z",
  },
  {
    id: "cust-2", business_id: "biz-local-1",
    name: "Mahalaxmi Trading Co", gstin: "29AABCU9603R1ZK",
    state_code: "29", email: "mahalaxmi.traders@gmail.com", phone: "9845098765",
    billing_address: "Shop 12, Commercial Street, Bengaluru, KA 560001",
    pan: "AABCU9603R", is_active: true,
    created_at: "2024-04-05T11:30:00Z", updated_at: "2024-04-05T11:30:00Z",
  },
];

const SEED_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1", business_id: "biz-local-1",
    name: "TechParts India Pvt Ltd", gstin: "07AABCT3518Q1ZE",
    state_code: "07", email: "billing@techparts.in", phone: "9911223344",
    billing_address: "D-54, Okhla Industrial Estate, Delhi 110020",
    pan: "AABCT3518Q", is_active: true,
    created_at: "2024-04-02T09:00:00Z", updated_at: "2024-04-02T09:00:00Z",
  },
];

// ── ID Generator ─────────────────────────────────────────────────────────────

export function generateId(prefix = "local"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

// ── LocalDB class ────────────────────────────────────────────────────────────

export class LocalDB {
  private static initialized = false;

  /** Call once on app mount to seed empty localStorage with demo data */
  static init(): void {
    if (this.initialized || !isAvailable()) return;
    this.initialized = true;

    if (!localStorage.getItem(KEYS.customers)) {
      save(KEYS.customers, SEED_CUSTOMERS);
    }
    if (!localStorage.getItem(KEYS.suppliers)) {
      save(KEYS.suppliers, SEED_SUPPLIERS);
    }
    // Other tables start empty — user creates their own data
    if (!localStorage.getItem(KEYS.invoices))            save(KEYS.invoices, []);
    if (!localStorage.getItem(KEYS.invoice_items))       save(KEYS.invoice_items, []);
    if (!localStorage.getItem(KEYS.payments))            save(KEYS.payments, []);
    if (!localStorage.getItem(KEYS.payment_allocations)) save(KEYS.payment_allocations, []);
    if (!localStorage.getItem(KEYS.ledger_entries))      save(KEYS.ledger_entries, []);
    if (!localStorage.getItem(KEYS.audit_log))           save(KEYS.audit_log, []);
  }

  /** Wipe all local data (useful for sign-out / reset) */
  static clear(): void {
    if (!isAvailable()) return;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    this.initialized = false;
  }

  // ── Customers ──────────────────────────────────────────────────────────────

  static getCustomers(): Customer[] {
    return load<Customer>(KEYS.customers, SEED_CUSTOMERS);
  }

  static getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find((c) => c.id === id);
  }

  static saveCustomer(data: Omit<Customer, "id" | "created_at" | "updated_at">): Customer {
    const customer: Customer = {
      ...data,
      id: generateId("cust"),
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    const list = this.getCustomers();
    list.push(customer);
    save(KEYS.customers, list);
    this.audit("INSERT", "customers", customer.id, null, customer);
    return customer;
  }

  static updateCustomer(id: string, data: Partial<Customer>): Customer | null {
    const list = this.getCustomers();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const before = { ...list[idx] };
    list[idx] = { ...list[idx], ...data, updated_at: nowISO() };
    save(KEYS.customers, list);
    this.audit("UPDATE", "customers", id, before, list[idx]);
    return list[idx];
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────

  static getSuppliers(): Supplier[] {
    return load<Supplier>(KEYS.suppliers, SEED_SUPPLIERS);
  }

  static getSupplierById(id: string): Supplier | undefined {
    return this.getSuppliers().find((s) => s.id === id);
  }

  static saveSupplier(data: Omit<Supplier, "id" | "created_at" | "updated_at">): Supplier {
    const supplier: Supplier = {
      ...data,
      id: generateId("sup"),
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    const list = this.getSuppliers();
    list.push(supplier);
    save(KEYS.suppliers, list);
    this.audit("INSERT", "suppliers", supplier.id, null, supplier);
    return supplier;
  }

  static updateSupplier(id: string, data: Partial<Supplier>): Supplier | null {
    const list = this.getSuppliers();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const before = { ...list[idx] };
    list[idx] = { ...list[idx], ...data, updated_at: nowISO() };
    save(KEYS.suppliers, list);
    this.audit("UPDATE", "suppliers", id, before, list[idx]);
    return list[idx];
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  static getInvoices(): (Invoice & { party_name: string; items: InvoiceItem[] })[] {
    return load(KEYS.invoices, []);
  }

  static getInvoiceById(id: string): (Invoice & { party_name: string; items: InvoiceItem[] }) | undefined {
    return this.getInvoices().find((inv) => inv.id === id);
  }

  static saveInvoice(
    invoice: Omit<Invoice, "id" | "created_at" | "updated_at">,
    items: Omit<InvoiceItem, "id" | "invoice_id" | "created_at" | "updated_at">[],
    partyName: string,
  ): Invoice & { party_name: string; items: InvoiceItem[] } {
    const id = generateId("inv");
    const now = nowISO();
    const fullItems: InvoiceItem[] = items.map((item) => ({
      ...item,
      id: generateId("item"),
      invoice_id: id,
      business_id: invoice.business_id,
      created_at: now,
      updated_at: now,
    }));

    const fullInvoice: Invoice & { party_name: string; items: InvoiceItem[] } = {
      ...invoice,
      id,
      created_at: now,
      updated_at: now,
      party_name: partyName,
      items: fullItems,
    };

    const list = this.getInvoices();
    list.push(fullInvoice);
    save(KEYS.invoices, list);
    this.audit("INSERT", "invoices", id, null, fullInvoice);
    return fullInvoice;
  }

  static updateInvoiceStatus(id: string, status: string): boolean {
    const list = this.getInvoices();
    const idx = list.findIndex((inv) => inv.id === id);
    if (idx === -1) return false;
    const before = { ...list[idx] };
    list[idx] = { ...list[idx], status: status as Invoice["status"], updated_at: nowISO() };
    save(KEYS.invoices, list);
    this.audit("STATUS_CHANGE", "invoices", id, before, list[idx]);
    return true;
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  static getPayments(): Payment[] {
    return load<Payment>(KEYS.payments, []);
  }

  static getPaymentAllocations(): PaymentAllocation[] {
    return load<PaymentAllocation>(KEYS.payment_allocations, []);
  }

  static savePayment(
    payment: Omit<Payment, "id" | "created_at" | "updated_at">,
    allocations: Omit<PaymentAllocation, "id" | "payment_id" | "created_at">[],
  ): Payment {
    const id = generateId("pay");
    const now = nowISO();
    const fullPayment: Payment = { ...payment, id, created_at: now, updated_at: now };

    const payments = this.getPayments();
    payments.push(fullPayment);
    save(KEYS.payments, payments);

    const allocs = this.getPaymentAllocations();
    allocations.forEach((a) => {
      allocs.push({ ...a, id: generateId("alloc"), payment_id: id, created_at: now });
    });
    save(KEYS.payment_allocations, allocs);

    this.audit("INSERT", "payments", id, null, fullPayment);
    return fullPayment;
  }

  // ── Ledger Entries ─────────────────────────────────────────────────────────

  static getLedgerEntries(): LedgerEntry[] {
    return load<LedgerEntry>(KEYS.ledger_entries, []);
  }

  static addLedgerEntry(entry: Omit<LedgerEntry, "id" | "created_at">): LedgerEntry {
    const full: LedgerEntry = {
      ...entry,
      id: generateId("le"),
      created_at: nowISO(),
    };
    const list = this.getLedgerEntries();
    list.push(full);
    save(KEYS.ledger_entries, list);
    this.audit("INSERT", "ledger_entries", full.id, null, full);
    return full;
  }

  static getPartyLedger(partyId: string): LedgerEntry[] {
    return this.getLedgerEntries()
      .filter((e) => e.party_id === partyId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  // ── Audit Log ──────────────────────────────────────────────────────────────

  static getAuditLog(): LocalAuditLogEntry[] {
    return load<LocalAuditLogEntry>(KEYS.audit_log, []).reverse();
  }

  private static audit(
    action: AuditAction,
    table: string,
    recordId: string,
    before: unknown,
    after: unknown,
  ): void {
    const entry: LocalAuditLogEntry = {
      id: generateId("audit"),
      business_id: "biz-local-1",
      user_id: null,
      user_email: "local@offline.mode",
      action,
      table_name: table,
      record_id: recordId,
      diff: (before ? { before, after } : { after }) as Record<string, unknown>,
      created_at: nowISO(),
    };
    const list = load<LocalAuditLogEntry>(KEYS.audit_log, []);
    list.push(entry);
    // Keep last 500 entries only
    if (list.length > 500) list.splice(0, list.length - 500);
    save(KEYS.audit_log, list);
  }

  // ── Export all data (for manual backup) ────────────────────────────────────

  static exportAll(): string {
    return JSON.stringify(
      {
        exported_at: nowISO(),
        customers: this.getCustomers(),
        suppliers: this.getSuppliers(),
        invoices: this.getInvoices(),
        payments: this.getPayments(),
        payment_allocations: this.getPaymentAllocations(),
        ledger_entries: this.getLedgerEntries(),
      },
      null,
      2,
    );
  }
}
