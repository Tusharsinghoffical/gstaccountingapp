import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchesGstr1Period,
  computeGstr1Report,
} from "../lib/reports/gstr1.ts";
import type {
  SalesInvoiceForReport,
  Gstr1PeriodFilter,
} from "../lib/reports/gstr1.ts";
import { generateGstr1ExcelWorkbook } from "../lib/reports/exportGstr1Xlsx.ts";

describe("GSTR-1 Outward Supplies Summary Engine (Prompt 21)", () => {
  const mockSalesInvoices: SalesInvoiceForReport[] = [
    // 1. B2B Sales Invoice 1 (Maharashtra intra-state, 18%)
    {
      id: "inv-b2b-1",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      party_name: "Acme Infotech Ltd",
      party_gstin: "27AAPFU0939F1ZV",
      party_state_code: "27",
      invoice_no: "INV/2024-25/0001",
      invoice_date: "2024-04-12",
      status: "final",
      subtotal: 100000,
      cgst: 9000,
      sgst: 9000,
      igst: 0,
      total: 118000,
      financial_year: "2024-2025",
      created_at: "2024-04-12T10:00:00Z",
      updated_at: "2024-04-12T10:00:00Z",
      items: [
        {
          id: "it-1",
          business_id: "biz-1",
          invoice_id: "inv-b2b-1",
          description: "Software Development Services",
          hsn_code: "998314",
          qty: 1,
          rate: 100000,
          discount: 0,
          taxable_amount: 100000,
          gst_rate: 18,
          cgst_amount: 9000,
          sgst_amount: 9000,
          igst_amount: 0,
          amount: 118000,
          created_at: "2024-04-12T10:00:00Z",
        },
      ],
    },
    // 2. B2B Sales Invoice 2 (Same Customer, Karnataka inter-state, 18%)
    {
      id: "inv-b2b-2",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      party_name: "Acme Infotech Ltd",
      party_gstin: "27AAPFU0939F1ZV",
      party_state_code: "27",
      invoice_no: "INV/2024-25/0002",
      invoice_date: "2024-04-20",
      status: "final",
      subtotal: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      total: 59000,
      financial_year: "2024-2025",
      created_at: "2024-04-20T10:00:00Z",
      updated_at: "2024-04-20T10:00:00Z",
      items: [
        {
          id: "it-2",
          business_id: "biz-1",
          invoice_id: "inv-b2b-2",
          description: "Cloud Architecture Advisory",
          hsn_code: "998314",
          qty: 2,
          rate: 25000,
          discount: 0,
          taxable_amount: 50000,
          gst_rate: 18,
          cgst_amount: 4500,
          sgst_amount: 4500,
          igst_amount: 0,
          amount: 59000,
          created_at: "2024-04-20T10:00:00Z",
        },
      ],
    },
    // 3. B2B Sales Invoice 3 (Different Customer, Karnataka inter-state, 18%)
    {
      id: "inv-b2b-3",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-2",
      party_name: "Zenith Retail Corp",
      party_gstin: "29AABCU9603R1ZK",
      party_state_code: "29",
      invoice_no: "INV/2024-25/0003",
      invoice_date: "2024-04-25",
      status: "final",
      subtotal: 80000,
      cgst: 0,
      sgst: 0,
      igst: 14400,
      total: 94400,
      financial_year: "2024-2025",
      created_at: "2024-04-25T10:00:00Z",
      updated_at: "2024-04-25T10:00:00Z",
      items: [
        {
          id: "it-3",
          business_id: "biz-1",
          invoice_id: "inv-b2b-3",
          description: "Barcode Scanning Hardware Units",
          hsn_code: "847190",
          qty: 4,
          rate: 20000,
          discount: 0,
          taxable_amount: 80000,
          gst_rate: 18,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 14400,
          amount: 94400,
          created_at: "2024-04-25T10:00:00Z",
        },
      ],
    },
    // 4. B2C Sales Invoice 1 (Unregistered buyer, Maharashtra, 12% item + 18% item)
    {
      id: "inv-b2c-1",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-3",
      party_name: "Walk-in Consumer",
      party_gstin: null, // unregistered!
      party_state_code: "27",
      invoice_no: "INV/2024-25/0004",
      invoice_date: "2024-04-28",
      status: "final",
      subtotal: 20000,
      cgst: 1500,
      sgst: 1500,
      igst: 0,
      total: 23000,
      financial_year: "2024-2025",
      created_at: "2024-04-28T10:00:00Z",
      updated_at: "2024-04-28T10:00:00Z",
      items: [
        {
          id: "it-4",
          business_id: "biz-1",
          invoice_id: "inv-b2c-1",
          description: "Printed Reference Manuals",
          hsn_code: "490110",
          qty: 10,
          rate: 1000,
          discount: 0,
          taxable_amount: 10000,
          gst_rate: 12,
          cgst_amount: 600,
          sgst_amount: 600,
          igst_amount: 0,
          amount: 11200,
          created_at: "2024-04-28T10:00:00Z",
        },
        {
          id: "it-5",
          business_id: "biz-1",
          invoice_id: "inv-b2c-1",
          description: "USB Security Keys",
          hsn_code: "847190",
          qty: 5,
          rate: 2000,
          discount: 0,
          taxable_amount: 10000,
          gst_rate: 18,
          cgst_amount: 900,
          sgst_amount: 900,
          igst_amount: 0,
          amount: 11800,
          created_at: "2024-04-28T10:00:00Z",
        },
      ],
    },
    // 5. Purchase Invoice (MUST be ignored by GSTR-1 outward supplies return)
    {
      id: "inv-pur-1",
      business_id: "biz-1",
      type: "purchase",
      customer_or_supplier_id: "supp-1",
      party_name: "Raw Material Suppliers",
      party_gstin: "27AABCT1234F1ZV",
      invoice_no: "PUR/2024-25/0001",
      invoice_date: "2024-04-10",
      status: "final",
      subtotal: 75000,
      cgst: 6750,
      sgst: 6750,
      igst: 0,
      total: 88500,
      financial_year: "2024-2025",
      created_at: "2024-04-10T10:00:00Z",
      updated_at: "2024-04-10T10:00:00Z",
    },
    // 6. Cancelled Sales Invoice (MUST be ignored)
    {
      id: "inv-can-1",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-1",
      party_name: "Acme Infotech Ltd",
      party_gstin: "27AAPFU0939F1ZV",
      invoice_no: "INV/2024-25/0099",
      invoice_date: "2024-04-15",
      status: "cancelled",
      subtotal: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      total: 59000,
      financial_year: "2024-2025",
      created_at: "2024-04-15T10:00:00Z",
      updated_at: "2024-04-15T10:00:00Z",
    },
    // 7. Sales Invoice in May 2024 (Different month test)
    {
      id: "inv-may-1",
      business_id: "biz-1",
      type: "sales",
      customer_or_supplier_id: "cust-2",
      party_name: "Zenith Retail Corp",
      party_gstin: "29AABCU9603R1ZK",
      invoice_no: "INV/2024-25/0010",
      invoice_date: "2024-05-05",
      status: "final",
      subtotal: 40000,
      cgst: 0,
      sgst: 0,
      igst: 7200,
      total: 47200,
      financial_year: "2024-2025",
      created_at: "2024-05-05T10:00:00Z",
      updated_at: "2024-05-05T10:00:00Z",
    },
  ];

  it("filters dates accurately across Indian Financial Year months and quarters", () => {
    const filterApr: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "month",
      month: "04",
    };
    assert.equal(matchesGstr1Period("2024-04-15", filterApr), true);
    assert.equal(matchesGstr1Period("2024-05-01", filterApr), false);
    assert.equal(matchesGstr1Period("2023-04-15", filterApr), false);

    const filterQ1: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "quarter",
      quarter: "Q1",
    };
    assert.equal(matchesGstr1Period("2024-04-10", filterQ1), true);
    assert.equal(matchesGstr1Period("2024-05-20", filterQ1), true);
    assert.equal(matchesGstr1Period("2024-06-30", filterQ1), true);
    assert.equal(matchesGstr1Period("2024-07-01", filterQ1), false);

    const filterQ4: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "quarter",
      quarter: "Q4",
    };
    assert.equal(matchesGstr1Period("2025-01-15", filterQ4), true);
    assert.equal(matchesGstr1Period("2025-03-31", filterQ4), true);
    assert.equal(matchesGstr1Period("2024-03-31", filterQ4), false); // Previous FY
  });

  it("groups B2B invoices accurately by customer GSTIN (Table 4)", () => {
    const filterApr: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "month",
      month: "04",
    };

    const report = computeGstr1Report(mockSalesInvoices, filterApr);

    // There should be 2 B2B customer groups in April: Acme (2 invoices) and Zenith (1 invoice)
    assert.equal(report.b2b_groups.length, 2);

    const acmeGroup = report.b2b_groups.find((g) => g.customer_gstin === "27AAPFU0939F1ZV");
    assert.ok(acmeGroup);
    assert.equal(acmeGroup.invoice_count, 2);
    assert.equal(acmeGroup.taxable_value, 150000); // 100k + 50k
    assert.equal(acmeGroup.cgst, 13500); // 9k + 4.5k
    assert.equal(acmeGroup.sgst, 13500); // 9k + 4.5k
    assert.equal(acmeGroup.igst, 0);
    assert.equal(acmeGroup.total_tax, 27000);
    assert.equal(acmeGroup.total_invoice_value, 177000);
    assert.equal(acmeGroup.invoices.length, 2);

    const zenithGroup = report.b2b_groups.find((g) => g.customer_gstin === "29AABCU9603R1ZK");
    assert.ok(zenithGroup);
    assert.equal(zenithGroup.invoice_count, 1);
    assert.equal(zenithGroup.taxable_value, 80000);
    assert.equal(zenithGroup.igst, 14400);
    assert.equal(zenithGroup.total_invoice_value, 94400);
  });

  it("summarizes B2C invoices by place of supply state and tax rate slab (Table 7)", () => {
    const filterApr: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "month",
      month: "04",
    };

    const report = computeGstr1Report(mockSalesInvoices, filterApr);

    // Unregistered sale in Maharashtra had 2 items: 12% (10k) and 18% (10k)
    assert.equal(report.b2c_summaries.length, 2);

    const slab12 = report.b2c_summaries.find(
      (b) => b.pos_state === "27" && b.tax_rate === 12
    );
    assert.ok(slab12);
    assert.equal(slab12.taxable_value, 10000);
    assert.equal(slab12.cgst, 600);
    assert.equal(slab12.sgst, 600);
    assert.equal(slab12.total_invoice_value, 11200);

    const slab18 = report.b2c_summaries.find(
      (b) => b.pos_state === "27" && b.tax_rate === 18
    );
    assert.ok(slab18);
    assert.equal(slab18.taxable_value, 10000);
    assert.equal(slab18.cgst, 900);
    assert.equal(slab18.sgst, 900);
    assert.equal(slab18.total_invoice_value, 11800);
  });

  it("aggregates HSN-wise summary table of outward supplies (Table 12)", () => {
    const filterApr: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "month",
      month: "04",
    };

    const report = computeGstr1Report(mockSalesInvoices, filterApr);

    // HSN codes in April outward invoices:
    // 998314: qty 1 (100k) + qty 2 (50k) = qty 3, taxable 150000
    // 847190: qty 4 (80k) + qty 5 (10k) = qty 9, taxable 90000
    // 490110: qty 10 (10k) = qty 10, taxable 10000
    assert.equal(report.hsn_summaries.length, 3);

    const hsnSoftware = report.hsn_summaries.find((h) => h.hsn_code === "998314");
    assert.ok(hsnSoftware);
    assert.equal(hsnSoftware.total_quantity, 3);
    assert.equal(hsnSoftware.taxable_value, 150000);
    assert.equal(hsnSoftware.cgst, 13500);
    assert.equal(hsnSoftware.sgst, 13500);
    assert.equal(hsnSoftware.total_tax, 27000);

    const hsnHardware = report.hsn_summaries.find((h) => h.hsn_code === "847190");
    assert.ok(hsnHardware);
    assert.equal(hsnHardware.total_quantity, 9);
    assert.equal(hsnHardware.taxable_value, 90000);

    const hsnBooks = report.hsn_summaries.find((h) => h.hsn_code === "490110");
    assert.ok(hsnBooks);
    assert.equal(hsnBooks.total_quantity, 10);
    assert.equal(hsnBooks.taxable_value, 10000);
  });

  it("computes accurate gross outward totals and strictly ignores purchases & cancelled invoices", () => {
    const filterApr: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "month",
      month: "04",
    };

    const report = computeGstr1Report(mockSalesInvoices, filterApr);

    // Expected taxable: 100k + 50k + 80k + 20k = 250000
    assert.equal(report.total_taxable_value, 250000);
    // Expected tax liability:
    // CGST: 9000 + 4500 + 1500 = 15000
    // SGST: 9000 + 4500 + 1500 = 15000
    // IGST: 14400
    // Total Tax: 44400
    assert.equal(report.total_cgst, 15000);
    assert.equal(report.total_sgst, 15000);
    assert.equal(report.total_igst, 14400);
    assert.equal(report.total_tax_liability, 44400);

    // Expected gross turnover: 250000 + 44400 = 294400
    assert.equal(report.gross_turnover, 294400);
    assert.equal(report.total_b2b_value, 271400); // 177000 + 94400
    assert.equal(report.total_b2c_value, 23000);
  });

  it("generates a multi-sheet Excel workbook (.xlsx) with exceljs", async () => {
    const filterApr: Gstr1PeriodFilter = {
      financialYear: "2024-25",
      periodType: "month",
      month: "04",
    };

    const report = computeGstr1Report(mockSalesInvoices, filterApr);
    const buffer = await generateGstr1ExcelWorkbook(report);

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 1000, "Expected non-empty binary xlsx buffer");
    // Standard ZIP magic bytes for XLSX: PK\x03\x04
    assert.equal(buffer[0], 0x50); // 'P'
    assert.equal(buffer[1], 0x4b); // 'K'
  });
});
