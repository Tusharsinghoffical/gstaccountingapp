import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateAgeInDays,
  determineAgeingBucket,
  computeAgeingReport,
} from "../lib/reports/ageing.ts";
import type {
  RawInvoiceInput,
  RawCustomerInput,
  RawAllocationInput,
} from "../lib/reports/ageing.ts";
import { generateAgeingExcelWorkbook } from "../lib/reports/exportAgeingXlsx.ts";

describe("Accounts Receivable Ageing & Outstanding Engine (Prompt 22)", () => {
  const asOfDateStr = "2024-06-30";
  const asOfDate = new Date(asOfDateStr + "T00:00:00Z");

  it("calculates accurate age in days and standard ageing buckets (0-30, 31-60, 61-90, 90+)", () => {
    // 0-30 days
    assert.equal(calculateAgeInDays("2024-06-30", asOfDate), 0);
    assert.equal(determineAgeingBucket(0), "0-30");

    assert.equal(calculateAgeInDays("2024-06-20", asOfDate), 10);
    assert.equal(determineAgeingBucket(10), "0-30");

    assert.equal(calculateAgeInDays("2024-05-31", asOfDate), 30);
    assert.equal(determineAgeingBucket(30), "0-30");

    // 31-60 days
    assert.equal(calculateAgeInDays("2024-05-30", asOfDate), 31);
    assert.equal(determineAgeingBucket(31), "31-60");

    assert.equal(calculateAgeInDays("2024-05-01", asOfDate), 60);
    assert.equal(determineAgeingBucket(60), "31-60");

    // 61-90 days
    assert.equal(calculateAgeInDays("2024-04-30", asOfDate), 61);
    assert.equal(determineAgeingBucket(61), "61-90");

    assert.equal(calculateAgeInDays("2024-04-01", asOfDate), 90);
    assert.equal(determineAgeingBucket(90), "61-90");

    // 90+ days
    assert.equal(calculateAgeInDays("2024-03-31", asOfDate), 91);
    assert.equal(determineAgeingBucket(91), "90+");

    assert.equal(calculateAgeInDays("2024-01-01", asOfDate), 181);
    assert.equal(determineAgeingBucket(181), "90+");

    // Future invoice dates clamp to 0
    assert.equal(calculateAgeInDays("2024-07-15", asOfDate), 0);
  });

  it("subtracts partial payment allocations and excludes fully paid invoices", () => {
    const mockCustomers: RawCustomerInput[] = [
      { id: "cust-1", name: "Apex Technologies Pvt Ltd", gstin: "27AAPFU0939F1ZV" },
    ];

    const mockInvoices: RawInvoiceInput[] = [
      // 1. Partial payment invoice: 100,000 total, 40,000 paid => 60,000 remaining
      {
        id: "inv-1",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/001",
        invoice_date: "2024-06-15", // 15 days old (0-30)
        status: "final",
        total: 100000,
      },
      // 2. Fully paid invoice: 50,000 total, 50,000 paid => 0 remaining (MUST BE EXCLUDED)
      {
        id: "inv-2",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/002",
        invoice_date: "2024-06-10",
        status: "final",
        total: 50000,
      },
    ];

    const mockAllocations: RawAllocationInput[] = [
      { invoice_id: "inv-1", allocated_amount: 40000 },
      { invoice_id: "inv-2", allocated_amount: 50000 },
    ];

    const report = computeAgeingReport(mockInvoices, mockCustomers, mockAllocations, asOfDateStr);

    assert.equal(report.debtor_count, 1);
    assert.equal(report.total_open_invoices, 1); // inv-2 is fully paid and excluded
    assert.equal(report.total_receivables, 60000);
    assert.equal(report.total_0_30, 60000);

    const cust = report.customers[0];
    assert.equal(cust.customer_name, "Apex Technologies Pvt Ltd");
    assert.equal(cust.total_outstanding, 60000);
    assert.equal(cust.bucket_0_30, 60000);
    assert.equal(cust.invoices.length, 1);
    assert.equal(cust.invoices[0].invoice_no, "INV/001");
    assert.equal(cust.invoices[0].remaining_balance, 60000);
  });

  it("strictly excludes purchase invoices, draft invoices, and cancelled invoices", () => {
    const mockCustomers: RawCustomerInput[] = [
      { id: "cust-1", name: "Valid Customer", gstin: "27AAPFU0939F1ZV" },
      { id: "supp-1", name: "Vendor Supplier", gstin: "27BBBBB0000A1Z5" },
    ];

    const mockInvoices: RawInvoiceInput[] = [
      // 1. Valid sales invoice (Should be included)
      {
        id: "inv-valid",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/VALID",
        invoice_date: "2024-06-25",
        status: "final",
        total: 25000,
      },
      // 2. Purchase invoice (Should be excluded)
      {
        id: "inv-purchase",
        type: "purchase",
        customer_or_supplier_id: "supp-1",
        invoice_no: "BILL/001",
        invoice_date: "2024-06-20",
        status: "final",
        total: 80000,
      },
      // 3. Draft sales invoice (Should be excluded)
      {
        id: "inv-draft",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/DRAFT",
        invoice_date: "2024-06-20",
        status: "draft",
        total: 45000,
      },
      // 4. Cancelled sales invoice (Should be excluded)
      {
        id: "inv-cancelled",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/CANCELLED",
        invoice_date: "2024-06-20",
        status: "cancelled",
        total: 30000,
      },
    ];

    const report = computeAgeingReport(mockInvoices, mockCustomers, [], asOfDateStr);

    assert.equal(report.debtor_count, 1);
    assert.equal(report.total_open_invoices, 1);
    assert.equal(report.total_receivables, 25000);
    assert.equal(report.customers[0].customer_name, "Valid Customer");
  });

  it("groups open invoices by customer and sorts strictly by total outstanding descending", () => {
    const mockCustomers: RawCustomerInput[] = [
      { id: "cust-small", name: "Small Debtor", gstin: "27AAAAA1111A1Z1" },
      { id: "cust-large", name: "Large Debtor", gstin: "27BBBBB2222B1Z2" },
      { id: "cust-medium", name: "Medium Debtor", gstin: "27CCCCC3333C1Z3" },
    ];

    const mockInvoices: RawInvoiceInput[] = [
      // Small: 10,000
      {
        id: "inv-s1",
        type: "sales",
        customer_or_supplier_id: "cust-small",
        invoice_no: "INV/S1",
        invoice_date: "2024-06-25", // 5 days (0-30)
        status: "final",
        total: 10000,
      },
      // Large: 1,50,000 (two invoices: 100,000 in 61-90, 50,000 in 90+)
      {
        id: "inv-l1",
        type: "sales",
        customer_or_supplier_id: "cust-large",
        invoice_no: "INV/L1",
        invoice_date: "2024-04-15", // 76 days (61-90)
        status: "final",
        total: 100000,
      },
      {
        id: "inv-l2",
        type: "sales",
        customer_or_supplier_id: "cust-large",
        invoice_no: "INV/L2",
        invoice_date: "2024-02-10", // 141 days (90+)
        status: "final",
        total: 50000,
      },
      // Medium: 75,000 (one invoice in 31-60)
      {
        id: "inv-m1",
        type: "sales",
        customer_or_supplier_id: "cust-medium",
        invoice_no: "INV/M1",
        invoice_date: "2024-05-15", // 46 days (31-60)
        status: "final",
        total: 75000,
      },
    ];

    const report = computeAgeingReport(mockInvoices, mockCustomers, [], asOfDateStr);

    assert.equal(report.debtor_count, 3);
    assert.equal(report.total_receivables, 235000);

    // Verify Descending Sort
    assert.equal(report.customers[0].customer_name, "Large Debtor");
    assert.equal(report.customers[0].total_outstanding, 150000);
    assert.equal(report.customers[0].bucket_61_90, 100000);
    assert.equal(report.customers[0].bucket_90_plus, 50000);

    assert.equal(report.customers[1].customer_name, "Medium Debtor");
    assert.equal(report.customers[1].total_outstanding, 75000);
    assert.equal(report.customers[1].bucket_31_60, 75000);

    assert.equal(report.customers[2].customer_name, "Small Debtor");
    assert.equal(report.customers[2].total_outstanding, 10000);
    assert.equal(report.customers[2].bucket_0_30, 10000);

    // Verify macro totals
    assert.equal(report.total_0_30, 10000);
    assert.equal(report.total_31_60, 75000);
    assert.equal(report.total_61_90, 100000);
    assert.equal(report.total_90_plus, 50000);
    assert.equal(
      report.total_receivables,
      report.total_0_30 + report.total_31_60 + report.total_61_90 + report.total_90_plus
    );
  });

  it("generates a valid multi-sheet Excel workbook (.xlsx) with exceljs", async () => {
    const mockCustomers: RawCustomerInput[] = [
      { id: "cust-1", name: "Zeta Infotech", gstin: "27AAPFU0939F1ZV" },
    ];
    const mockInvoices: RawInvoiceInput[] = [
      {
        id: "inv-z1",
        type: "sales",
        customer_or_supplier_id: "cust-1",
        invoice_no: "INV/Z1",
        invoice_date: "2024-05-10",
        status: "final",
        total: 120000,
      },
    ];

    const report = computeAgeingReport(mockInvoices, mockCustomers, [], asOfDateStr);
    const buffer = await generateAgeingExcelWorkbook(report, {
      name: "GST Ledger Enterprises Pvt Ltd",
      gstin: "27AAPFU0939F1ZV",
    });

    assert.ok(Buffer.isBuffer(buffer), "Expected excel output to be a valid Node Buffer");
    assert.ok(buffer.length > 1000, "Expected non-trivial excel file size");

    // Check ZIP magic bytes (PK\x03\x04 for .xlsx)
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
    assert.equal(buffer[2], 0x03);
    assert.equal(buffer[3], 0x04);
  });
});
