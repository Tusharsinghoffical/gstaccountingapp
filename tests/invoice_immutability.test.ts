import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Invoice, InvoiceStatus, InvoiceType } from "../types/index.ts";

/**
 * Mirror of Postgres enforce_invoice_status_and_immutability logic.
 */
export function validateInvoiceStatusTransition(
  currentStatus: InvoiceStatus,
  targetStatus: InvoiceStatus
): { allowed: boolean; error?: string } {
  if (currentStatus === "cancelled") {
    return {
      allowed: false,
      error: "Cancelled invoices are in a terminal state and cannot be modified",
    };
  }

  if (currentStatus === "final") {
    if (targetStatus === "draft") {
      return {
        allowed: false,
        error:
          "Cannot revert finalized invoice back to draft. Corrections must be made via credit_note or debit_note.",
      };
    }
    if (targetStatus !== "final" && targetStatus !== "cancelled") {
      return {
        allowed: false,
        error: `Invalid invoice status transition from final to "${targetStatus}"`,
      };
    }
  }

  if (currentStatus === "draft") {
    if (!["draft", "final", "cancelled"].includes(targetStatus)) {
      return {
        allowed: false,
        error: `Invalid invoice status transition from draft to "${targetStatus}"`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Enforces database-level immutability rules when an invoice is in 'final' status.
 */
export function checkInvoiceImmutability(
  original: Invoice,
  updated: Partial<Invoice> & { status: InvoiceStatus }
): void {
  if (original.status === "cancelled") {
    throw new Error("Cancelled invoice is in a terminal state and cannot be modified.");
  }

  if (original.status === "final") {
    const transition = validateInvoiceStatusTransition(original.status, updated.status);
    if (!transition.allowed) {
      throw new Error(transition.error);
    }

    // Key financial, numbering, and relationship fields that must NEVER change once final
    const immutableFields: (keyof Invoice)[] = [
      "business_id",
      "type",
      "customer_or_supplier_id",
      "invoice_no",
      "invoice_date",
      "subtotal",
      "cgst",
      "sgst",
      "igst",
      "total",
      "financial_year",
      "original_invoice_id",
    ];

    for (const field of immutableFields) {
      if (updated[field] !== undefined && updated[field] !== original[field]) {
        throw new Error(
          `Invoice ${original.invoice_no} is finalized and immutable. Field "${String(
            field
          )}" cannot be modified. Corrections must be made via a separate credit_note or debit_note.`
        );
      }
    }

    if (updated.status === "final") {
      // Even notes and due_date are locked once final
      if (updated.notes !== undefined && updated.notes !== original.notes) {
        throw new Error(
          `Invoice ${original.invoice_no} is finalized and immutable. Field "notes" cannot be modified.`
        );
      }
      if (updated.due_date !== undefined && updated.due_date !== original.due_date) {
        throw new Error(
          `Invoice ${original.invoice_no} is finalized and immutable. Field "due_date" cannot be modified.`
        );
      }
    }
  }
}

/**
 * Validates issuance of a credit_note or debit_note against an invoice.
 */
export function validateCreditDebitNoteIssuance(
  originalInvoice: Invoice,
  noteType: "credit_note" | "debit_note"
): { allowed: boolean; error?: string } {
  if (originalInvoice.status !== "final") {
    return {
      allowed: false,
      error: `Credit/debit notes can only be issued against finalized invoices. Original invoice ${originalInvoice.invoice_no} has status "${originalInvoice.status}".`,
    };
  }
  return { allowed: true };
}

describe("Invoice Status Transitions (draft -> final -> cancelled)", () => {
  it("allows valid forward transitions", () => {
    // draft -> final
    assert.deepEqual(validateInvoiceStatusTransition("draft", "final"), {
      allowed: true,
    });

    // draft -> cancelled
    assert.deepEqual(validateInvoiceStatusTransition("draft", "cancelled"), {
      allowed: true,
    });

    // final -> cancelled
    assert.deepEqual(validateInvoiceStatusTransition("final", "cancelled"), {
      allowed: true,
    });
  });

  it("blocks backward or illegal transitions", () => {
    // final -> draft (BLOCKED)
    const resFinalToDraft = validateInvoiceStatusTransition("final", "draft");
    assert.equal(resFinalToDraft.allowed, false);
    assert.match(resFinalToDraft.error!, /Cannot revert finalized invoice/);

    // cancelled -> draft (BLOCKED)
    const resCancelledToDraft = validateInvoiceStatusTransition("cancelled", "draft");
    assert.equal(resCancelledToDraft.allowed, false);
    assert.match(resCancelledToDraft.error!, /terminal state/);

    // cancelled -> final (BLOCKED)
    const resCancelledToFinal = validateInvoiceStatusTransition("cancelled", "final");
    assert.equal(resCancelledToFinal.allowed, false);
    assert.match(resCancelledToFinal.error!, /terminal state/);
  });
});

describe("Invoice Immutability Enforcement", () => {
  const baseFinalInvoice: Invoice = {
    id: "inv-100",
    business_id: "biz-1",
    type: "sales",
    customer_or_supplier_id: "cust-1",
    invoice_no: "INV/2025-26/0001",
    invoice_date: "2025-05-10",
    status: "final",
    subtotal: 10000,
    cgst: 900,
    sgst: 900,
    igst: 0,
    total: 11800,
    financial_year: "2025-26",
    notes: "Original delivery notes",
    created_at: "2025-05-10T10:00:00Z",
    updated_at: "2025-05-10T10:00:00Z",
  };

  it("throws when attempting to modify financial amounts on a finalized invoice", () => {
    assert.throws(
      () => {
        checkInvoiceImmutability(baseFinalInvoice, {
          status: "final",
          total: 12000,
        });
      },
      {
        message: /Invoice INV\/2025-26\/0001 is finalized and immutable/,
      }
    );

    assert.throws(
      () => {
        checkInvoiceImmutability(baseFinalInvoice, {
          status: "final",
          subtotal: 8000,
        });
      },
      {
        message: /Field "subtotal" cannot be modified/,
      }
    );
  });

  it("throws when attempting to modify counterparty or dates on a finalized invoice", () => {
    assert.throws(
      () => {
        checkInvoiceImmutability(baseFinalInvoice, {
          status: "final",
          customer_or_supplier_id: "cust-tampered",
        });
      },
      {
        message: /Field "customer_or_supplier_id" cannot be modified/,
      }
    );
  });

  it("allows cancelling a finalized invoice if financial fields remain untouched", () => {
    assert.doesNotThrow(() => {
      checkInvoiceImmutability(baseFinalInvoice, {
        status: "cancelled",
        total: 11800,
        subtotal: 10000,
      });
    });
  });

  it("throws if financial fields are modified during cancellation", () => {
    assert.throws(
      () => {
        checkInvoiceImmutability(baseFinalInvoice, {
          status: "cancelled",
          total: 0, // Illegal tampering during cancellation
        });
      },
      {
        message: /Field "total" cannot be modified/,
      }
    );
  });
});

describe("Credit Note and Debit Note Issuance", () => {
  it("rejects credit note issuance against a draft invoice", () => {
    const draftInvoice: Invoice = {
      id: "inv-draft",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      invoice_no: "INV/2025-26/0002",
      invoice_date: "2025-05-12",
      status: "draft",
      subtotal: 5000,
      cgst: 450,
      sgst: 450,
      igst: 0,
      total: 5900,
      financial_year: "2025-26",
      created_at: "2025-05-12T10:00:00Z",
      updated_at: "2025-05-12T10:00:00Z",
    };

    const res = validateCreditDebitNoteIssuance(draftInvoice, "credit_note");
    assert.equal(res.allowed, false);
    assert.match(res.error!, /can only be issued against finalized invoices/);
  });

  it("allows credit note and debit note issuance against a finalized invoice", () => {
    const finalInvoice: Invoice = {
      id: "inv-final",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      invoice_no: "INV/2025-26/0003",
      invoice_date: "2025-05-15",
      status: "final",
      subtotal: 5000,
      cgst: 450,
      sgst: 450,
      igst: 0,
      total: 5900,
      financial_year: "2025-26",
      created_at: "2025-05-15T10:00:00Z",
      updated_at: "2025-05-15T10:00:00Z",
    };

    const resCredit = validateCreditDebitNoteIssuance(finalInvoice, "credit_note");
    assert.equal(resCredit.allowed, true);

    const resDebit = validateCreditDebitNoteIssuance(finalInvoice, "debit_note");
    assert.equal(resDebit.allowed, true);
  });
});
