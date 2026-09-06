"use server";

import { createInvoiceSchema, CreateInvoiceFormData, CreateCreditDebitNoteFormData } from "@/lib/validation/invoice";
import { calculateInvoiceTaxes } from "@/lib/tax";
import { getCustomerById, getSupplierById, getSuppliers, saveSupplier } from "./parties";
import { Invoice, InvoiceItem, Supplier } from "@/types";
import { classifyPurchaseInvoice } from "@/lib/ai/classifyInvoice";
import { getAuthenticatedSessionAndBusiness } from "@/lib/auth/authorize";
import {
  getInvoices as dataGetInvoices,
  getInvoiceById as dataGetInvoiceById,
  createInvoice as dataCreateInvoice,
  updateInvoiceStatus as dataUpdateInvoiceStatus,
} from "@/lib/data/invoices";
import { prisma } from "@/lib/prisma";

async function enrichPartyName(
  inv: { customerOrSupplierId: string; type: string; businessId: string }
): Promise<string> {
  if (inv.type === "sales" || inv.type === "credit_note") {
    const c = await prisma.customer.findFirst({
      where: { id: inv.customerOrSupplierId, businessId: inv.businessId },
      select: { name: true },
    });
    if (c) return c.name;
  } else {
    const s = await prisma.supplier.findFirst({
      where: { id: inv.customerOrSupplierId, businessId: inv.businessId },
      select: { name: true },
    });
    if (s) return s.name;
  }
  return "Unknown Counterparty";
}

export async function getInvoices(
  businessId?: string
): Promise<(Invoice & { party_name: string; items: InvoiceItem[] })[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const dbInvoices = await dataGetInvoices(session, bizId);

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
  id: string,
  businessId?: string
): Promise<(Invoice & { party_name: string; items: InvoiceItem[] }) | null> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const inv = await dataGetInvoiceById(session, bizId, id);
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
 * Server-side creation of invoice with deterministic tax math directly in lib/data/invoices.ts.
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

  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness();

    const business = await prisma.business.findUnique({
      where: { id: bizId },
      select: { stateCode: true },
    });
    const businessStateCode = business?.stateCode || "27";

    let partyName = "";
    let partyStateCode = "27";

    if (type === "sales") {
      const customer = await getCustomerById(customer_or_supplier_id, bizId);
      if (!customer) {
        return { success: false, error: "Selected customer does not exist" };
      }
      partyName = customer.name;
      partyStateCode = customer.state_code;
    } else {
      const supplier = await getSupplierById(customer_or_supplier_id, bizId);
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

    const invoiceStatus = parsed.data.status || "final";

    const created = await dataCreateInvoice(session, bizId, {
      type,
      customerOrSupplierId: customer_or_supplier_id,
      invoiceDate: invoice_date,
      dueDate: due_date || null,
      status: invoiceStatus,
      category: category || null,
      notes: notes || null,
      items: taxSummary.items.map((it) => ({
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
    });

    return {
      success: true,
      data: {
        id: created.id,
        business_id: created.businessId,
        type: created.type as Invoice["type"],
        customer_or_supplier_id: created.customerOrSupplierId,
        party_name: partyName,
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
        items: created.items.map((it) => ({
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
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create invoice.",
    };
  }
}

export async function transitionInvoiceStatus(
  invoiceId: string,
  targetStatus: Invoice["status"]
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness();

    const existing = await dataGetInvoiceById(session, bizId, invoiceId);
    if (!existing) {
      return { success: false, error: "Invoice not found" };
    }

    if (existing.status === "cancelled") {
      return {
        success: false,
        error: "Cancelled invoices are in a terminal state and cannot be modified.",
      };
    }

    if (existing.status === "final") {
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

    const updated = await dataUpdateInvoiceStatus(
      session,
      bizId,
      invoiceId,
      targetStatus as "draft" | "final" | "cancelled"
    );

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
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update invoice status.",
    };
  }
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
  input: CreateCreditDebitNoteFormData
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness();

    const original = await dataGetInvoiceById(session, bizId, input.original_invoice_id);
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
      select: { stateCode: true },
    });
    const businessStateCode = business?.stateCode || "27";
    let partyStateCode = "27";

    if (original.type === "sales") {
      const customer = await getCustomerById(original.customerOrSupplierId, bizId);
      if (customer) partyStateCode = customer.state_code;
    } else {
      const supplier = await getSupplierById(original.customerOrSupplierId, bizId);
      if (supplier) partyStateCode = supplier.state_code;
    }

    const taxSummary = calculateInvoiceTaxes(
      businessStateCode,
      partyStateCode,
      input.items
    );

    const created = await dataCreateInvoice(session, bizId, {
      type: input.type === "credit_note" ? "sales" : "purchase",
      customerOrSupplierId: original.customerOrSupplierId,
      invoiceDate: input.note_date,
      status: "final",
      notes: input.reason,
      items: taxSummary.items.map((it) => ({
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
    });

    return {
      success: true,
      data: {
        id: created.id,
        business_id: created.businessId,
        type: input.type,
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
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create credit/debit note.",
    };
  }
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
