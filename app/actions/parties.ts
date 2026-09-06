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
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

async function getActiveBusinessId(providedBizId?: string): Promise<string> {
  if (providedBizId) return providedBizId;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const bu = await prisma.businessUser.findFirst({
        where: { userId: (session.user as any).id, status: "active" },
        select: { businessId: true },
        orderBy: { createdAt: "asc" },
      });
      if (bu) return bu.businessId;
    }
  } catch {
    // Fallback if session is unavailable
  }
  const first = await prisma.business.findFirst({ select: { id: true } });
  return first?.id || "biz-1";
}

/**
 * Computes a party's balance summary dynamically at query time by summing ledger_entries.
 * Never reads from or writes to a mutable column.
 */
export async function getPartyBalance(
  partyId: string,
  partyType: "customer" | "supplier" = "customer"
): Promise<PartyBalanceSummary> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { partyId },
  });

  const total_debit = entries
    .filter((e) => e.entryType === "debit")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const total_credit = entries
    .filter((e) => e.entryType === "credit")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const net_balance = Math.round((total_debit - total_credit) * 100) / 100;
  const dr_cr: "Dr" | "Cr" = net_balance >= 0 ? "Dr" : "Cr";

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
    entry_count: entries.length,
    dr_cr,
    nature,
  };
}

/**
 * Appends a ledger entry in double-entry bookkeeping directly in Prisma SQLite.
 */
export async function addLedgerEntry(
  entry: Omit<LedgerEntry, "id" | "created_at">
): Promise<LedgerEntry> {
  const bizId = await getActiveBusinessId(entry.business_id);
  const created = await prisma.ledgerEntry.create({
    data: {
      businessId: bizId,
      partyId: entry.party_id,
      entryType: entry.entry_type,
      amount: entry.amount,
      refInvoiceId: entry.ref_invoice_id || null,
      refPaymentId: entry.ref_payment_id || null,
      description: entry.description,
      entryDate: entry.entry_date,
    },
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
 * Returns customers with running balance calculated at query time from SQLite.
 */
export async function getCustomers(
  businessId?: string
): Promise<(Customer & { balance: number; dr_cr: "Dr" | "Cr"; nature: string })[]> {
  const bizId = await getActiveBusinessId(businessId);
  const dbCustomers = await prisma.customer.findMany({
    where: { businessId: bizId, isActive: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    dbCustomers.map(async (c) => {
      const summary = await getPartyBalance(c.id, "customer");
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

export async function getCustomerById(id: string): Promise<Customer | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
  });
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
 * Returns suppliers with running balance calculated at query time from SQLite.
 */
export async function getSuppliers(
  businessId?: string
): Promise<(Supplier & { balance: number; dr_cr: "Dr" | "Cr"; nature: string })[]> {
  const bizId = await getActiveBusinessId(businessId);
  const dbSuppliers = await prisma.supplier.findMany({
    where: { businessId: bizId, isActive: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    dbSuppliers.map(async (s) => {
      const summary = await getPartyBalance(s.id, "supplier");
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

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const s = await prisma.supplier.findUnique({
    where: { id },
  });
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
 * Computes a party's chronological ledger with running balance calculated at query time.
 */
export async function getPartyLedgerEntries(
  partyId: string
): Promise<LedgerEntryWithRunningBalance[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { partyId },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  let running = 0;
  return entries.map((entry) => {
    const amountNum = Number(entry.amount);
    const isDebit = entry.entryType === "debit";
    const debit = isDebit ? amountNum : 0;
    const credit = !isDebit ? amountNum : 0;

    // Double-Entry Accounting:
    // Debit increases running balance; Credit decreases running balance
    running += debit - credit;

    return {
      id: entry.id,
      business_id: entry.businessId,
      party_id: entry.partyId,
      entry_type: entry.entryType as "debit" | "credit",
      amount: amountNum,
      ref_invoice_id: entry.refInvoiceId,
      ref_payment_id: entry.refPaymentId,
      description: entry.description,
      entry_date: entry.entryDate,
      created_at: entry.createdAt.toISOString(),
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
  const bizId = await getActiveBusinessId();

  if (id) {
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: cleanData.name,
        gstin: cleanData.gstin || null,
        stateCode: cleanData.state_code,
        email: cleanData.email || null,
        phone: cleanData.phone || null,
        billingAddress: cleanData.billing_address || null,
        pan: cleanData.pan || null,
      },
    });
    return {
      success: true,
      data: {
        id: updated.id,
        business_id: updated.businessId,
        name: updated.name,
        gstin: updated.gstin,
        state_code: updated.stateCode,
        email: updated.email,
        phone: updated.phone,
        billing_address: updated.billingAddress,
        shipping_address: updated.shippingAddress,
        pan: updated.pan,
        is_active: updated.isActive,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      },
    };
  }

  const created = await prisma.customer.create({
    data: {
      businessId: bizId,
      name: cleanData.name,
      gstin: cleanData.gstin || null,
      stateCode: cleanData.state_code,
      email: cleanData.email || null,
      phone: cleanData.phone || null,
      billingAddress: cleanData.billing_address || null,
      shippingAddress: cleanData.shipping_address || null,
      pan: cleanData.pan || null,
      isActive: true,
    },
  });

  return {
    success: true,
    data: {
      id: created.id,
      business_id: created.businessId,
      name: created.name,
      gstin: created.gstin,
      state_code: created.stateCode,
      email: created.email,
      phone: created.phone,
      billing_address: created.billingAddress,
      shipping_address: created.shippingAddress,
      pan: created.pan,
      is_active: created.isActive,
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
    },
  };
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
  const bizId = await getActiveBusinessId();

  if (id) {
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: cleanData.name,
        gstin: cleanData.gstin || null,
        stateCode: cleanData.state_code,
        email: cleanData.email || null,
        phone: cleanData.phone || null,
        billingAddress: cleanData.billing_address || null,
        pan: cleanData.pan || null,
      },
    });
    return {
      success: true,
      data: {
        id: updated.id,
        business_id: updated.businessId,
        name: updated.name,
        gstin: updated.gstin,
        state_code: updated.stateCode,
        email: updated.email,
        phone: updated.phone,
        billing_address: updated.billingAddress,
        pan: updated.pan,
        is_active: updated.isActive,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      },
    };
  }

  const created = await prisma.supplier.create({
    data: {
      businessId: bizId,
      name: cleanData.name,
      gstin: cleanData.gstin || null,
      stateCode: cleanData.state_code,
      email: cleanData.email || null,
      phone: cleanData.phone || null,
      billingAddress: cleanData.billing_address || null,
      pan: cleanData.pan || null,
      isActive: true,
    },
  });

  return {
    success: true,
    data: {
      id: created.id,
      business_id: created.businessId,
      name: created.name,
      gstin: created.gstin,
      state_code: created.stateCode,
      email: created.email,
      phone: created.phone,
      billing_address: created.billingAddress,
      pan: created.pan,
      is_active: created.isActive,
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
    },
  };
}

export async function deleteCustomer(id: string) {
  await prisma.customer.delete({
    where: { id },
  });
  return { success: true };
}

export async function deleteSupplier(id: string) {
  await prisma.supplier.delete({
    where: { id },
  });
  return { success: true };
}
