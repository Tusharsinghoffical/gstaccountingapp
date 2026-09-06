import ExcelJS from "exceljs";
import type { AgeingReportData } from "./ageing.ts";

/**
 * Generates a styled Accounts Receivable Ageing multi-sheet Excel workbook using exceljs.
 * Sheets:
 *  1. Ageing Summary (Customer receivables grouped into 0-30, 31-60, 61-90, 90+ buckets)
 *  2. Invoice Breakdown (Detailed list of all unpaid / partially paid invoices with age and balance)
 */
export async function generateAgeingExcelWorkbook(
  reportData: AgeingReportData,
  businessInfo?: {
    name?: string;
    gstin?: string;
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GST Ledger";
  workbook.lastModifiedBy = "GST Ledger";
  workbook.created = new Date();
  workbook.modified = new Date();

  const businessName = businessInfo?.name || "GST Ledger Enterprises Pvt Ltd";
  const businessGstin = businessInfo?.gstin || "27AAPFU0939F1ZV";

  // ============================================================================
  // SHEET 1: Ageing Summary
  // ============================================================================
  const sheetSummary = workbook.addWorksheet("Ageing Summary", {
    views: [{ showGridLines: true }],
  });

  // Title Block
  const titleRow = sheetSummary.addRow(["ACCOUNTS RECEIVABLE AGEING REPORT"]);
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E3A8A" } };
  sheetSummary.mergeCells("A1:H1");

  sheetSummary.addRow(["Business Name", businessName]);
  sheetSummary.addRow(["Business GSTIN", businessGstin]);
  sheetSummary.addRow(["As of Date", reportData.as_of_date]);
  sheetSummary.addRow(["Generated At", new Date().toLocaleString("en-IN")]);
  sheetSummary.addRow([]);

  // Macro Metrics Card
  const kpiHeader = sheetSummary.addRow(["Receivables Metric", "Amount / Count"]);
  kpiHeader.font = { bold: true };
  kpiHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  const addMetric = (label: string, val: number, isCurrency = true) => {
    const r = sheetSummary.addRow([label, val]);
    if (isCurrency) {
      r.getCell(2).numFmt = "₹#,##0.00";
    } else {
      r.getCell(2).numFmt = "#,##0";
    }
  };

  addMetric("Total Outstanding Receivables", reportData.total_receivables);
  addMetric("0 - 30 Days (Current / Healthy)", reportData.total_0_30);
  addMetric("31 - 60 Days (Follow-up Required)", reportData.total_31_60);
  addMetric("61 - 90 Days (Overdue Alert)", reportData.total_61_90);
  addMetric("90+ Days (Critical / High Risk)", reportData.total_90_plus);
  addMetric("Total Customers with Balance", reportData.debtor_count, false);
  addMetric("Total Unpaid / Partial Invoices", reportData.total_open_invoices, false);

  sheetSummary.addRow([]);

  // Customer Summary Table Header
  const tableHeader = sheetSummary.addRow([
    "Customer Name",
    "Customer GSTIN",
    "0-30 Days (₹)",
    "31-60 Days (₹)",
    "61-90 Days (₹)",
    "90+ Days (₹)",
    "Total Outstanding (₹)",
    "Open Invoices",
  ]);

  tableHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  tableHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Dark slate
  };

  for (const cust of reportData.customers) {
    const row = sheetSummary.addRow([
      cust.customer_name,
      cust.customer_gstin || "Unregistered",
      cust.bucket_0_30,
      cust.bucket_31_60,
      cust.bucket_61_90,
      cust.bucket_90_plus,
      cust.total_outstanding,
      cust.invoice_count,
    ]);

    row.getCell(3).numFmt = "₹#,##0.00";
    row.getCell(4).numFmt = "₹#,##0.00";
    row.getCell(5).numFmt = "₹#,##0.00";
    row.getCell(6).numFmt = "₹#,##0.00";
    row.getCell(7).numFmt = "₹#,##0.00";
    row.getCell(8).alignment = { horizontal: "center" };
  }

  // Totals Row
  const totalRow = sheetSummary.addRow([
    "TOTALS",
    "",
    reportData.total_0_30,
    reportData.total_31_60,
    reportData.total_61_90,
    reportData.total_90_plus,
    reportData.total_receivables,
    reportData.total_open_invoices,
  ]);

  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  totalRow.getCell(3).numFmt = "₹#,##0.00";
  totalRow.getCell(4).numFmt = "₹#,##0.00";
  totalRow.getCell(5).numFmt = "₹#,##0.00";
  totalRow.getCell(6).numFmt = "₹#,##0.00";
  totalRow.getCell(7).numFmt = "₹#,##0.00";
  totalRow.getCell(8).alignment = { horizontal: "center" };

  // Adjust column widths
  sheetSummary.columns = [
    { width: 34 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 24 },
    { width: 16 },
  ];

  // ============================================================================
  // SHEET 2: Invoice Breakdown
  // ============================================================================
  const sheetDetails = workbook.addWorksheet("Invoice Breakdown", {
    views: [{ showGridLines: true }],
  });

  const detailHeader = sheetDetails.addRow([
    "Customer Name",
    "Customer GSTIN",
    "Invoice No",
    "Invoice Date",
    "Age (Days)",
    "Ageing Bucket",
    "Original Total (₹)",
    "Amount Paid (₹)",
    "Outstanding Balance (₹)",
  ]);

  detailHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  detailHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" }, // Teal
  };

  for (const cust of reportData.customers) {
    for (const inv of cust.invoices) {
      const row = sheetDetails.addRow([
        cust.customer_name,
        cust.customer_gstin || "Unregistered",
        inv.invoice_no,
        inv.invoice_date,
        inv.age_in_days,
        inv.bucket,
        inv.total,
        inv.paid_amount,
        inv.remaining_balance,
      ]);

      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(6).alignment = { horizontal: "center" };
      row.getCell(7).numFmt = "₹#,##0.00";
      row.getCell(8).numFmt = "₹#,##0.00";
      row.getCell(9).numFmt = "₹#,##0.00";
    }
  }

  // Invoice Breakdown Grand Total
  let totalOriginal = 0;
  let totalPaid = 0;
  let totalRemaining = 0;

  for (const cust of reportData.customers) {
    for (const inv of cust.invoices) {
      totalOriginal += inv.total;
      totalPaid += inv.paid_amount;
      totalRemaining += inv.remaining_balance;
    }
  }

  const detailTotalRow = sheetDetails.addRow([
    "TOTALS",
    "",
    "",
    "",
    "",
    "",
    totalOriginal,
    totalPaid,
    totalRemaining,
  ]);

  detailTotalRow.font = { bold: true };
  detailTotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  detailTotalRow.getCell(7).numFmt = "₹#,##0.00";
  detailTotalRow.getCell(8).numFmt = "₹#,##0.00";
  detailTotalRow.getCell(9).numFmt = "₹#,##0.00";

  sheetDetails.columns = [
    { width: 32 },
    { width: 20 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 20 },
    { width: 18 },
    { width: 24 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
