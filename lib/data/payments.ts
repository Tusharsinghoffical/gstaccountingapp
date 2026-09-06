import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertBusinessMembership,
  assertRole,
  getSessionUserId,
} from "@/lib/auth/authorize";
import { Prisma } from "@prisma/client";

export interface CreatePaymentAllocationInput {
  invoiceId: string;
  allocatedAmount: number | string;
}

export interface CreatePaymentInput {
  partyId: string;
  partyType?: "customer" | "supplier";
  amount: number | string;
  date: string; // YYYY-MM-DD
  mode: "cash" | "bank_transfer" | "upi" | "cheque" | "other";
  referenceNo?: string | null;
  notes?: string | null;
  allocations?: CreatePaymentAllocationInput[];
}

export async function getPayments(
  session: AuthSession,
  businessId: string,
  filter?: { partyId?: string; dateFrom?: string; dateTo?: string }
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.payment.findMany({
    where: {
      businessId,
      ...(filter?.partyId ? { partyId: filter.partyId } : {}),
      ...(filter?.dateFrom || filter?.dateTo
        ? {
            date: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
    },
    include: {
      allocations: {
        include: {
          invoice: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function getPaymentById(
  session: AuthSession,
  businessId: string,
  paymentId: string
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.payment.findFirst({
    where: { id: paymentId, businessId },
    include: {
      allocations: {
        include: {
          invoice: true,
        },
      },
    },
  });
}

export async function createPayment(
  session: AuthSession,
  businessId: string,
  data: CreatePaymentInput
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  const amount = new Prisma.Decimal(data.amount);

  return prisma.$transaction(async (tx) => {
    // 1. Create Payment
    const payment = await tx.payment.create({
      data: {
        businessId,
        partyId: data.partyId,
        amount,
        date: data.date,
        mode: data.mode,
        referenceNo: data.referenceNo || null,
        notes: data.notes || null,
      },
    });

    // 2. Create Allocations if provided
    if (data.allocations && data.allocations.length > 0) {
      for (const alloc of data.allocations) {
        // Verify invoice belongs to the same business
        const inv = await tx.invoice.findFirst({
          where: { id: alloc.invoiceId, businessId },
        });
        if (!inv) {
          throw new Error(`Invoice ${alloc.invoiceId} does not belong to business ${businessId}`);
        }

        await tx.paymentAllocation.create({
          data: {
            businessId,
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            allocatedAmount: new Prisma.Decimal(alloc.allocatedAmount),
          },
        });
      }
    }

    // 3. Post to double-entry ledger
    // Default: customer paying us is a "credit" to customer account (reducing their receivable).
    // Supplier we are paying is a "debit" to supplier account (reducing our payable).
    const isSupplier = data.partyType === "supplier";
    const entryType = isSupplier ? "debit" : "credit";

    await tx.ledgerEntry.create({
      data: {
        businessId,
        partyId: data.partyId,
        entryType,
        amount,
        refPaymentId: payment.id,
        description: `Payment ${payment.referenceNo ? `Ref: ${payment.referenceNo}` : ""} (${payment.mode})`,
        entryDate: data.date,
      },
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "INSERT",
        tableName: "payments",
        recordId: payment.id,
        diff: JSON.stringify({
          amount: payment.amount.toString(),
          mode: payment.mode,
          partyId: payment.partyId,
        }),
      },
    });

    return payment;
  });
}
