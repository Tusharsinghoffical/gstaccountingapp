"use server";

import { recordPaymentSchema, RecordPaymentFormData } from "@/lib/validation/payment";
import { getCustomerById, getSupplierById } from "./parties";
import { Payment, PaymentAllocation } from "@/types";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

export type PaymentWithParty = Payment & {
  party_name: string;
  allocated_total: number;
  unallocated: number;
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

export async function getPaymentAllocations(
  businessId?: string
): Promise<PaymentAllocation[]> {
  const bizId = await getActiveBusinessId(businessId);
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
  const bizId = await getActiveBusinessId(businessId);
  const payments = await prisma.payment.findMany({
    where: { businessId: bizId },
    include: {
      allocations: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    payments.map(async (pay) => {
      let partyName = "Unknown Counterparty";
      const customer = await prisma.customer.findUnique({
        where: { id: pay.partyId },
        select: { name: true },
      });
      if (customer) {
        partyName = customer.name;
      } else {
        const supplier = await prisma.supplier.findUnique({
          where: { id: pay.partyId },
          select: { name: true },
        });
        if (supplier) partyName = supplier.name;
      }

      const allocated_total = pay.allocations.reduce(
        (sum, a) => sum + Number(a.allocatedAmount),
        0
      );
      const amountNum = Number(pay.amount);
      const unallocated = Math.max(0, amountNum - allocated_total);

      return {
        id: pay.id,
        business_id: pay.businessId,
        party_id: pay.partyId,
        party_name: partyName,
        amount: amountNum,
        date: pay.date,
        mode: pay.mode as Payment["mode"],
        reference_no: pay.referenceNo,
        notes: pay.notes,
        created_at: pay.createdAt.toISOString(),
        updated_at: pay.updatedAt.toISOString(),
        allocated_total,
        unallocated,
      };
    })
  );
}

/**
 * Returns all open (unpaid or partially paid) finalized invoices for a specific party directly from Prisma SQLite.
 */
export async function getOpenInvoicesForParty(
  partyId: string
): Promise<OpenInvoiceItem[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      customerOrSupplierId: partyId,
      status: "final",
    },
    include: {
      paymentAllocations: true,
    },
    orderBy: { invoiceDate: "asc" },
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
 * Atomically records a payment and allocates it across open invoices using Prisma transaction.
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

  const { party_id, amount, date, mode, reference_no, notes, allocations } =
    parsed.data;

  const customer = await getCustomerById(party_id);
  const supplier = customer ? null : await getSupplierById(party_id);

  if (!customer && !supplier) {
    return { success: false, error: "Selected counterparty does not exist." };
  }

  const bizId = await getActiveBusinessId();

  try {
    const createdPayment = await prisma.$transaction(async (tx) => {
      let totalAllocated = 0;

      for (const alloc of allocations) {
        if (alloc.allocated_amount <= 0) continue;

        const inv = await tx.invoice.findUnique({
          where: { id: alloc.invoice_id },
          include: { paymentAllocations: true },
        });
        if (!inv) {
          throw new Error(`Invoice ${alloc.invoice_id} does not exist.`);
        }

        if (inv.customerOrSupplierId !== party_id) {
          throw new Error(
            `Invoice ${inv.invoiceNo} does not belong to the selected counterparty.`
          );
        }

        if (inv.status !== "final") {
          throw new Error(
            `Invoice ${inv.invoiceNo} is in "${inv.status}" state. Only finalized invoices can receive payments.`
          );
        }

        const alreadyAllocated = inv.paymentAllocations.reduce(
          (sum, a) => sum + Number(a.allocatedAmount),
          0
        );
        const remaining = Math.max(
          0,
          Math.round((Number(inv.total) - alreadyAllocated) * 100) / 100
        );

        if (alloc.allocated_amount > remaining + 0.01) {
          throw new Error(
            `Allocation of ₹${alloc.allocated_amount} exceeds remaining balance of ₹${remaining} on invoice ${inv.invoiceNo}.`
          );
        }

        totalAllocated += alloc.allocated_amount;
      }

      if (totalAllocated > amount + 0.01) {
        throw new Error(
          `Total allocated amount (₹${totalAllocated}) exceeds the payment amount (₹${amount}).`
        );
      }

      const payment = await tx.payment.create({
        data: {
          businessId: bizId,
          partyId: party_id,
          amount,
          date,
          mode,
          referenceNo: reference_no || null,
          notes: notes || null,
        },
      });

      for (const alloc of allocations) {
        if (alloc.allocated_amount <= 0) continue;

        await tx.paymentAllocation.create({
          data: {
            businessId: bizId,
            paymentId: payment.id,
            invoiceId: alloc.invoice_id,
            allocatedAmount: alloc.allocated_amount,
          },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          businessId: bizId,
          partyId: party_id,
          entryType: customer ? "credit" : "debit",
          amount,
          refInvoiceId: allocations[0]?.invoice_id || null,
          refPaymentId: payment.id,
          description: `Payment recorded via ${mode.toUpperCase()}${
            reference_no ? ` (Ref: ${reference_no})` : ""
          }`,
          entryDate: date,
        },
      });

      return payment;
    });

    return {
      success: true,
      data: {
        id: createdPayment.id,
        business_id: createdPayment.businessId,
        party_id: createdPayment.partyId,
        amount: Number(createdPayment.amount),
        date: createdPayment.date,
        mode: createdPayment.mode as Payment["mode"],
        reference_no: createdPayment.referenceNo,
        notes: createdPayment.notes,
        created_at: createdPayment.createdAt.toISOString(),
        updated_at: createdPayment.updatedAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Payment allocation failed and was rolled back.",
    };
  }
}
