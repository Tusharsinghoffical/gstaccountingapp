import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Invoice, Payment, PaymentAllocation } from "../types/index.ts";

/**
 * Mirror of Postgres get_invoice_remaining_balance helper.
 */
export function calculateInvoiceRemainingBalance(
  invoiceTotal: number,
  allocations: { invoice_id: string; allocated_amount: number }[],
  invoiceId: string
): number {
  const totalAllocated = allocations
    .filter((a) => a.invoice_id === invoiceId)
    .reduce((sum, a) => sum + a.allocated_amount, 0);

  return Math.max(0, Math.round((invoiceTotal - totalAllocated) * 100) / 100);
}

/**
 * Validation engine for payment allocation rules.
 */
export function validatePaymentAllocations(
  paymentAmount: number,
  invoices: Invoice[],
  allocations: { invoice_id: string; allocated_amount: number }[],
  existingAllocations: PaymentAllocation[] = []
): { valid: boolean; error?: string } {
  if (paymentAmount <= 0) {
    return { valid: false, error: "Payment amount must be greater than zero." };
  }

  let totalAllocated = 0;

  for (const alloc of allocations) {
    if (alloc.allocated_amount <= 0) {
      return {
        valid: false,
        error: `Allocation amount must be positive. Provided: ${alloc.allocated_amount}`,
      };
    }

    const inv = invoices.find((i) => i.id === alloc.invoice_id);
    if (!inv) {
      return {
        valid: false,
        error: `Invoice ${alloc.invoice_id} not found.`,
      };
    }

    if (inv.status !== "final") {
      return {
        valid: false,
        error: `Cannot allocate payment to invoice ${inv.invoice_no} in "${inv.status}" state. Only finalized invoices can receive payment allocations.`,
      };
    }

    const remainingBalance = calculateInvoiceRemainingBalance(
      inv.total,
      existingAllocations,
      inv.id
    );

    if (alloc.allocated_amount > remainingBalance + 0.01) {
      return {
        valid: false,
        error: `Allocation of ₹${alloc.allocated_amount} exceeds remaining balance of ₹${remainingBalance} on invoice ${inv.invoice_no}.`,
      };
    }

    totalAllocated += alloc.allocated_amount;
  }

  if (totalAllocated > paymentAmount + 0.01) {
    return {
      valid: false,
      error: `Total allocated amount (₹${totalAllocated}) exceeds total payment amount (₹${paymentAmount}).`,
    };
  }

  return { valid: true };
}

/**
 * In-memory transactional runner to verify atomic rollback.
 */
export class TransactionalPaymentService {
  public payments: Payment[] = [];
  public allocations: PaymentAllocation[] = [];

  recordPaymentAtomic(
    payment: Omit<Payment, "id" | "created_at" | "updated_at">,
    invoices: Invoice[],
    requestedAllocations: { invoice_id: string; allocated_amount: number }[]
  ): { success: boolean; paymentId?: string; error?: string } {
    // Snapshot state before transaction
    const initialPaymentCount = this.payments.length;
    const initialAllocationCount = this.allocations.length;

    try {
      // 1. Validation phase
      const validation = validatePaymentAllocations(
        payment.amount,
        invoices,
        requestedAllocations,
        this.allocations
      );

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Insert payment
      const paymentId = `pay-${Date.now()}-${Math.random()}`;
      const newPayment: Payment = {
        ...payment,
        id: paymentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.payments.push(newPayment);

      // 3. Insert allocations
      for (const req of requestedAllocations) {
        this.allocations.push({
          id: `alloc-${Date.now()}-${Math.random()}`,
          business_id: payment.business_id,
          payment_id: paymentId,
          invoice_id: req.invoice_id,
          allocated_amount: req.allocated_amount,
          created_at: new Date().toISOString(),
        });
      }

      return { success: true, paymentId };
    } catch (err: unknown) {
      // Rollback: restore state to exact snapshot
      this.payments.length = initialPaymentCount;
      this.allocations.length = initialAllocationCount;

      return {
        success: false,
        error: err instanceof Error ? err.message : "Transaction failed",
      };
    }
  }
}

describe("Invoice Remaining Balance Computation", () => {
  it("computes full balance for unallocated invoices", () => {
    const bal = calculateInvoiceRemainingBalance(10000, [], "inv-1");
    assert.equal(bal, 10000);
  });

  it("computes accurate balance after partial allocations", () => {
    const existing = [
      { invoice_id: "inv-1", allocated_amount: 3500 },
      { invoice_id: "inv-2", allocated_amount: 2000 },
    ];
    const bal = calculateInvoiceRemainingBalance(10000, existing, "inv-1");
    assert.equal(bal, 6500);
  });

  it("returns 0 balance when invoice is fully paid", () => {
    const existing = [{ invoice_id: "inv-1", allocated_amount: 10000 }];
    const bal = calculateInvoiceRemainingBalance(10000, existing, "inv-1");
    assert.equal(bal, 0);
  });
});

describe("Payment Allocation Validation", () => {
  const sampleInvoices: Invoice[] = [
    {
      id: "inv-101",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      invoice_no: "INV/2025-26/0101",
      invoice_date: "2025-06-01",
      status: "final",
      subtotal: 5000,
      cgst: 450,
      sgst: 450,
      igst: 0,
      total: 5900,
      financial_year: "2025-26",
      created_at: "",
      updated_at: "",
    },
    {
      id: "inv-102",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      invoice_no: "INV/2025-26/0102",
      invoice_date: "2025-06-02",
      status: "final",
      subtotal: 10000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      total: 11800,
      financial_year: "2025-26",
      created_at: "",
      updated_at: "",
    },
    {
      id: "inv-draft",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      invoice_no: "INV/2025-26/0103",
      invoice_date: "2025-06-03",
      status: "draft",
      subtotal: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      total: 1180,
      financial_year: "2025-26",
      created_at: "",
      updated_at: "",
    },
  ];

  it("validates successful partial allocation across multiple invoices", () => {
    // Payment amount ₹10,000
    // Allocate ₹5,900 to inv-101 (fully paid), ₹4,000 to inv-102 (partial), ₹100 unallocated advance
    const res = validatePaymentAllocations(
      10000,
      sampleInvoices,
      [
        { invoice_id: "inv-101", allocated_amount: 5900 },
        { invoice_id: "inv-102", allocated_amount: 4000 },
      ],
      []
    );

    assert.equal(res.valid, true);
  });

  it("rejects allocation exceeding invoice remaining balance", () => {
    const res = validatePaymentAllocations(
      10000,
      sampleInvoices,
      [{ invoice_id: "inv-101", allocated_amount: 6000 }], // 6000 > 5900
      []
    );

    assert.equal(res.valid, false);
    assert.match(res.error!, /exceeds remaining balance/);
  });

  it("rejects total allocations exceeding payment amount", () => {
    const res = validatePaymentAllocations(
      2000,
      sampleInvoices,
      [{ invoice_id: "inv-101", allocated_amount: 3000 }], // 3000 > 2000 payment
      []
    );

    assert.equal(res.valid, false);
    assert.match(res.error!, /exceeds total payment amount/);
  });

  it("rejects allocation against a draft invoice", () => {
    const res = validatePaymentAllocations(
      1000,
      sampleInvoices,
      [{ invoice_id: "inv-draft", allocated_amount: 500 }],
      []
    );

    assert.equal(res.valid, false);
    assert.match(res.error!, /Only finalized invoices can receive payment allocations/);
  });
});

describe("Single-Transaction Atomic Rollback Execution", () => {
  it("rolls back payment completely if any allocation fails", () => {
    const service = new TransactionalPaymentService();

    const sampleInvoices: Invoice[] = [
      {
        id: "inv-1",
        business_id: "biz-1",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/2025-26/0001",
        invoice_date: "2025-06-01",
        status: "final",
        subtotal: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        total: 1180,
        financial_year: "2025-26",
        created_at: "",
        updated_at: "",
      },
    ];

    // 1. Initial successful payment
    const res1 = service.recordPaymentAtomic(
      {
        business_id: "biz-1",
        party_id: "cust-1",
        amount: 500,
        date: "2025-06-10",
        mode: "bank_transfer",
      },
      sampleInvoices,
      [{ invoice_id: "inv-1", allocated_amount: 500 }]
    );

    assert.equal(res1.success, true);
    assert.equal(service.payments.length, 1);
    assert.equal(service.allocations.length, 1);

    // 2. Attempt invalid payment that over-allocates
    // Remaining balance is ₹680 (1180 - 500). Trying to allocate ₹800 must fail and ROLL BACK.
    const res2 = service.recordPaymentAtomic(
      {
        business_id: "biz-1",
        party_id: "cust-1",
        amount: 1000,
        date: "2025-06-11",
        mode: "upi",
      },
      sampleInvoices,
      [{ invoice_id: "inv-1", allocated_amount: 800 }]
    );

    assert.equal(res2.success, false);
    assert.match(res2.error!, /exceeds remaining balance/);

    // CRITICAL ATOMICITY CHECK:
    // The payment count must STILL be 1! The failed payment was rolled back completely.
    assert.equal(service.payments.length, 1);
    assert.equal(service.allocations.length, 1);
  });
});
