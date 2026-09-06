"use server";

import { partyFormSchema, PartyFormData } from "@/lib/validation/party";
import { validateGSTIN } from "@/lib/validation/gstin";
import {
  Customer,
  Supplier,
  LedgerEntry,
  LedgerEntryWithRunningBalance,
  PartyBalanceSummary,
} from "@/types";

// In-memory persistent demo store for parties (NEVER stores mutable balance)
let demoCustomers: Customer[] = [
  {
    id: "cust-1",
    business_id: "biz-1",
    name: "Bharat Enterprises",
    gstin: "27AAPFU0939F1ZV",
    state_code: "27",
    email: "accounts@bharatent.in",
    phone: "9820012345",
    billing_address: "Plot 42, MIDC Industrial Area, Pune, MH 411018",
    pan: "AAPFU0939F",
    is_active: true,
    created_at: "2024-04-01T10:00:00Z",
    updated_at: "2024-04-01T10:00:00Z",
  },
  {
    id: "cust-2",
    business_id: "biz-1",
    name: "Mahalaxmi Trading Co",
    gstin: "29AABCU9603R1ZK",
    state_code: "29",
    email: "mahalaxmi.traders@gmail.com",
    phone: "9845098765",
    billing_address: "Shop 12, Commercial Street, Bengaluru, KA 560001",
    pan: "AABCU9603R",
    is_active: true,
    created_at: "2024-04-05T11:30:00Z",
    updated_at: "2024-04-05T11:30:00Z",
  },
  {
    id: "cust-3",
    business_id: "biz-1",
    name: "Local Retail Walk-in Customer",
    gstin: null,
    state_code: "27",
    email: null,
    phone: "9988776655",
    billing_address: "Mumbai Central",
    pan: null,
    is_active: true,
    created_at: "2024-04-10T14:00:00Z",
    updated_at: "2024-04-10T14:00:00Z",
  },
];

let demoSuppliers: Supplier[] = [
  {
    id: "supp-1",
    business_id: "biz-1",
    name: "Tata Steel Logistics & Supply",
    gstin: "27AAACT2828Q1ZU",
    state_code: "27",
    email: "billing@tatasteel-logistics.com",
    phone: "9819011223",
    billing_address: "Bombay House, Homi Mody Street, Mumbai 400001",
    pan: "AAACT2828Q",
    is_active: true,
    created_at: "2024-04-02T09:00:00Z",
    updated_at: "2024-04-02T09:00:00Z",
  },
  {
    id: "supp-2",
    business_id: "biz-1",
    name: "Southern Paper Mills Ltd",
    gstin: "33AABCS1429B1Z8",
    state_code: "33",
    email: "sales@southernpaper.in",
    phone: "9444055667",
    billing_address: "Industrial Estate, Guindy, Chennai, TN 600032",
    pan: "AABCS1429B",
    is_active: true,
    created_at: "2024-04-04T12:00:00Z",
    updated_at: "2024-04-04T12:00:00Z",
  },
];

// Double-entry event log (Balances are strictly derived on-the-fly from this log)
let demoLedger: LedgerEntry[] = [
  {
    id: "led-1",
    business_id: "biz-1",
    party_id: "cust-1",
    entry_type: "debit",
    amount: 145000,
    ref_invoice_id: "inv-1",
    ref_payment_id: null,
    description: "Tax Invoice INV/2024-25/0001 (Sales)",
    entry_date: "2024-04-15",
    created_at: "2024-04-15T10:00:00Z",
  },
  {
    id: "led-pay-1",
    business_id: "biz-1",
    party_id: "cust-1",
    entry_type: "credit",
    amount: 100000,
    ref_invoice_id: null,
    ref_payment_id: "pay-1",
    description: "Bank Transfer Receipt - Ref HDFC998822",
    entry_date: "2024-04-20",
    created_at: "2024-04-20T10:00:00Z",
  },
  {
    id: "led-2",
    business_id: "biz-1",
    party_id: "cust-2",
    entry_type: "debit",
    amount: 138500,
    ref_invoice_id: "inv-2",
    ref_payment_id: null,
    description: "Tax Invoice INV/2024-25/0002 (Sales)",
    entry_date: "2024-04-16",
    created_at: "2024-04-16T11:00:00Z",
  },
  {
    id: "led-3",
    business_id: "biz-1",
    party_id: "cust-2",
    entry_type: "credit",
    amount: 50000,
    ref_invoice_id: null,
    ref_payment_id: "pay-demo-1",
    description: "NEFT Payment received - Ref UTR98214",
    entry_date: "2024-04-18",
    created_at: "2024-04-18T15:30:00Z",
  },
  {
    id: "led-4",
    business_id: "biz-1",
    party_id: "supp-1",
    entry_type: "credit",
    amount: 236000,
    ref_invoice_id: "inv-3",
    ref_payment_id: null,
    description: "Purchase Invoice PUR/2024-25/0019",
    entry_date: "2024-04-17",
    created_at: "2024-04-17T12:00:00Z",
  },
  {
    id: "led-5",
    business_id: "biz-1",
    party_id: "supp-2",
    entry_type: "credit",
    amount: 64000,
    ref_invoice_id: "inv-4",
    ref_payment_id: null,
    description: "Purchase Invoice PUR/2024-25/0004",
    entry_date: "2024-04-04",
    created_at: "2024-04-04T12:00:00Z",
  },
];

/**
 * Computes a party's balance summary dynamically at query time by summing ledger_entries.
 * Never reads from or writes to a mutable column.
 */
export async function getPartyBalance(
  partyId: string,
  partyType: "customer" | "supplier" = "customer"
): Promise<PartyBalanceSummary> {
  const entries = demoLedger.filter((e) => e.party_id === partyId);

  const total_debit = entries
    .filter((e) => e.entry_type === "debit")
    .reduce((sum, e) => sum + e.amount, 0);

  const total_credit = entries
    .filter((e) => e.entry_type === "credit")
    .reduce((sum, e) => sum + e.amount, 0);

  const net_balance = Math.round((total_debit - total_credit) * 100) / 100;
  const dr_cr: "Dr" | "Cr" = net_balance >= 0 ? "Dr" : "Cr";

  let nature: "receivable" | "payable" | "advance" | "settled" = "settled";
  if (partyType === "customer") {
    if (net_balance > 0) nature = "receivable";
    else if (net_balance < 0) nature = "advance";
  } else {
    // For supplier: net_balance < 0 means credit > debit (we owe supplier)
    if (net_balance < 0) nature = "payable";
    else if (net_balance > 0) nature = "advance";
  }

  return {
    party_id: partyId,
    net_balance,
    total_debit,
    total_credit,
    entry_count: entries.length,
    dr_cr,
    nature,
  };
}

/**
 * Appends a ledger entry in double-entry bookkeeping.
 */
export async function addLedgerEntry(
  entry: Omit<LedgerEntry, "id" | "created_at">
): Promise<LedgerEntry> {
  const newEntry: LedgerEntry = {
    ...entry,
    id: `led-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  demoLedger.push(newEntry);
  return newEntry;
}

/**
 * Returns customers with running balance calculated at query time.
 */
export async function getCustomers(): Promise<
  (Customer & { balance: number; dr_cr: "Dr" | "Cr"; nature: string })[]
> {
  return Promise.all(
    demoCustomers.map(async (c) => {
      const summary = await getPartyBalance(c.id, "customer");
      return {
        ...c,
        balance: Math.abs(summary.net_balance),
        dr_cr: summary.dr_cr,
        nature: summary.nature,
      };
    })
  );
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return demoCustomers.find((c) => c.id === id) || null;
}

/**
 * Returns suppliers with running balance calculated at query time.
 */
export async function getSuppliers(): Promise<
  (Supplier & { balance: number; dr_cr: "Dr" | "Cr"; nature: string })[]
> {
  return Promise.all(
    demoSuppliers.map(async (s) => {
      const summary = await getPartyBalance(s.id, "supplier");
      return {
        ...s,
        balance: Math.abs(summary.net_balance),
        dr_cr: summary.dr_cr,
        nature: summary.nature,
      };
    })
  );
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  return demoSuppliers.find((s) => s.id === id) || null;
}

/**
 * Computes a party's chronological ledger with running balance calculated at query time.
 * Ordered by entry_date ASC, then created_at ASC, then id ASC.
 */
export async function getPartyLedgerEntries(
  partyId: string
): Promise<LedgerEntryWithRunningBalance[]> {
  const entries = demoLedger.filter((entry) => entry.party_id === partyId);

  // Chronological sort
  const sorted = [...entries].sort((a, b) => {
    const dateDiff =
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
    if (dateDiff !== 0) return dateDiff;

    const timeDiff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });

  let running = 0;
  return sorted.map((entry) => {
    const isDebit = entry.entry_type === "debit";
    const debit = isDebit ? entry.amount : 0;
    const credit = !isDebit ? entry.amount : 0;

    // Standard Double-Entry Accounting:
    // Debit increases running balance; Credit decreases running balance
    running += debit - credit;

    return {
      ...entry,
      debit,
      credit,
      running_balance: Math.round(running * 100) / 100,
      dr_cr: running >= 0 ? "Dr" : "Cr",
    };
  });
}

export async function saveCustomer(
  data: PartyFormData,
  id?: string
): Promise<{ success: boolean; data?: Customer; error?: string }> {
  const parsed = partyFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Validation failed",
    };
  }

  if (parsed.data.gstin) {
    const gstinCheck = validateGSTIN(parsed.data.gstin);
    if (!gstinCheck.isValid) {
      return { success: false, error: gstinCheck.error };
    }
  }

  const cleanData = parsed.data;

  if (id) {
    const idx = demoCustomers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      demoCustomers[idx] = {
        ...demoCustomers[idx],
        name: cleanData.name,
        gstin: cleanData.gstin || null,
        state_code: cleanData.state_code,
        email: cleanData.email || null,
        phone: cleanData.phone || null,
        billing_address: cleanData.billing_address || null,
        pan: cleanData.pan || null,
        updated_at: new Date().toISOString(),
      };
      return { success: true, data: demoCustomers[idx] };
    }
  }

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    business_id: "biz-1",
    name: cleanData.name,
    gstin: cleanData.gstin || null,
    state_code: cleanData.state_code,
    email: cleanData.email || null,
    phone: cleanData.phone || null,
    billing_address: cleanData.billing_address || null,
    shipping_address: cleanData.shipping_address || null,
    pan: cleanData.pan || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  demoCustomers.unshift(newCustomer);
  return { success: true, data: newCustomer };
}

export async function saveSupplier(
  data: PartyFormData,
  id?: string
): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  const parsed = partyFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Validation failed",
    };
  }

  if (parsed.data.gstin) {
    const gstinCheck = validateGSTIN(parsed.data.gstin);
    if (!gstinCheck.isValid) {
      return { success: false, error: gstinCheck.error };
    }
  }

  const cleanData = parsed.data;

  if (id) {
    const idx = demoSuppliers.findIndex((s) => s.id === id);
    if (idx !== -1) {
      demoSuppliers[idx] = {
        ...demoSuppliers[idx],
        name: cleanData.name,
        gstin: cleanData.gstin || null,
        state_code: cleanData.state_code,
        email: cleanData.email || null,
        phone: cleanData.phone || null,
        billing_address: cleanData.billing_address || null,
        pan: cleanData.pan || null,
        updated_at: new Date().toISOString(),
      };
      return { success: true, data: demoSuppliers[idx] };
    }
  }

  const newSupplier: Supplier = {
    id: `supp-${Date.now()}`,
    business_id: "biz-1",
    name: cleanData.name,
    gstin: cleanData.gstin || null,
    state_code: cleanData.state_code,
    email: cleanData.email || null,
    phone: cleanData.phone || null,
    billing_address: cleanData.billing_address || null,
    pan: cleanData.pan || null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  demoSuppliers.unshift(newSupplier);
  return { success: true, data: newSupplier };
}

export async function deleteCustomer(id: string) {
  demoCustomers = demoCustomers.filter((c) => c.id !== id);
  return { success: true };
}

export async function deleteSupplier(id: string) {
  demoSuppliers = demoSuppliers.filter((s) => s.id !== id);
  return { success: true };
}
