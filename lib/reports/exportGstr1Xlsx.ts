import ExcelJS from "exceljs";
import type { Gstr1ReportData } from "./gstr1.ts";

/**
 * Generates a styled GSTR-1 multi-sheet Excel workbook using exceljs.
 * Sheets: Summary, B2B Invoices, B2C Small Supplies, HSN Summary.
 */
export async function generateGstr1ExcelWorkbook(
  reportData: Gstr1ReportData,
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

  // --- SHEET 1: Summary Overview ---
  const sheetSummary = workbook.addWorksheet("Summary Overview", {
    views: [{ showGridLines: true }],
  });

  sheetSummary.columns = [
    { header: "Metric / Field", key: "metric", width: 35 },
    { header: "Value", key: "value", width: 28 },
  ];

  // Header styling
  const titleRow = sheetSummary.addRow(["FORM GSTR-1 SUMMARY RETURN", ""]);
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E3A8A" } };
  sheetSummary.mergeCells("A2:B2");

  sheetSummary.addRow(["Business Name", businessName]);
  sheetSummary.addRow(["Business GSTIN", businessGstin]);
  sheetSummary.addRow(["Financial Year", reportData.financial_year]);
  sheetSummary.addRow(["Return Period", reportData.period_label]);
  sheetSummary.addRow(["Report Generated", new Date().toLocaleString("en-IN")]);
  sheetSummary.addRow([]);

  const sectionRow = sheetSummary.addRow(["Summary of Outward Supplies", "Amount (INR)"]);
  sectionRow.font = { bold: true };
  sectionRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  const addMetricRow = (label: string, val: number) => {
    const row = sheetSummary.addRow([label, val]);
    row.getCell(2).numFmt = "₹#,##0.00";
    return row;
  };

  addMetricRow("Gross Turnover (Total Value)", reportData.gross_turnover);
  addMetricRow("Total Taxable Value", reportData.total_taxable_value);
  addMetricRow("Central Tax (CGST)", reportData.total_cgst);
  addMetricRow("State Tax (SGST)", reportData.total_sgst);
  addMetricRow("Integrated Tax (IGST)", reportData.total_igst);
  addMetricRow("Total Tax Liability", reportData.total_tax_liability);
  addMetricRow("Total B2B Invoices Value", reportData.total_b2b_value);
  addMetricRow("Total B2C Invoices Value", reportData.total_b2c_value);

  // --- SHEET 2: Table 4 - B2B Invoices ---
  const sheetB2B = workbook.addWorksheet("Table 4 - B2B Invoices", {
    views: [{ showGridLines: true }],
  });

  sheetB2B.columns = [
    { header: "Recipient GSTIN", key: "gstin", width: 18 },
    { header: "Receiver Name", key: "name", width: 28 },
    { header: "Invoice Number", key: "inv_no", width: 22 },
    { header: "Invoice Date", key: "date", width: 14 },
    { header: "Place of Supply", key: "pos", width: 18 },
    { header: "Reverse Charge", key: "rev", width: 16 },
    { header: "Taxable Value (₹)", key: "taxable", width: 18 },
    { header: "CGST (₹)", key: "cgst", width: 14 },
    { header: "SGST (₹)", key: "sgst", width: 14 },
    { header: "IGST (₹)", key: "igst", width: 14 },
    { header: "Total Tax (₹)", key: "tax", width: 16 },
    { header: "Invoice Total (₹)", key: "total", width: 18 },
  ];

  const headerB2B = sheetB2B.getRow(1);
  headerB2B.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerB2B.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };

  for (const group of reportData.b2b_groups) {
    for (const inv of group.invoices) {
      const r = sheetB2B.addRow({
        gstin: group.customer_gstin,
        name: group.customer_name,
        inv_no: inv.invoice_no,
        date: inv.invoice_date,
        pos: `${group.pos_state} - ${group.pos_state_name}`,
        rev: inv.reverse_charge,
        taxable: inv.taxable_value,
        cgst: inv.cgst,
        sgst: inv.sgst,
        igst: inv.igst,
        tax: inv.total_tax,
        total: inv.invoice_value,
      });

      [7, 8, 9, 10, 11, 12].forEach((colIdx) => {
        r.getCell(colIdx).numFmt = "₹#,##0.00";
      });
    }
  }

  // --- SHEET 3: Table 7 - B2C Small Supplies ---
  const sheetB2C = workbook.addWorksheet("Table 7 - B2C Supplies", {
    views: [{ showGridLines: true }],
  });

  sheetB2C.columns = [
    { header: "Place of Supply Code", key: "pos_code", width: 22 },
    { header: "State Name", key: "state_name", width: 24 },
    { header: "Applicable Rate (%)", key: "rate", width: 20 },
    { header: "Invoice Count", key: "count", width: 16 },
    { header: "Taxable Value (₹)", key: "taxable", width: 18 },
    { header: "CGST (₹)", key: "cgst", width: 14 },
    { header: "SGST (₹)", key: "sgst", width: 14 },
    { header: "IGST (₹)", key: "igst", width: 14 },
    { header: "Total Tax (₹)", key: "tax", width: 16 },
    { header: "Total Value (₹)", key: "total", width: 18 },
  ];

  const headerB2C = sheetB2C.getRow(1);
  headerB2C.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerB2C.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0D9488" },
  };

  for (const b2c of reportData.b2c_summaries) {
    const r = sheetB2C.addRow({
      pos_code: b2c.pos_state,
      state_name: b2c.pos_state_name,
      rate: `${b2c.tax_rate}%`,
      count: b2c.invoice_count,
      taxable: b2c.taxable_value,
      cgst: b2c.cgst,
      sgst: b2c.sgst,
      igst: b2c.igst,
      tax: b2c.total_tax,
      total: b2c.total_invoice_value,
    });

    [5, 6, 7, 8, 9, 10].forEach((colIdx) => {
      r.getCell(colIdx).numFmt = "₹#,##0.00";
    });
  }

  // --- SHEET 4: Table 12 - HSN Summary ---
  const sheetHSN = workbook.addWorksheet("Table 12 - HSN Summary", {
    views: [{ showGridLines: true }],
  });

  sheetHSN.columns = [
    { header: "HSN / SAC Code", key: "hsn", width: 16 },
    { header: "Description of Goods/Services", key: "desc", width: 34 },
    { header: "UQC", key: "uqc", width: 10 },
    { header: "Total Quantity", key: "qty", width: 15 },
    { header: "Total Taxable Value (₹)", key: "taxable", width: 22 },
    { header: "CGST (₹)", key: "cgst", width: 14 },
    { header: "SGST (₹)", key: "sgst", width: 14 },
    { header: "IGST (₹)", key: "igst", width: 14 },
    { header: "Total Tax Amount (₹)", key: "tax", width: 20 },
    { header: "Total Value (₹)", key: "total", width: 18 },
  ];

  const headerHSN = sheetHSN.getRow(1);
  headerHSN.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerHSN.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7C3AED" },
  };

  for (const hsn of reportData.hsn_summaries) {
    const r = sheetHSN.addRow({
      hsn: hsn.hsn_code,
      desc: hsn.description,
      uqc: hsn.uqc,
      qty: hsn.total_quantity,
      taxable: hsn.taxable_value,
      cgst: hsn.cgst,
      sgst: hsn.sgst,
      igst: hsn.igst,
      tax: hsn.total_tax,
      total: hsn.total_value,
    });

    [5, 6, 7, 8, 9, 10].forEach((colIdx) => {
      r.getCell(colIdx).numFmt = "₹#,##0.00";
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
