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
import { getAuthenticatedSessionAndBusiness } from "@/lib/auth/authorize";
import {
  getCustomers as dataGetCustomers,
  getCustomerById as dataGetCustomerById,
  createCustomer as dataCreateCustomer,
  updateCustomer as dataUpdateCustomer,
} from "@/lib/data/customers";
import {
  getSuppliers as dataGetSuppliers,
  getSupplierById as dataGetSupplierById,
  createSupplier as dataCreateSupplier,
  updateSupplier as dataUpdateSupplier,
} from "@/lib/data/suppliers";
import {
  getPartyLedger as dataGetPartyLedger,
  getPartyRunningBalance as dataGetPartyRunningBalance,
  createLedgerEntry as dataCreateLedgerEntry,
} from "@/lib/data/ledger";

/**
 * Computes a party's balance summary dynamically at query time using lib/data/ledger.ts.
 */
export async function getPartyBalance(
  partyId: string,
  partyType: "customer" | "supplier" = "customer",
  businessId?: string
): Promise<PartyBalanceSummary> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const ledger = await dataGetPartyLedger(session, bizId, partyId);
  const running = await dataGetPartyRunningBalance(session, bizId, partyId);

  const total_debit = ledger.reduce((sum, e) => sum + e.debit, 0);
  const total_credit = ledger.reduce((sum, e) => sum + e.credit, 0);
  const net_balance = running.drCr === "Dr" ? running.balance : -running.balance;

  let nature: "receivable" | "payable" | "advance" | "settled" = "settled";
  if (partyType === "customer") {
    if (net_balance > 0) nature = "receivable";
    else if (net_balance < 0) nature = "advance";
  } else {
    if (net_balance < 0) nature = "payable";
    else if (net_balance > 0) nature = "advance";
  }

  return {
    party_id: partyId,
    net_balance,
    total_debit,
    total_credit,
    entry_count: ledger.length,
    dr_cr: running.drCr,
    nature,
  };
}

/**
 * Appends a ledger entry in double-entry bookkeeping via lib/data/ledger.ts.
 */
export async function addLedgerEntry(
  entry: Omit<LedgerEntry, "id" | "created_at">
): Promise<LedgerEntry> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(entry.business_id);
  const created = await dataCreateLedgerEntry(session, bizId, {
    partyId: entry.party_id,
    entryType: entry.entry_type,
    amount: entry.amount,
    entryDate: entry.entry_date,
    description: entry.description,
    refInvoiceId: entry.ref_invoice_id,
    refPaymentId: entry.ref_payment_id,
  });

  return {
    id: created.id,
    business_id: created.businessId,
    party_id: created.partyId,
    entry_type: created.entryType as "debit" | "credit",
    amount: Number(created.amount),
    ref_invoice_id: created.refInvoiceId,
    ref_payment_id: created.refPaymentId,
    description: created.description,
    entry_date: created.entryDate,
    created_at: created.createdAt.toISOString(),
  };
}

/**
 * Returns customers with running balance calculated via lib/data/customers.ts.
 */
export async function getCustomers(
  businessId?: string
): Promise<(Customer & { balance: number; dr_cr: "Dr" | "Cr"; nature: string })[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const dbCustomers = await dataGetCustomers(session, bizId, { isActive: true });

  return Promise.all(
    dbCustomers.map(async (c) => {
      const summary = await getPartyBalance(c.id, "customer", bizId);
      return {
        id: c.id,
        business_id: c.businessId,
        name: c.name,
        gstin: c.gstin,
        state_code: c.stateCode,
        email: c.email,
        phone: c.phone,
        billing_address: c.billingAddress,
        shipping_address: c.shippingAddress,
        pan: c.pan,
        is_active: c.isActive,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
        balance: Math.abs(summary.net_balance),
        dr_cr: summary.dr_cr,
        nature: summary.nature,
      };
    })
  );
}

export async function getCustomerById(
  id: string,
  businessId?: string
): Promise<Customer | null> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const c = await dataGetCustomerById(session, bizId, id);
  if (!c) return null;

  return {
    id: c.id,
    business_id: c.businessId,
    name: c.name,
    gstin: c.gstin,
    state_code: c.stateCode,
    email: c.email,
    phone: c.phone,
    billing_address: c.billingAddress,
    shipping_address: c.shippingAddress,
    pan: c.pan,
    is_active: c.isActive,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

/**
 * Returns suppliers with running balance calculated via lib/data/suppliers.ts.
 */
export async function getSuppliers(
  businessId?: string
): Promise<(Supplier & { balance: number; dr_cr: "Dr" | "Cr"; nature: string })[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const dbSuppliers = await dataGetSuppliers(session, bizId, { isActive: true });

  return Promise.all(
    dbSuppliers.map(async (s) => {
      const summary = await getPartyBalance(s.id, "supplier", bizId);
      return {
        id: s.id,
        business_id: s.businessId,
        name: s.name,
        gstin: s.gstin,
        state_code: s.stateCode,
        email: s.email,
        phone: s.phone,
        billing_address: s.billingAddress,
        pan: s.pan,
        is_active: s.isActive,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
        balance: Math.abs(summary.net_balance),
        dr_cr: summary.dr_cr,
        nature: summary.nature,
      };
    })
  );
}

export async function getSupplierById(
  id: string,
  businessId?: string
): Promise<Supplier | null> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const s = await dataGetSupplierById(session, bizId, id);
  if (!s) return null;

  return {
    id: s.id,
    business_id: s.businessId,
    name: s.name,
    gstin: s.gstin,
    state_code: s.stateCode,
    email: s.email,
    phone: s.phone,
    billing_address: s.billingAddress,
    pan: s.pan,
    is_active: s.isActive,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

/**
 * Computes a party's chronological ledger with running balance via lib/data/ledger.ts.
 */
export async function getPartyLedgerEntries(
  partyId: string,
  businessId?: string
): Promise<LedgerEntryWithRunningBalance[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const entries = await dataGetPartyLedger(session, bizId, partyId);

  return entries.map((entry) => ({
    id: entry.id,
    business_id: entry.businessId,
    party_id: entry.partyId,
    entry_type: entry.entryType as "debit" | "credit",
    amount: Number(entry.amount),
    ref_invoice_id: entry.refInvoiceId,
    ref_payment_id: entry.refPaymentId,
    description: entry.description,
    entry_date: entry.entryDate,
    created_at: entry.createdAt.toISOString(),
    debit: entry.debit,
    credit: entry.credit,
    running_balance: entry.runningBalance,
    dr_cr: entry.drCr,
  }));
}

/**
 * Creates or updates a Customer record via lib/data/customers.ts.
 */
export async function saveCustomer(
  formData: PartyFormData,
  customerId?: string,
  businessId?: string
): Promise<{ success: boolean; data?: Customer; error?: string }> {
  const parsed = partyFormSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid customer input.",
    };
  }

  const { name, gstin, state_code, email, phone, billing_address, shipping_address } = parsed.data;

  if (gstin && gstin.trim() !== "") {
    const gstinValidation = validateGSTIN(gstin);
    if (!gstinValidation.isValid) {
      return { success: false, error: gstinValidation.error };
    }
  }

  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);

    const pan = gstin && gstin.length >= 10 ? gstin.substring(2, 12).toUpperCase() : undefined;

    let saved;
    if (customerId) {
      saved = await dataUpdateCustomer(session, bizId, customerId, {
        name,
        gstin: gstin || null,
        stateCode: state_code,
        email: email || null,
        phone: phone || null,
        billingAddress: billing_address || null,
        shippingAddress: shipping_address || null,
        pan: pan || null,
      });
    } else {
      saved = await dataCreateCustomer(session, bizId, {
        name,
        gstin: gstin || null,
        stateCode: state_code,
        email: email || null,
        phone: phone || null,
        billingAddress: billing_address || null,
        shippingAddress: shipping_address || null,
        pan: pan || null,
      });
    }

    return {
      success: true,
      data: {
        id: saved.id,
        business_id: saved.businessId,
        name: saved.name,
        gstin: saved.gstin,
        state_code: saved.stateCode,
        email: saved.email,
        phone: saved.phone,
        billing_address: saved.billingAddress,
        shipping_address: saved.shippingAddress,
        pan: saved.pan,
        is_active: saved.isActive,
        created_at: saved.createdAt.toISOString(),
        updated_at: saved.updatedAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save customer.",
    };
  }
}

/**
 * Creates or updates a Supplier record via lib/data/suppliers.ts.
 */
export async function saveSupplier(
  formData: PartyFormData,
  supplierId?: string,
  businessId?: string
): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  const parsed = partyFormSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid supplier input.",
    };
  }

  const { name, gstin, state_code, email, phone, billing_address } = parsed.data;

  if (gstin && gstin.trim() !== "") {
    const gstinValidation = validateGSTIN(gstin);
    if (!gstinValidation.isValid) {
      return { success: false, error: gstinValidation.error };
    }
  }

  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);

    const pan = gstin && gstin.length >= 10 ? gstin.substring(2, 12).toUpperCase() : undefined;

    let saved;
    if (supplierId) {
      saved = await dataUpdateSupplier(session, bizId, supplierId, {
        name,
        gstin: gstin || null,
        stateCode: state_code,
        email: email || null,
        phone: phone || null,
        billingAddress: billing_address || null,
        pan: pan || null,
      });
    } else {
      saved = await dataCreateSupplier(session, bizId, {
        name,
        gstin: gstin || null,
        stateCode: state_code,
        email: email || null,
        phone: phone || null,
        billingAddress: billing_address || null,
        pan: pan || null,
      });
    }

    return {
      success: true,
      data: {
        id: saved.id,
        business_id: saved.businessId,
        name: saved.name,
        gstin: saved.gstin,
        state_code: saved.stateCode,
        email: saved.email,
        phone: saved.phone,
        billing_address: saved.billingAddress,
        pan: saved.pan,
        is_active: saved.isActive,
        created_at: saved.createdAt.toISOString(),
        updated_at: saved.updatedAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save supplier.",
    };
  }
}
