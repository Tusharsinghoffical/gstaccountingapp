"use server";

import { recordPaymentSchema, RecordPaymentFormData } from "@/lib/validation/payment";
import { getCustomerById, getSupplierById } from "./parties";
import { Payment, PaymentAllocation } from "@/types";
import { getAuthenticatedSessionAndBusiness } from "@/lib/auth/authorize";
import {
  getPayments as dataGetPayments,
  getPaymentById as dataGetPaymentById,
  createPayment as dataCreatePayment,
} from "@/lib/data/payments";
import { getInvoices as dataGetInvoices } from "@/lib/data/invoices";
import { prisma } from "@/lib/prisma";

export type PaymentWithParty = Payment & {
  party_name: string;
  allocated_total: number;
  unallocated: number;
  allocations?: {
    id: string;
    business_id: string;
    payment_id: string;
    invoice_id: string;
    allocated_amount: number;
    created_at: string;
    invoice_no?: string;
    invoice_total?: number;
  }[];
};

export interface OpenInvoiceItem {
  id: string;
  invoice_no: string;
  invoice_date: string;
  type: string;
  total: number;
  paid_amount: number;
  remaining_balance: number;
}

export async function getPaymentAllocations(
  businessId?: string
): Promise<PaymentAllocation[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const allocations = await prisma.paymentAllocation.findMany({
    where: { businessId: bizId },
  });

  return allocations.map((a) => ({
    id: a.id,
    business_id: a.businessId,
    payment_id: a.paymentId,
    invoice_id: a.invoiceId,
    allocated_amount: Number(a.allocatedAmount),
    created_at: a.createdAt.toISOString(),
  }));
}

export async function getPayments(
  businessId?: string
): Promise<PaymentWithParty[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const payments = await dataGetPayments(session, bizId);

  return Promise.all(
    payments.map(async (p) => {
      let partyName = "Unknown Counterparty";
      const cust = await getCustomerById(p.partyId, bizId);
      if (cust) {
        partyName = cust.name;
      } else {
        const supp = await getSupplierById(p.partyId, bizId);
        if (supp) partyName = supp.name;
      }

      const allocated_total = p.allocations.reduce(
        (sum, a) => sum + Number(a.allocatedAmount),
        0
      );

      const amountNum = Number(p.amount);
      const unallocated = Math.max(0, amountNum - allocated_total);

      return {
        id: p.id,
        business_id: p.businessId,
        party_id: p.partyId,
        amount: amountNum,
        date: p.date,
        mode: p.mode as Payment["mode"],
        reference_no: p.referenceNo,
        notes: p.notes,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
        party_name: partyName,
        allocated_total,
        unallocated,
        allocations: p.allocations.map((a) => ({
          id: a.id,
          business_id: a.businessId,
          payment_id: a.paymentId,
          invoice_id: a.invoiceId,
          allocated_amount: Number(a.allocatedAmount),
          created_at: a.createdAt.toISOString(),
          invoice_no: a.invoice?.invoiceNo,
          invoice_total: a.invoice ? Number(a.invoice.total) : undefined,
        })),
      };
    })
  );
}

export async function getPaymentById(
  id: string,
  businessId?: string
): Promise<PaymentWithParty | null> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const p = await dataGetPaymentById(session, bizId, id);
  if (!p) return null;

  let partyName = "Unknown Counterparty";
  const cust = await getCustomerById(p.partyId, bizId);
  if (cust) {
    partyName = cust.name;
  } else {
    const supp = await getSupplierById(p.partyId, bizId);
    if (supp) partyName = supp.name;
  }

  const allocated_total = p.allocations.reduce(
    (sum, a) => sum + Number(a.allocatedAmount),
    0
  );
  const amountNum = Number(p.amount);

  return {
    id: p.id,
    business_id: p.businessId,
    party_id: p.partyId,
    amount: amountNum,
    date: p.date,
    mode: p.mode as Payment["mode"],
    reference_no: p.referenceNo,
    notes: p.notes,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    party_name: partyName,
    allocated_total,
    unallocated: Math.max(0, amountNum - allocated_total),
    allocations: p.allocations.map((a) => ({
      id: a.id,
      business_id: a.businessId,
      payment_id: a.paymentId,
      invoice_id: a.invoiceId,
      allocated_amount: Number(a.allocatedAmount),
      created_at: a.createdAt.toISOString(),
      invoice_no: a.invoice?.invoiceNo,
      invoice_total: a.invoice ? Number(a.invoice.total) : undefined,
    })),
  };
}

export async function getOpenInvoicesForParty(
  partyId: string,
  businessId?: string
): Promise<OpenInvoiceItem[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const invoices = await dataGetInvoices(session, bizId, {
    status: "final",
    partyId,
  });

  const openInvoices: OpenInvoiceItem[] = [];

  for (const inv of invoices) {
    const totalNum = Number(inv.total);
    const paidAmount = inv.paymentAllocations.reduce(
      (sum, a) => sum + Number(a.allocatedAmount),
      0
    );
    const remaining = Math.max(0, Math.round((totalNum - paidAmount) * 100) / 100);

    if (remaining > 0) {
      openInvoices.push({
        id: inv.id,
        invoice_no: inv.invoiceNo,
        invoice_date: inv.invoiceDate,
        type: inv.type,
        total: totalNum,
        paid_amount: paidAmount,
        remaining_balance: remaining,
      });
    }
  }

  return openInvoices;
}

/**
 * Atomically records a payment and allocates it across open invoices via lib/data/payments.ts.
 */
export async function recordPayment(
  formData: RecordPaymentFormData
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  const parsed = recordPaymentSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid payment data",
    };
  }

  const { party_id, amount, date, mode, reference_no, notes, allocations } = parsed.data;

  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness();

    const customer = await getCustomerById(party_id, bizId);
    const supplier = customer ? null : await getSupplierById(party_id, bizId);

    if (!customer && !supplier) {
      return { success: false, error: "Selected counterparty does not exist." };
    }

    const partyType = customer ? "customer" : "supplier";

    const payment = await dataCreatePayment(session, bizId, {
      partyId: party_id,
      partyType,
      amount,
      date,
      mode,
      referenceNo: reference_no,
      notes,
      allocations: allocations
        .filter((a) => a.allocated_amount > 0)
        .map((a) => ({
          invoiceId: a.invoice_id,
          allocatedAmount: a.allocated_amount,
        })),
    });

    return {
      success: true,
      data: {
        id: payment.id,
        business_id: payment.businessId,
        party_id: payment.partyId,
        amount: Number(payment.amount),
        date: payment.date,
        mode: payment.mode as Payment["mode"],
        reference_no: payment.referenceNo,
        notes: payment.notes,
        created_at: payment.createdAt.toISOString(),
        updated_at: payment.updatedAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}
