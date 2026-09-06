// ==============================================================================
// Domain Engine: Accounts Receivable Ageing & Outstanding Report
// Reference: 05-BUILD-PROMPTS.md (Prompt 22)
// Buckets: 0-30, 31-60, 61-90, 90+ days based on invoice date vs asOfDate.
// Sorted by total outstanding descending.
// ==============================================================================

export type AgeingBucket = "0-30" | "31-60" | "61-90" | "90+";

export interface OpenInvoiceForAgeing {
  id: string;
  invoice_no: string;
  invoice_date: string;
  total: number;
  paid_amount: number;
  remaining_balance: number;
  age_in_days: number;
  bucket: AgeingBucket;
}

export interface CustomerAgeingSummary {
  customer_id: string;
  customer_name: string;
  customer_gstin: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total_outstanding: number;
  total_invoiced: number;
  total_paid: number;
  invoice_count: number;
  invoices: OpenInvoiceForAgeing[];
}

export interface AgeingReportData {
  as_of_date: string; // YYYY-MM-DD
  generated_at: string;
  total_receivables: number;
  total_0_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
  debtor_count: number;
  total_open_invoices: number;
  customers: CustomerAgeingSummary[];
}

export interface RawInvoiceInput {
  id: string;
  type: string; // 'sales' | 'purchase'
  customer_or_supplier_id: string;
  party_name?: string;
  invoice_no: string;
  invoice_date: string;
  status: string; // 'draft' | 'final' | 'cancelled'
  total: number;
}

export interface RawCustomerInput {
  id: string;
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface RawAllocationInput {
  invoice_id: string;
  allocated_amount: number;
}

/**
 * Calculates calendar day difference between invoice date and as-of date.
 * If invoice date is equal to or after asOfDate, returns 0.
 */
export function calculateAgeInDays(invoiceDateStr: string, asOfDate: Date): number {
  const invDate = new Date(invoiceDateStr + "T00:00:00Z");
  const asOf = new Date(
    Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth(),
      asOfDate.getUTCDate()
    )
  );

  const diffMs = asOf.getTime() - invDate.getTime();
  if (diffMs <= 0 || isNaN(diffMs)) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Maps elapsed days to the standard accounting ageing bucket.
 */
export function determineAgeingBucket(days: number): AgeingBucket {
  if (days <= 30) {
    return "0-30";
  } else if (days <= 60) {
    return "31-60";
  } else if (days <= 90) {
    return "61-90";
  } else {
    return "90+";
  }
}

/**
 * Computes Accounts Receivable Outstanding / Ageing Report.
 * - Filters to finalized sales invoices with remaining balance > 0
 * - Buckets outstanding amount into 0-30, 31-60, 61-90, 90+ based on invoice_date vs asOfDate
 * - Sorts customers by total outstanding descending
 */
export function computeAgeingReport(
  invoices: RawInvoiceInput[],
  customers: RawCustomerInput[],
  allocations: RawAllocationInput[],
  asOfDateStr?: string
): AgeingReportData {
  // Normalize asOfDate
  const asOfDate = asOfDateStr
    ? new Date(asOfDateStr + "T00:00:00Z")
    : new Date();

  const asOfDateFormatted = asOfDateStr || asOfDate.toISOString().slice(0, 10);

  // Build lookup maps
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Sum allocations per invoice
  const allocationSumMap = new Map<string, number>();
  for (const alloc of allocations) {
    if (alloc.allocated_amount > 0) {
      const current = allocationSumMap.get(alloc.invoice_id) || 0;
      allocationSumMap.set(alloc.invoice_id, current + alloc.allocated_amount);
    }
  }

  // Filter eligible sales invoices:
  // 1. Must be outward sales (type === 'sales')
  // 2. Must be finalized (status === 'final')
  // 3. Must have remaining balance > 0
  const openInvoicesByCustomer = new Map<string, OpenInvoiceForAgeing[]>();

  for (const inv of invoices) {
    if (inv.type !== "sales") continue;
    if (inv.status !== "final") continue;

    const paid = allocationSumMap.get(inv.id) || 0;
    const remaining = Math.max(0, Math.round((inv.total - paid) * 100) / 100);

    if (remaining <= 0) continue; // Fully paid, skip

    const ageInDays = calculateAgeInDays(inv.invoice_date, asOfDate);
    const bucket = determineAgeingBucket(ageInDays);

    const openInv: OpenInvoiceForAgeing = {
      id: inv.id,
      invoice_no: inv.invoice_no,
      invoice_date: inv.invoice_date,
      total: Math.round(inv.total * 100) / 100,
      paid_amount: Math.round(paid * 100) / 100,
      remaining_balance: remaining,
      age_in_days: ageInDays,
      bucket,
    };

    const list = openInvoicesByCustomer.get(inv.customer_or_supplier_id) || [];
    list.push(openInv);
    openInvoicesByCustomer.set(inv.customer_or_supplier_id, list);
  }

  // Aggregate by customer
  const customerSummaries: CustomerAgeingSummary[] = [];

  openInvoicesByCustomer.forEach((openInvs, custId) => {
    const custInfo = customerMap.get(custId);
    const customerName = custInfo?.name || "Unknown Customer";
    const customerGstin = custInfo?.gstin || null;

    let b0_30 = 0;
    let b31_60 = 0;
    let b61_90 = 0;
    let b90_plus = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    // Sort invoices FIFO (oldest first)
    openInvs.sort(
      (a, b) =>
        new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );

    for (const inv of openInvs) {
      totalInvoiced += inv.total;
      totalPaid += inv.paid_amount;
      totalOutstanding += inv.remaining_balance;

      switch (inv.bucket) {
        case "0-30":
          b0_30 += inv.remaining_balance;
          break;
        case "31-60":
          b31_60 += inv.remaining_balance;
          break;
        case "61-90":
          b61_90 += inv.remaining_balance;
          break;
        case "90+":
          b90_plus += inv.remaining_balance;
          break;
      }
    }

    customerSummaries.push({
      customer_id: custId,
      customer_name: customerName,
      customer_gstin: customerGstin,
      customer_phone: custInfo?.phone || null,
      customer_email: custInfo?.email || null,
      bucket_0_30: Math.round(b0_30 * 100) / 100,
      bucket_31_60: Math.round(b31_60 * 100) / 100,
      bucket_61_90: Math.round(b61_90 * 100) / 100,
      bucket_90_plus: Math.round(b90_plus * 100) / 100,
      total_outstanding: Math.round(totalOutstanding * 100) / 100,
      total_invoiced: Math.round(totalInvoiced * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      invoice_count: openInvs.length,
      invoices: openInvs,
    });
  });

  // Sort by total outstanding descending (Prompt 22 requirement)
  customerSummaries.sort((a, b) => b.total_outstanding - a.total_outstanding);

  // Compute macro totals
  let totalReceivables = 0;
  let total0_30 = 0;
  let total31_60 = 0;
  let total61_90 = 0;
  let total90_plus = 0;
  let totalOpenInvoices = 0;

  for (const c of customerSummaries) {
    totalReceivables += c.total_outstanding;
    total0_30 += c.bucket_0_30;
    total31_60 += c.bucket_31_60;
    total61_90 += c.bucket_61_90;
    total90_plus += c.bucket_90_plus;
    totalOpenInvoices += c.invoice_count;
  }

  return {
    as_of_date: asOfDateFormatted,
    generated_at: new Date().toISOString(),
    total_receivables: Math.round(totalReceivables * 100) / 100,
    total_0_30: Math.round(total0_30 * 100) / 100,
    total_31_60: Math.round(total31_60 * 100) / 100,
    total_61_90: Math.round(total61_90 * 100) / 100,
    total_90_plus: Math.round(total90_plus * 100) / 100,
    debtor_count: customerSummaries.length,
    total_open_invoices: totalOpenInvoices,
    customers: customerSummaries,
  };
}
