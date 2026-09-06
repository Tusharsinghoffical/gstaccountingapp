"use server";

import { recordPaymentSchema, RecordPaymentFormData } from "@/lib/validation/payment";
import { getCustomerById, getSupplierById, addLedgerEntry } from "./parties";
import { getInvoices } from "./invoices";
import { Payment, PaymentAllocation, Invoice } from "@/types";

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

// In-memory demo store for payments & allocations
let demoPayments: Payment[] = [
  {
    id: "pay-1",
    business_id: "biz-1",
    party_id: "cust-1",
    amount: 100000,
    date: "2024-04-20",
    mode: "bank_transfer",
    reference_no: "HDFC998822",
    notes: "Part payment for IT advisory",
    created_at: "2024-04-20T10:00:00Z",
    updated_at: "2024-04-20T10:00:00Z",
  },
];

let demoAllocations: PaymentAllocation[] = [
  {
    id: "alloc-1",
    business_id: "biz-1",
    payment_id: "pay-1",
    invoice_id: "inv-1",
    allocated_amount: 100000,
    created_at: "2024-04-20T10:00:00Z",
  },
];

export async function getPaymentAllocations(): Promise<PaymentAllocation[]> {
  return [...demoAllocations];
}

export async function getPayments(): Promise<PaymentWithParty[]> {
  const allInvoices = await getInvoices();

  return demoPayments.map((pay) => {
    // Determine party name
    let partyName = "Unknown Party";
    const invoiceForParty = allInvoices.find(
      (inv) => inv.customer_or_supplier_id === pay.party_id
    );
    if (invoiceForParty) {
      partyName = (invoiceForParty as any).party_name || "Counterparty";
    }

    const allocations = demoAllocations.filter((a) => a.payment_id === pay.id);
    const allocated_total = allocations.reduce(
      (sum, a) => sum + a.allocated_amount,
      0
    );
    const unallocated = Math.max(0, pay.amount - allocated_total);

    return {
      ...pay,
      party_name: partyName,
      allocated_total,
      unallocated,
    };
  });
}

/**
 * Returns all open (unpaid or partially paid) finalized invoices for a specific party.
 */
export async function getOpenInvoicesForParty(
  partyId: string
): Promise<OpenInvoiceItem[]> {
  const allInvoices = await getInvoices();

  // Filter to finalized invoices belonging to this party
  const partyInvoices = allInvoices.filter(
    (inv) => inv.customer_or_supplier_id === partyId && inv.status === "final"
  );

  const openInvoices: OpenInvoiceItem[] = [];

  for (const inv of partyInvoices) {
    // Sum previous allocations
    const alreadyAllocated = demoAllocations
      .filter((a) => a.invoice_id === inv.id)
      .reduce((sum, a) => sum + a.allocated_amount, 0);

    const remaining = Math.max(
      0,
      Math.round((inv.total - alreadyAllocated) * 100) / 100
    );

    if (remaining > 0) {
      openInvoices.push({
        id: inv.id,
        invoice_no: inv.invoice_no,
        invoice_date: inv.invoice_date,
        type: inv.type,
        total: inv.total,
        paid_amount: alreadyAllocated,
        remaining_balance: remaining,
      });
    }
  }

  // Sort by invoice date (FIFO default)
  return openInvoices.sort(
    (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
  );
}

/**
 * Atomically records a payment and allocates it across open invoices.
 * Single transaction guarantee: if any allocation fails, the payment rolls back.
 */
export async function recordPayment(
  formData: RecordPaymentFormData
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  // 1. Validate payload structure
  const parsed = recordPaymentSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid payment data",
    };
  }

  const { party_id, amount, date, mode, reference_no, notes, allocations } =
    parsed.data;

  // 2. Fetch party
  const customer = await getCustomerById(party_id);
  const supplier = customer ? null : await getSupplierById(party_id);

  if (!customer && !supplier) {
    return { success: false, error: "Selected counterparty does not exist." };
  }

  // 3. Snapshot state for transactional rollback
  const initialPaymentCount = demoPayments.length;
  const initialAllocationCount = demoAllocations.length;

  try {
    const allInvoices = await getInvoices();
    let totalAllocated = 0;

    // Validate each allocation BEFORE committing
    for (const alloc of allocations) {
      if (alloc.allocated_amount <= 0) continue;

      const inv = allInvoices.find((i) => i.id === alloc.invoice_id);
      if (!inv) {
        throw new Error(`Invoice ${alloc.invoice_id} does not exist.`);
      }

      if (inv.customer_or_supplier_id !== party_id) {
        throw new Error(
          `Invoice ${inv.invoice_no} does not belong to the selected counterparty.`
        );
      }

      if (inv.status !== "final") {
        throw new Error(
          `Invoice ${inv.invoice_no} is in "${inv.status}" state. Only finalized invoices can receive payments.`
        );
      }

      // Check remaining balance
      const alreadyAllocated = demoAllocations
        .filter((a) => a.invoice_id === inv.id)
        .reduce((sum, a) => sum + a.allocated_amount, 0);

      const remaining = Math.max(
        0,
        Math.round((inv.total - alreadyAllocated) * 100) / 100
      );

      if (alloc.allocated_amount > remaining + 0.01) {
        throw new Error(
          `Allocation of ₹${alloc.allocated_amount} exceeds remaining balance of ₹${remaining} on invoice ${inv.invoice_no}.`
        );
      }

      totalAllocated += alloc.allocated_amount;
    }

    if (totalAllocated > amount + 0.01) {
      throw new Error(
        `Total allocated amount (₹${totalAllocated}) exceeds the payment amount (₹${amount}).`
      );
    }

    // 4. Create Payment
    const paymentId = `pay-${Date.now()}`;
    const newPayment: Payment = {
      id: paymentId,
      business_id: "biz-1",
      party_id,
      amount,
      date,
      mode,
      reference_no: reference_no || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    demoPayments.unshift(newPayment);

    // 5. Create Payment Allocations
    for (const alloc of allocations) {
      if (alloc.allocated_amount <= 0) continue;

      demoAllocations.push({
        id: `alloc-${Date.now()}-${Math.random()}`,
        business_id: "biz-1",
        payment_id: paymentId,
        invoice_id: alloc.invoice_id,
        allocated_amount: alloc.allocated_amount,
        created_at: new Date().toISOString(),
      });
    }

    // 6. Post double-entry ledger record
    await addLedgerEntry({
      business_id: "biz-1",
      party_id,
      entry_type: customer ? "credit" : "debit",
      amount,
      ref_invoice_id: allocations[0]?.invoice_id || null,
      ref_payment_id: paymentId,
      description: `Payment recorded via ${mode.toUpperCase()}${
        reference_no ? ` (Ref: ${reference_no})` : ""
      }`,
      entry_date: date,
    });

    return { success: true, data: newPayment };
  } catch (err: unknown) {
    // ATOMIC ROLLBACK: restore store state
    demoPayments.length = initialPaymentCount;
    demoAllocations.length = initialAllocationCount;

    return {
      success: false,
      error: err instanceof Error ? err.message : "Payment allocation failed and was rolled back.",
    };
  }
}
