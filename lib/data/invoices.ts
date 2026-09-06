import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertBusinessMembership,
  assertRole,
  getSessionUserId,
} from "@/lib/auth/authorize";
import { Prisma } from "@prisma/client";

export interface CreateInvoiceItemInput {
  description: string;
  hsnCode: string;
  qty: number | string;
  rate: number | string;
  discount?: number | string;
  taxableAmount: number | string;
  gstRate: number | string;
  cgstAmount: number | string;
  sgstAmount: number | string;
  igstAmount: number | string;
  amount: number | string;
}

export interface CreateInvoiceInput {
  type: "sales" | "purchase";
  customerOrSupplierId: string;
  invoiceNo?: string;
  invoiceDate: string;
  dueDate?: string | null;
  status?: "draft" | "final" | "cancelled";
  financialYear?: string;
  category?: string | null;
  notes?: string | null;
  items: CreateInvoiceItemInput[];
}

export function getCurrentFinancialYear(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  // Indian FY runs April 1 to March 31
  if (month >= 4) {
    const nextYearShort = String((year + 1) % 100).padStart(2, "0");
    return `${year}-${nextYearShort}`;
  } else {
    const currentYearShort = String(year % 100).padStart(2, "0");
    return `${year - 1}-${currentYearShort}`;
  }
}

export async function getInvoices(
  session: AuthSession,
  businessId: string,
  filter?: {
    type?: "sales" | "purchase";
    status?: "draft" | "final" | "cancelled";
    partyId?: string;
  }
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.invoice.findMany({
    where: {
      businessId,
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.partyId ? { customerOrSupplierId: filter.partyId } : {}),
    },
    include: {
      items: true,
      paymentAllocations: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getInvoiceById(
  session: AuthSession,
  businessId: string,
  invoiceId: string
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      businessId,
    },
    include: {
      items: true,
      paymentAllocations: {
        include: {
          payment: true,
        },
      },
    },
  });
}

/**
 * Creates an invoice within an atomic transaction.
 * Generates the sequence number sequentially using SQLite write serialization.
 */
export async function createInvoice(
  session: AuthSession,
  businessId: string,
  data: CreateInvoiceInput
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  const fy = data.financialYear || getCurrentFinancialYear(data.invoiceDate);

  return prisma.$transaction(async (tx) => {
    let finalInvoiceNo = data.invoiceNo;

    if (!finalInvoiceNo) {
      // Find all invoices for this business, type, and financial year to compute the next number
      const existingInvoices = await tx.invoice.findMany({
        where: {
          businessId,
          type: data.type,
          financialYear: fy,
        },
        select: {
          invoiceNo: true,
        },
      });

      let maxSeq = 0;
      const prefix = data.type === "sales" ? "INV" : "BILL";
      const regex = new RegExp(`^${prefix}-${fy}-(\\d+)$`);

      for (const inv of existingInvoices) {
        const match = inv.invoiceNo.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }

      finalInvoiceNo = `${prefix}-${fy}-${String(maxSeq + 1).padStart(4, "0")}`;
    }

    // Calculate totals using Decimal
    let subtotal = new Prisma.Decimal(0);
    let cgst = new Prisma.Decimal(0);
    let sgst = new Prisma.Decimal(0);
    let igst = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);

    const itemsData = data.items.map((item) => {
      const itemTaxable = new Prisma.Decimal(item.taxableAmount || 0);
      const itemCgst = new Prisma.Decimal(item.cgstAmount || 0);
      const itemSgst = new Prisma.Decimal(item.sgstAmount || 0);
      const itemIgst = new Prisma.Decimal(item.igstAmount || 0);
      const itemTotal = new Prisma.Decimal(item.amount || 0);

      subtotal = subtotal.add(itemTaxable);
      cgst = cgst.add(itemCgst);
      sgst = sgst.add(itemSgst);
      igst = igst.add(itemIgst);
      total = total.add(itemTotal);

      return {
        businessId,
        description: item.description,
        hsnCode: item.hsnCode,
        qty: new Prisma.Decimal(item.qty),
        rate: new Prisma.Decimal(item.rate),
        discount: new Prisma.Decimal(item.discount || 0),
        taxableAmount: itemTaxable,
        gstRate: new Prisma.Decimal(item.gstRate || 0),
        cgstAmount: itemCgst,
        sgstAmount: itemSgst,
        igstAmount: itemIgst,
        amount: itemTotal,
      };
    });

    const status = data.status || "draft";

    const invoice = await tx.invoice.create({
      data: {
        businessId,
        type: data.type,
        customerOrSupplierId: data.customerOrSupplierId,
        invoiceNo: finalInvoiceNo,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate || null,
        status,
        subtotal,
        cgst,
        sgst,
        igst,
        total,
        financialYear: fy,
        category: data.category || null,
        notes: data.notes || null,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
      },
    });

    // If invoice is final, post automatically to double-entry ledger
    if (status === "final") {
      const entryType = data.type === "sales" ? "debit" : "credit";
      await tx.ledgerEntry.create({
        data: {
          businessId,
          partyId: data.customerOrSupplierId,
          entryType,
          amount: total,
          refInvoiceId: invoice.id,
          description: `${data.type === "sales" ? "Sales Invoice" : "Purchase Bill"} ${invoice.invoiceNo}`,
          entryDate: data.invoiceDate,
        },
      });
    }

    // Audit Log entry
    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "INSERT",
        tableName: "invoices",
        recordId: invoice.id,
        diff: JSON.stringify({
          invoiceNo: invoice.invoiceNo,
          type: invoice.type,
          total: invoice.total.toString(),
          status: invoice.status,
        }),
      },
    });

    return invoice;
  }, { maxWait: 30000, timeout: 30000 });
}

export async function updateInvoiceStatus(
  session: AuthSession,
  businessId: string,
  invoiceId: string,
  newStatus: "draft" | "final" | "cancelled"
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId },
    });

    if (!existing) {
      throw new Error("Invoice not found in this business");
    }

    if (existing.status === newStatus) {
      return existing;
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus },
    });

    // If changing to final, create ledger entry
    if (existing.status !== "final" && newStatus === "final") {
      const entryType = existing.type === "sales" ? "debit" : "credit";
      await tx.ledgerEntry.create({
        data: {
          businessId,
          partyId: existing.customerOrSupplierId,
          entryType,
          amount: existing.total,
          refInvoiceId: existing.id,
          description: `Invoice ${existing.invoiceNo} finalized`,
          entryDate: existing.invoiceDate,
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "STATUS_CHANGE",
        tableName: "invoices",
        recordId: invoiceId,
        diff: JSON.stringify({
          before: existing.status,
          after: newStatus,
        }),
      },
    });

    return updated;
  });
}
