"use server";

import { createInvoiceSchema, CreateInvoiceFormData } from "@/lib/validation/invoice";
import { calculateInvoiceTaxes } from "@/lib/tax";
import {
  getCustomerById,
  getSupplierById,
  addLedgerEntry,
  getSuppliers,
  saveSupplier,
} from "./parties";
import { Invoice, InvoiceItem, Supplier } from "@/types";
import { classifyPurchaseInvoice } from "@/lib/ai/classifyInvoice";
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

async function enrichPartyName(
  inv: { customerOrSupplierId: string; type: string }
): Promise<string> {
  if (inv.type === "sales" || inv.type === "credit_note") {
    const c = await prisma.customer.findUnique({
      where: { id: inv.customerOrSupplierId },
      select: { name: true },
    });
    if (c) return c.name;
  } else {
    const s = await prisma.supplier.findUnique({
      where: { id: inv.customerOrSupplierId },
      select: { name: true },
    });
    if (s) return s.name;
  }
  return "Unknown Counterparty";
}

export async function getInvoices(
  businessId?: string
): Promise<(Invoice & { party_name: string; items: InvoiceItem[] })[]> {
  const bizId = await getActiveBusinessId(businessId);
  const dbInvoices = await prisma.invoice.findMany({
    where: { businessId: bizId },
    include: {
      items: true,
      paymentAllocations: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    dbInvoices.map(async (inv) => {
      const party_name = await enrichPartyName(inv);
      return {
        id: inv.id,
        business_id: inv.businessId,
        type: inv.type as Invoice["type"],
        customer_or_supplier_id: inv.customerOrSupplierId,
        party_name,
        invoice_no: inv.invoiceNo,
        invoice_date: inv.invoiceDate,
        due_date: inv.dueDate,
        status: inv.status as Invoice["status"],
        subtotal: Number(inv.subtotal),
        cgst: Number(inv.cgst),
        sgst: Number(inv.sgst),
        igst: Number(inv.igst),
        total: Number(inv.total),
        financial_year: inv.financialYear,
        category: inv.category,
        notes: inv.notes,
        created_at: inv.createdAt.toISOString(),
        updated_at: inv.updatedAt.toISOString(),
        items: inv.items.map((it) => ({
          id: it.id,
          business_id: it.businessId,
          invoice_id: it.invoiceId,
          description: it.description,
          hsn_code: it.hsnCode,
          qty: Number(it.qty),
          rate: Number(it.rate),
          discount: Number(it.discount),
          taxable_amount: Number(it.taxableAmount),
          gst_rate: Number(it.gstRate),
          cgst_amount: Number(it.cgstAmount),
          sgst_amount: Number(it.sgstAmount),
          igst_amount: Number(it.igstAmount),
          amount: Number(it.amount),
          created_at: it.createdAt.toISOString(),
        })),
      };
    })
  );
}

export async function getInvoiceById(
  id: string
): Promise<(Invoice & { party_name: string; items: InvoiceItem[] }) | null> {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!inv) return null;

  const party_name = await enrichPartyName(inv);

  return {
    id: inv.id,
    business_id: inv.businessId,
    type: inv.type as Invoice["type"],
    customer_or_supplier_id: inv.customerOrSupplierId,
    party_name,
    invoice_no: inv.invoiceNo,
    invoice_date: inv.invoiceDate,
    due_date: inv.dueDate,
    status: inv.status as Invoice["status"],
    subtotal: Number(inv.subtotal),
    cgst: Number(inv.cgst),
    sgst: Number(inv.sgst),
    igst: Number(inv.igst),
    total: Number(inv.total),
    financial_year: inv.financialYear,
    category: inv.category,
    notes: inv.notes,
    created_at: inv.createdAt.toISOString(),
    updated_at: inv.updatedAt.toISOString(),
    items: inv.items.map((it) => ({
      id: it.id,
      business_id: it.businessId,
      invoice_id: it.invoiceId,
      description: it.description,
      hsn_code: it.hsnCode,
      qty: Number(it.qty),
      rate: Number(it.rate),
      discount: Number(it.discount),
      taxable_amount: Number(it.taxableAmount),
      gst_rate: Number(it.gstRate),
      cgst_amount: Number(it.cgstAmount),
      sgst_amount: Number(it.sgstAmount),
      igst_amount: Number(it.igstAmount),
      amount: Number(it.amount),
      created_at: it.createdAt.toISOString(),
    })),
  };
}

/**
 * Server-side creation of invoice with deterministic tax math directly in Prisma SQLite.
 */
export async function createInvoice(
  formData: CreateInvoiceFormData
): Promise<{ success: boolean; data?: Invoice & { party_name?: string; items: InvoiceItem[] }; error?: string }> {
  const parsed = createInvoiceSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid invoice input",
    };
  }

  const { type, customer_or_supplier_id, invoice_date, due_date, notes, items, category } =
    parsed.data;

  const bizId = await getActiveBusinessId();
  const business = await prisma.business.findUnique({
    where: { id: bizId },
  });
  const businessStateCode = business?.stateCode || "27";

  let partyName = "";
  let partyStateCode = "27";

  if (type === "sales") {
    const customer = await getCustomerById(customer_or_supplier_id);
    if (!customer) {
      return { success: false, error: "Selected customer does not exist" };
    }
    partyName = customer.name;
    partyStateCode = customer.state_code;
  } else {
    const supplier = await getSupplierById(customer_or_supplier_id);
    if (!supplier) {
      return { success: false, error: "Selected supplier does not exist" };
    }
    partyName = supplier.name;
    partyStateCode = supplier.state_code;
  }

  const taxSummary = calculateInvoiceTaxes(
    businessStateCode,
    partyStateCode,
    items
  );

  const invDate = new Date(invoice_date);
  const year = invDate.getFullYear();
  const month = invDate.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const financialYear = `${fyStart}-${fyStart + 1}`;
  const fyCode = `${fyStart}-${fyEnd < 10 ? "0" + fyEnd : fyEnd}`;

  const count = await prisma.invoice.count({ where: { businessId: bizId } });
  const prefix = type === "sales" ? "INV" : "PUR";
  const seqNumber = String(count + 1).padStart(4, "0");
  const invoiceNo = `${prefix}/${fyCode}/${seqNumber}`;

  const invoiceStatus = parsed.data.status || "final";

  const result = await prisma.$transaction(async (tx) => {
    const newInvoice = await tx.invoice.create({
      data: {
        businessId: bizId,
        type,
        customerOrSupplierId: customer_or_supplier_id,
        invoiceNo,
        invoiceDate: invoice_date,
        dueDate: due_date || null,
        status: invoiceStatus,
        subtotal: taxSummary.subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        total: taxSummary.total,
        financialYear,
        category: category || null,
        notes: notes || null,
        items: {
          create: taxSummary.items.map((it) => ({
            businessId: bizId,
            description: it.description,
            hsnCode: it.hsn_code,
            qty: it.qty,
            rate: it.rate,
            discount: it.discount || 0,
            taxableAmount: it.taxable_amount,
            gstRate: it.gst_rate,
            cgstAmount: it.cgst_amount,
            sgstAmount: it.sgst_amount,
            igstAmount: it.igst_amount,
            amount: it.amount,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    if (invoiceStatus === "final") {
      await tx.ledgerEntry.create({
        data: {
          businessId: bizId,
          partyId: customer_or_supplier_id,
          entryType: type === "sales" ? "debit" : "credit",
          amount: taxSummary.total,
          refInvoiceId: newInvoice.id,
          description: `${type === "sales" ? "Sales Invoice" : "Purchase Bill"} ${invoiceNo}`,
          entryDate: invoice_date,
        },
      });
    }

    return newInvoice;
  });

  return {
    success: true,
    data: {
      id: result.id,
      business_id: result.businessId,
      type: result.type as Invoice["type"],
      customer_or_supplier_id: result.customerOrSupplierId,
      party_name: partyName,
      invoice_no: result.invoiceNo,
      invoice_date: result.invoiceDate,
      due_date: result.dueDate,
      status: result.status as Invoice["status"],
      subtotal: Number(result.subtotal),
      cgst: Number(result.cgst),
      sgst: Number(result.sgst),
      igst: Number(result.igst),
      total: Number(result.total),
      financial_year: result.financialYear,
      category: result.category,
      notes: result.notes,
      created_at: result.createdAt.toISOString(),
      updated_at: result.updatedAt.toISOString(),
      items: result.items.map((it) => ({
        id: it.id,
        business_id: it.businessId,
        invoice_id: it.invoiceId,
        description: it.description,
        hsn_code: it.hsnCode,
        qty: Number(it.qty),
        rate: Number(it.rate),
        discount: Number(it.discount),
        taxable_amount: Number(it.taxableAmount),
        gst_rate: Number(it.gstRate),
        cgst_amount: Number(it.cgstAmount),
        sgst_amount: Number(it.sgstAmount),
        igst_amount: Number(it.igstAmount),
        amount: Number(it.amount),
        created_at: it.createdAt.toISOString(),
      })),
    },
  };
}

export async function transitionInvoiceStatus(
  invoiceId: string,
  targetStatus: Invoice["status"]
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) {
    return { success: false, error: "Invoice not found" };
  }

  if (invoice.status === "cancelled") {
    return {
      success: false,
      error: "Cancelled invoices are in a terminal state and cannot be modified.",
    };
  }

  if (invoice.status === "final") {
    if (targetStatus === "draft") {
      return {
        success: false,
        error:
          "Cannot revert finalized invoice back to draft. Corrections must be made via credit_note or debit_note.",
      };
    }
    if (targetStatus !== "cancelled") {
      return {
        success: false,
        error: `Cannot transition status from final to ${targetStatus}`,
      };
    }
  }

  if (invoice.status === "draft") {
    if (!["draft", "final", "cancelled"].includes(targetStatus)) {
      return {
        success: false,
        error: `Invalid status transition from draft to ${targetStatus}`,
      };
    }
  }

  const previousStatus = invoice.status;

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: targetStatus },
    });

    if (previousStatus === "draft" && targetStatus === "final") {
      await tx.ledgerEntry.create({
        data: {
          businessId: invoice.businessId,
          partyId: invoice.customerOrSupplierId,
          entryType: invoice.type === "sales" ? "debit" : "credit",
          amount: invoice.total,
          refInvoiceId: invoice.id,
          description: `${invoice.type === "sales" ? "Sales Invoice" : "Purchase Bill"} ${invoice.invoiceNo}`,
          entryDate: invoice.invoiceDate,
        },
      });
    }

    return res;
  });

  return {
    success: true,
    data: {
      id: updated.id,
      business_id: updated.businessId,
      type: updated.type as Invoice["type"],
      customer_or_supplier_id: updated.customerOrSupplierId,
      invoice_no: updated.invoiceNo,
      invoice_date: updated.invoiceDate,
      due_date: updated.dueDate,
      status: updated.status as Invoice["status"],
      subtotal: Number(updated.subtotal),
      cgst: Number(updated.cgst),
      sgst: Number(updated.sgst),
      igst: Number(updated.igst),
      total: Number(updated.total),
      financial_year: updated.financialYear,
      category: updated.category,
      notes: updated.notes,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    },
  };
}

export async function findOrCreateSupplierForOCR(params: {
  name: string;
  gstin?: string | null;
  stateCode?: string;
  address?: string;
}): Promise<Supplier> {
  const suppliers = await getSuppliers();
  const cleanGstin = params.gstin?.trim().toUpperCase();

  if (cleanGstin) {
    const matchByGstin = suppliers.find((s) => s.gstin === cleanGstin);
    if (matchByGstin) return matchByGstin;
  }

  const cleanName = params.name.trim().toLowerCase();
  const matchByName = suppliers.find(
    (s) => s.name.trim().toLowerCase() === cleanName
  );
  if (matchByName) return matchByName;

  const stateCode =
    cleanGstin && cleanGstin.length >= 2
      ? cleanGstin.substring(0, 2)
      : params.stateCode || "27";

  const saveRes = await saveSupplier({
    name: params.name.trim(),
    gstin: cleanGstin || "",
    state_code: stateCode,
    email: "",
    phone: "",
    billing_address: params.address || "Address as per scanned invoice",
  });

  if (!saveRes.success || !saveRes.data) {
    throw new Error(
      saveRes.error || "Failed to register supplier from OCR invoice."
    );
  }

  return saveRes.data;
}

export async function createCreditDebitNote(
  input: import("@/lib/validation/invoice").CreateCreditDebitNoteFormData
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  const original = await prisma.invoice.findUnique({
    where: { id: input.original_invoice_id },
  });
  if (!original) {
    return { success: false, error: "Original invoice not found" };
  }

  if (original.status !== "final") {
    return {
      success: false,
      error: `Credit/Debit notes can only be issued against finalized invoices. Invoice ${original.invoiceNo} is currently in "${original.status}" state.`,
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: original.businessId },
  });
  const businessStateCode = business?.stateCode || "27";
  let partyStateCode = "27";

  if (original.type === "sales") {
    const customer = await getCustomerById(original.customerOrSupplierId);
    if (customer) partyStateCode = customer.state_code;
  } else {
    const supplier = await getSupplierById(original.customerOrSupplierId);
    if (supplier) partyStateCode = supplier.state_code;
  }

  const taxSummary = calculateInvoiceTaxes(
    businessStateCode,
    partyStateCode,
    input.items
  );

  const noteDate = new Date(input.note_date);
  const year = noteDate.getFullYear();
  const month = noteDate.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const financialYear = `${fyStart}-${fyStart + 1}`;
  const fyCode = `${fyStart}-${fyEnd < 10 ? "0" + fyEnd : fyEnd}`;

  const count = await prisma.invoice.count({ where: { businessId: original.businessId } });
  const prefix = input.type === "credit_note" ? "CN" : "DN";
  const seqNumber = String(count + 1).padStart(4, "0");
  const noteNumber = `${prefix}/${fyCode}/${seqNumber}`;

  const created = await prisma.$transaction(async (tx) => {
    const note = await tx.invoice.create({
      data: {
        businessId: original.businessId,
        type: input.type,
        customerOrSupplierId: original.customerOrSupplierId,
        invoiceNo: noteNumber,
        invoiceDate: input.note_date,
        status: "final",
        subtotal: taxSummary.subtotal,
        cgst: taxSummary.cgst,
        sgst: taxSummary.sgst,
        igst: taxSummary.igst,
        total: taxSummary.total,
        financialYear,
        notes: input.reason,
        items: {
          create: taxSummary.items.map((it) => ({
            businessId: original.businessId,
            description: it.description,
            hsnCode: it.hsn_code,
            qty: it.qty,
            rate: it.rate,
            discount: it.discount || 0,
            taxableAmount: it.taxable_amount,
            gstRate: it.gst_rate,
            cgstAmount: it.cgst_amount,
            sgstAmount: it.sgst_amount,
            igstAmount: it.igst_amount,
            amount: it.amount,
          })),
        },
      },
    });

    return note;
  });

  return {
    success: true,
    data: {
      id: created.id,
      business_id: created.businessId,
      type: created.type as Invoice["type"],
      customer_or_supplier_id: created.customerOrSupplierId,
      invoice_no: created.invoiceNo,
      invoice_date: created.invoiceDate,
      due_date: created.dueDate,
      status: created.status as Invoice["status"],
      subtotal: Number(created.subtotal),
      cgst: Number(created.cgst),
      sgst: Number(created.sgst),
      igst: Number(created.igst),
      total: Number(created.total),
      financial_year: created.financialYear,
      category: created.category,
      notes: created.notes,
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
    },
  };
}

export async function suggestInvoiceCategory(
  vendorName: string,
  items: Array<{ description: string }>
) {
  return classifyPurchaseInvoice({
    vendor_name: vendorName,
    line_items: items,
  });
}
