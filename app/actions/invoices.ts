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

// In-memory demo store for invoices
let demoInvoices: (Invoice & { party_name: string; items: InvoiceItem[] })[] = [
  {
    id: "inv-1",
    business_id: "biz-1",
    type: "sales",
    customer_or_supplier_id: "cust-1",
    party_name: "Bharat Enterprises",
    invoice_no: "INV/2024-25/0001",
    invoice_date: "2024-04-15",
    due_date: "2024-05-15",
    status: "final",
    subtotal: 122881.36,
    cgst: 11059.32,
    sgst: 11059.32,
    igst: 0,
    total: 145000,
    financial_year: "2024-2025",
    notes: "Supply of consulting services",
    created_at: "2024-04-15T10:00:00Z",
    updated_at: "2024-04-15T10:00:00Z",
    items: [
      {
        id: "item-1",
        business_id: "biz-1",
        invoice_id: "inv-1",
        description: "IT Software Advisory",
        hsn_code: "998311",
        qty: 1,
        rate: 122881.36,
        discount: 0,
        taxable_amount: 122881.36,
        gst_rate: 18,
        cgst_amount: 11059.32,
        sgst_amount: 11059.32,
        igst_amount: 0,
        amount: 145000,
        created_at: "2024-04-15T10:00:00Z",
      },
    ],
  },
  {
    id: "inv-2",
    business_id: "biz-1",
    type: "sales",
    customer_or_supplier_id: "cust-2",
    party_name: "Mahalaxmi Trading Co",
    invoice_no: "INV/2024-25/0002",
    invoice_date: "2024-04-16",
    due_date: "2024-05-16",
    status: "draft",
    subtotal: 75000,
    cgst: 0,
    sgst: 0,
    igst: 13500,
    total: 88500,
    financial_year: "2024-2025",
    notes: "Inter-state supply to Karnataka",
    created_at: "2024-04-16T11:00:00Z",
    updated_at: "2024-04-16T11:00:00Z",
    items: [
      {
        id: "item-2",
        business_id: "biz-1",
        invoice_id: "inv-2",
        description: "Consumer Electronics Components",
        hsn_code: "847130",
        qty: 5,
        rate: 15000,
        discount: 0,
        taxable_amount: 75000,
        gst_rate: 18,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 13500,
        amount: 88500,
        created_at: "2024-04-16T11:00:00Z",
      },
    ],
  },
  {
    id: "inv-3",
    business_id: "biz-1",
    type: "purchase",
    customer_or_supplier_id: "supp-1",
    party_name: "Tata Steel Logistics & Supply",
    invoice_no: "PUR/2024-25/0019",
    invoice_date: "2024-04-17",
    due_date: "2024-05-17",
    status: "final",
    subtotal: 200000,
    cgst: 18000,
    sgst: 18000,
    igst: 0,
    total: 236000,
    financial_year: "2024-2025",
    notes: "Raw materials logistics supply",
    created_at: "2024-04-17T12:00:00Z",
    updated_at: "2024-04-17T12:00:00Z",
    items: [
      {
        id: "item-3",
        business_id: "biz-1",
        invoice_id: "inv-3",
        description: "Industrial Logistics & Freight",
        hsn_code: "996511",
        qty: 1,
        rate: 200000,
        discount: 0,
        taxable_amount: 200000,
        gst_rate: 18,
        cgst_amount: 18000,
        sgst_amount: 18000,
        igst_amount: 0,
        amount: 236000,
        created_at: "2024-04-17T12:00:00Z",
      },
    ],
  },
];

let invoiceCounter = 3;

export async function getInvoices() {
  return demoInvoices;
}

export async function getInvoiceById(id: string) {
  return demoInvoices.find((inv) => inv.id === id) || null;
}

/**
 * Server-side creation of invoice with deterministic tax math.
 * Clients NEVER dictate the calculated totals.
 */
export async function createInvoice(
  formData: CreateInvoiceFormData
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  // 1. Validate payload structure server-side
  const parsed = createInvoiceSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid invoice input",
    };
  }

  const { type, customer_or_supplier_id, invoice_date, due_date, notes, items, category } =
    parsed.data;

  // 2. Fetch business state code (default: Maharashtra "27")
  const businessStateCode = "27";

  // 3. Fetch counterparty state code server-side
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

  // 4. Calculate deterministic GST tax math server-side (DO NOT TRUST CLIENT)
  const taxSummary = calculateInvoiceTaxes(
    businessStateCode,
    partyStateCode,
    items
  );

  // 5. Generate Invoice Number & Financial Year
  // Indian Financial Year: April 1 to March 31
  const invDate = new Date(invoice_date);
  const year = invDate.getFullYear();
  const month = invDate.getMonth() + 1; // 1-12
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const financialYear = `${fyStart}-${fyStart + 1}`;
  const fyCode = `${fyStart}-${fyEnd < 10 ? "0" + fyEnd : fyEnd}`;

  const prefix = type === "sales" ? "INV" : "PUR";
  const seqNumber = String(invoiceCounter++).padStart(4, "0");
  const invoiceNo = `${prefix}/${fyCode}/${seqNumber}`;

  const newInvoiceId = `inv-${Date.now()}`;

  const calculatedItems: InvoiceItem[] = taxSummary.items.map(
    (item, index) => ({
      id: `item-${Date.now()}-${index}`,
      business_id: "biz-1",
      invoice_id: newInvoiceId,
      description: item.description,
      hsn_code: item.hsn_code,
      qty: item.qty,
      rate: item.rate,
      discount: item.discount || 0,
      taxable_amount: item.taxable_amount,
      gst_rate: item.gst_rate,
      cgst_amount: item.cgst_amount,
      sgst_amount: item.sgst_amount,
      igst_amount: item.igst_amount,
      amount: item.amount,
      created_at: new Date().toISOString(),
    })
  );

  const newInvoice: Invoice & { party_name: string; items: InvoiceItem[] } = {
    id: newInvoiceId,
    business_id: "biz-1",
    type,
    customer_or_supplier_id,
    party_name: partyName,
    invoice_no: invoiceNo,
    invoice_date,
    due_date: due_date || null,
    status: parsed.data.status || "final",
    subtotal: taxSummary.subtotal,
    cgst: taxSummary.cgst,
    sgst: taxSummary.sgst,
    igst: taxSummary.igst,
    total: taxSummary.total,
    financial_year: financialYear,
    category: category || null,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: calculatedItems,
  };

  demoInvoices.unshift(newInvoice);

  // When created as 'final', automatically append party ledger entry
  // Sales: Debit Customer Accounts Receivable (party owes us money)
  // Purchase: Credit Supplier Accounts Payable (we owe supplier money)
  if (newInvoice.status === "final") {
    await addLedgerEntry({
      business_id: newInvoice.business_id,
      party_id: customer_or_supplier_id,
      entry_type: type === "sales" ? "debit" : "credit",
      amount: taxSummary.total,
      ref_invoice_id: newInvoice.id,
      ref_payment_id: null,
      description: `${type === "sales" ? "Sales Invoice" : "Purchase Bill"} ${invoiceNo}`,
      entry_date: invoice_date,
    });
  }

  return { success: true, data: newInvoice };
}

/**
 * Server action to transition invoice status: draft -> final -> cancelled.
 * Database/server rules:
 * - draft can transition to final or cancelled
 * - final can transition to cancelled
 * - final CANNOT revert to draft
 * - cancelled is terminal
 * - financial amounts on finalized invoices cannot be modified
 */
export async function transitionInvoiceStatus(
  invoiceId: string,
  targetStatus: Invoice["status"]
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  const invoice = demoInvoices.find((inv) => inv.id === invoiceId);
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

  // Update status safely
  invoice.status = targetStatus;
  invoice.updated_at = new Date().toISOString();

  // If transitioning from draft to final, append party ledger entry
  if (previousStatus === "draft" && targetStatus === "final") {
    await addLedgerEntry({
      business_id: invoice.business_id,
      party_id: invoice.customer_or_supplier_id,
      entry_type: invoice.type === "sales" ? "debit" : "credit",
      amount: invoice.total,
      ref_invoice_id: invoice.id,
      ref_payment_id: null,
      description: `${invoice.type === "sales" ? "Sales Invoice" : "Purchase Bill"} ${invoice.invoice_no}`,
      entry_date: invoice.invoice_date,
    });
  }

  return { success: true, data: invoice };
}

/**
 * Automatically matches or registers a supplier from OCR invoice data.
 * Used to ensure foreign key integrity without bypassing validation.
 */
export async function findOrCreateSupplierForOCR(params: {
  name: string;
  gstin?: string | null;
  stateCode?: string;
  address?: string;
}): Promise<Supplier> {
  const suppliers = await getSuppliers();
  const cleanGstin = params.gstin?.trim().toUpperCase();

  // 1. Match by GSTIN first if present
  if (cleanGstin) {
    const matchByGstin = suppliers.find((s) => s.gstin === cleanGstin);
    if (matchByGstin) return matchByGstin;
  }

  // 2. Match by exact or normalized Name
  const cleanName = params.name.trim().toLowerCase();
  const matchByName = suppliers.find(
    (s) => s.name.trim().toLowerCase() === cleanName
  );
  if (matchByName) return matchByName;

  // 3. Derive state code from GSTIN or default
  const stateCode =
    cleanGstin && cleanGstin.length >= 2
      ? cleanGstin.substring(0, 2)
      : params.stateCode || "27";

  // 4. Register new supplier via validated path
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

/**
 * Creates a Credit Note or Debit Note referencing a finalized invoice.
 * Generates CN/ or DN/ prefix numbering.
 */
export async function createCreditDebitNote(
  input: import("@/lib/validation/invoice").CreateCreditDebitNoteFormData
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  const original = demoInvoices.find((inv) => inv.id === input.original_invoice_id);
  if (!original) {
    return { success: false, error: "Original invoice not found" };
  }

  if (original.status !== "final") {
    return {
      success: false,
      error: `Credit/Debit notes can only be issued against finalized invoices. Invoice ${original.invoice_no} is currently in "${original.status}" state.`,
    };
  }

  // Fetch state code for original party
  const businessStateCode = "27"; // Maharashtra
  let partyStateCode = "27";

  if (original.type === "sales") {
    const customer = await getCustomerById(original.customer_or_supplier_id);
    if (customer) partyStateCode = customer.state_code;
  } else {
    const supplier = await getSupplierById(original.customer_or_supplier_id);
    if (supplier) partyStateCode = supplier.state_code;
  }

  // Deterministic tax calculation
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

  const prefix = input.type === "credit_note" ? "CN" : "DN";
  const seqNumber = String(invoiceCounter++).padStart(4, "0");
  const noteNumber = `${prefix}/${fyCode}/${seqNumber}`;

  const newNoteId = `${input.type}-${Date.now()}`;

  const calculatedItems: InvoiceItem[] = taxSummary.items.map((item, index) => ({
    id: `item-${Date.now()}-${index}`,
    business_id: original.business_id,
    invoice_id: newNoteId,
    description: item.description,
    hsn_code: item.hsn_code,
    qty: item.qty,
    rate: item.rate,
    discount: item.discount || 0,
    taxable_amount: item.taxable_amount,
    gst_rate: item.gst_rate,
    cgst_amount: item.cgst_amount,
    sgst_amount: item.sgst_amount,
    igst_amount: item.igst_amount,
    amount: item.amount,
    created_at: new Date().toISOString(),
  }));

  const newNote: Invoice & { party_name: string; items: InvoiceItem[] } = {
    id: newNoteId,
    business_id: original.business_id,
    type: input.type,
    customer_or_supplier_id: original.customer_or_supplier_id,
    original_invoice_id: original.id,
    party_name: original.party_name,
    invoice_no: noteNumber,
    invoice_date: input.note_date,
    status: "final",
    subtotal: taxSummary.subtotal,
    cgst: taxSummary.cgst,
    sgst: taxSummary.sgst,
    igst: taxSummary.igst,
    total: taxSummary.total,
    financial_year: financialYear,
    notes: input.reason,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: calculatedItems,
  };

  demoInvoices.unshift(newNote);

  return { success: true, data: newNote };
}

/**
 * Server action to suggest an AI classification category for a purchase invoice.
 * Classifies based on vendor name and line item descriptions.
 * The resulting category is a suggestion and is never auto-applied.
 */
export async function suggestInvoiceCategory(
  vendorName: string,
  items: Array<{ description: string }>
) {
  return classifyPurchaseInvoice({
    vendor_name: vendorName,
    line_items: items,
  });
}

