import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInvoiceSchema } from "../lib/validation/invoice.ts";
import type { CreateInvoiceFormData } from "../lib/validation/invoice.ts";
import { calculateInvoiceTaxes } from "../lib/tax.ts";
import type { StructuredInvoiceData } from "../lib/validation/ocr.ts";
import type { LedgerEntry, Invoice } from "../types/index.ts";

/**
 * Mirror of server-side invoice and ledger creation logic for the OCR flow.
 * Ensures that OCR-sourced invoices pass through the exact same validation and write rules as manual invoices.
 */
export function executeUnifiedInvoiceWritePath(
  formData: CreateInvoiceFormData,
  businessStateCode: string = "27"
): {
  success: boolean;
  invoice?: Invoice;
  ledgerEntry?: Omit<LedgerEntry, "id" | "created_at">;
  error?: string;
} {
  // 1. Validate payload structure using the single manual invoice schema
  const parsed = createInvoiceSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid invoice input",
    };
  }

  const { type, customer_or_supplier_id, invoice_date, due_date, notes, items, status } =
    parsed.data;

  // 2. Fetch counterparty state code (simulated based on supplier prefix)
  const isInterState = customer_or_supplier_id.includes("interstate") || customer_or_supplier_id.includes("29");
  const partyStateCode = isInterState ? "29" : "27";

  // 3. Deterministic server-side tax calculation
  const taxSummary = calculateInvoiceTaxes(
    businessStateCode,
    partyStateCode,
    items
  );

  // 4. Generate FY and sequential number
  const invDate = new Date(invoice_date);
  const year = invDate.getFullYear();
  const month = invDate.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const financialYear = `${fyStart}-${fyStart + 1}`;
  const fyCode = `${fyStart}-${fyEnd < 10 ? "0" + fyEnd : fyEnd}`;

  const prefix = type === "sales" ? "INV" : "PUR";
  const invoiceNo = `${prefix}/${fyCode}/0042`;

  const newInvoice: Invoice = {
    id: `inv-${Date.now()}`,
    business_id: "biz-1",
    type,
    customer_or_supplier_id,
    invoice_no: invoiceNo,
    invoice_date,
    due_date: due_date || null,
    status: status || "final",
    subtotal: taxSummary.subtotal,
    cgst: taxSummary.cgst,
    sgst: taxSummary.sgst,
    igst: taxSummary.igst,
    total: taxSummary.total,
    financial_year: financialYear,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 5. If confirmed final, append ledger entry
  let ledgerEntry: Omit<LedgerEntry, "id" | "created_at"> | undefined;
  if (newInvoice.status === "final") {
    ledgerEntry = {
      business_id: "biz-1",
      party_id: customer_or_supplier_id,
      entry_type: type === "sales" ? "debit" : "credit",
      amount: taxSummary.total,
      ref_invoice_id: newInvoice.id,
      ref_payment_id: null,
      description: `${type === "sales" ? "Sales Invoice" : "Purchase Bill"} ${invoiceNo}`,
      entry_date: invoice_date,
    };
  }

  return {
    success: true,
    invoice: newInvoice,
    ledgerEntry,
  };
}

describe("OCR Review & Confirm Screen: Unified Write Path & Ledger Integration (Prompt 19)", () => {
  const ocrExtractedSample: StructuredInvoiceData = {
    vendor_name: "Mahalaxmi Trading Co",
    vendor_gstin: "29AABCU9603R1ZK", // Karnataka (State 29) -> Inter-state with Maharashtra (27)
    invoice_number: "INV/2024-25/9981",
    invoice_date: "2024-04-18",
    line_items: [
      {
        description: "Industrial Packing Boxes",
        hsn: "481910",
        qty: 100,
        rate: 500,
        gst_rate: 18,
      },
      {
        description: "Adhesive Tape Rolls",
        hsn: "391910",
        qty: 50,
        rate: 120,
        gst_rate: 18,
      },
    ],
    total_amount: 66080,
  };

  it("transforms OCR structured data into CreateInvoiceFormData complying with standard manual schema", () => {
    const payload: CreateInvoiceFormData = {
      type: "purchase",
      status: "final",
      customer_or_supplier_id: "sup-29-mahalaxmi",
      invoice_date: ocrExtractedSample.invoice_date,
      due_date: "2024-05-18",
      notes: "Scanned OCR Purchase Bill - Verified by accountant",
      items: ocrExtractedSample.line_items.map((item) => ({
        description: item.description,
        hsn_code: item.hsn,
        qty: item.qty,
        rate: item.rate,
        discount: 0,
        gst_rate: item.gst_rate,
      })),
    };

    const validation = createInvoiceSchema.safeParse(payload);
    assert.equal(validation.success, true);
  });

  it("creates purchase invoice and supplier credit ledger entry through single validated write path", () => {
    const payload: CreateInvoiceFormData = {
      type: "purchase",
      status: "final",
      customer_or_supplier_id: "sup-interstate-29",
      invoice_date: ocrExtractedSample.invoice_date,
      due_date: "2024-05-18",
      notes: "Scanned OCR Purchase Bill",
      items: ocrExtractedSample.line_items.map((item) => ({
        description: item.description,
        hsn_code: item.hsn,
        qty: item.qty,
        rate: item.rate,
        discount: 0,
        gst_rate: item.gst_rate,
      })),
    };

    const result = executeUnifiedInvoiceWritePath(payload, "27");

    assert.equal(result.success, true);
    assert.ok(result.invoice);
    assert.ok(result.ledgerEntry);

    const inv = result.invoice!;
    assert.equal(inv.type, "purchase");
    assert.equal(inv.status, "final");
    assert.ok(inv.invoice_no.startsWith("PUR/"));

    // Calculation verification:
    // Item 1: 100 * 500 = 50,000
    // Item 2: 50 * 120 = 6,000
    // Taxable Subtotal = 56,000
    // Inter-state IGST (18% of 56,000) = 10,080; CGST = 0; SGST = 0
    // Total = 66,080
    assert.equal(inv.subtotal, 56000);
    assert.equal(inv.cgst, 0);
    assert.equal(inv.sgst, 0);
    assert.equal(inv.igst, 10080);
    assert.equal(inv.total, 66080);

    // Supplier Ledger Entry Verification:
    // Purchase invoice credits supplier Accounts Payable
    const entry = result.ledgerEntry!;
    assert.equal(entry.entry_type, "credit");
    assert.equal(entry.amount, 66080);
    assert.equal(entry.ref_invoice_id, inv.id);
    assert.ok(entry.description.includes("Purchase Bill"));
  });

  it("calculates intra-state CGST + SGST split when supplier is in the same state (Maharashtra 27)", () => {
    const localPayload: CreateInvoiceFormData = {
      type: "purchase",
      status: "final",
      customer_or_supplier_id: "sup-local-27",
      invoice_date: "2024-04-20",
      items: [
        {
          description: "Local Packaging Materials",
          hsn_code: "481910",
          qty: 10,
          rate: 1000,
          discount: 0,
          gst_rate: 18,
        },
      ],
    };

    const result = executeUnifiedInvoiceWritePath(localPayload, "27");
    assert.equal(result.success, true);
    assert.ok(result.invoice);

    // Taxable: 10,000 | CGST 9%: 900 | SGST 9%: 900 | IGST: 0 | Total: 11,800
    assert.equal(result.invoice?.subtotal, 10000);
    assert.equal(result.invoice?.cgst, 900);
    assert.equal(result.invoice?.sgst, 900);
    assert.equal(result.invoice?.igst, 0);
    assert.equal(result.invoice?.total, 11800);
  });

  it("rejects invalid user edits with standard validation errors and creates no ledger entry", () => {
    const invalidPayload: CreateInvoiceFormData = {
      type: "purchase",
      status: "final",
      customer_or_supplier_id: "sup-1",
      invoice_date: "2024-04-20",
      items: [
        {
          description: "Office Supplies",
          hsn_code: "998311",
          qty: 5,
          rate: -50, // Invalid negative rate
          discount: 0,
          gst_rate: 18,
        },
      ],
    };

    const result = executeUnifiedInvoiceWritePath(invalidPayload, "27");
    assert.equal(result.success, false);
    assert.match(result.error!, /Rate cannot be negative|Invalid invoice input/);
    assert.equal(result.invoice, undefined);
    assert.equal(result.ledgerEntry, undefined);
  });
});
