// deno-lint-ignore-file
/// <reference path="../deno.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ExcelJS from "https://esm.sh/exceljs@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const reportData = body.reportData;
    const businessInfo = body.businessInfo || {
      name: "GST Ledger Enterprises Pvt Ltd",
      gstin: "27AAPFU0939F1ZV",
    };

    if (!reportData) {
      return new Response(
        JSON.stringify({ error: "Missing reportData in payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "GST Ledger Edge";
    workbook.created = new Date();

    // Sheet 1: Summary Overview
    const sheetSummary = workbook.addWorksheet("Summary Overview");
    sheetSummary.columns = [
      { header: "Metric / Field", key: "metric", width: 35 },
      { header: "Value", key: "value", width: 28 },
    ];
    sheetSummary.addRow(["FORM GSTR-1 SUMMARY RETURN", ""]);
    sheetSummary.addRow(["Business Name", businessInfo.name]);
    sheetSummary.addRow(["Business GSTIN", businessInfo.gstin]);
    sheetSummary.addRow(["Financial Year", reportData.financial_year]);
    sheetSummary.addRow(["Return Period", reportData.period_label]);
    sheetSummary.addRow([]);
    sheetSummary.addRow(["Gross Turnover", reportData.gross_turnover]);
    sheetSummary.addRow(["Total Taxable Value", reportData.total_taxable_value]);
    sheetSummary.addRow(["Central Tax (CGST)", reportData.total_cgst]);
    sheetSummary.addRow(["State Tax (SGST)", reportData.total_sgst]);
    sheetSummary.addRow(["Integrated Tax (IGST)", reportData.total_igst]);
    sheetSummary.addRow(["Total Tax Liability", reportData.total_tax_liability]);
    sheetSummary.addRow(["Total B2B Value", reportData.total_b2b_value]);
    sheetSummary.addRow(["Total B2C Value", reportData.total_b2c_value]);

    // Sheet 2: B2B Invoices
    const sheetB2B = workbook.addWorksheet("Table 4 - B2B Invoices");
    sheetB2B.columns = [
      { header: "Recipient GSTIN", key: "gstin", width: 18 },
      { header: "Receiver Name", key: "name", width: 28 },
      { header: "Invoice Number", key: "inv_no", width: 22 },
      { header: "Invoice Date", key: "date", width: 14 },
      { header: "Place of Supply", key: "pos", width: 18 },
      { header: "Taxable Value (₹)", key: "taxable", width: 18 },
      { header: "CGST (₹)", key: "cgst", width: 14 },
      { header: "SGST (₹)", key: "sgst", width: 14 },
      { header: "IGST (₹)", key: "igst", width: 14 },
      { header: "Total Tax (₹)", key: "tax", width: 16 },
      { header: "Invoice Total (₹)", key: "total", width: 18 },
    ];
    const headerB2B = sheetB2B.getRow(1);
    headerB2B.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerB2B.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };

    for (const group of reportData.b2b_groups || []) {
      for (const inv of group.invoices || []) {
        sheetB2B.addRow({
          gstin: group.customer_gstin,
          name: group.customer_name,
          inv_no: inv.invoice_no,
          date: inv.invoice_date,
          pos: `${group.pos_state} - ${group.pos_state_name}`,
          taxable: inv.taxable_value,
          cgst: inv.cgst,
          sgst: inv.sgst,
          igst: inv.igst,
          tax: inv.total_tax,
          total: inv.invoice_value,
        });
      }
    }

    // Sheet 3: B2C Supplies
    const sheetB2C = workbook.addWorksheet("Table 7 - B2C Supplies");
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
    headerB2C.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };

    for (const b2c of reportData.b2c_summaries || []) {
      sheetB2C.addRow({
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
    }

    // Sheet 4: HSN Summary
    const sheetHSN = workbook.addWorksheet("Table 12 - HSN Summary");
    sheetHSN.columns = [
      { header: "HSN / SAC Code", key: "hsn", width: 16 },
      { header: "Description", key: "desc", width: 34 },
      { header: "Total Quantity", key: "qty", width: 15 },
      { header: "Taxable Value (₹)", key: "taxable", width: 22 },
      { header: "CGST (₹)", key: "cgst", width: 14 },
      { header: "SGST (₹)", key: "sgst", width: 14 },
      { header: "IGST (₹)", key: "igst", width: 14 },
      { header: "Total Tax Amount (₹)", key: "tax", width: 20 },
      { header: "Total Value (₹)", key: "total", width: 18 },
    ];
    const headerHSN = sheetHSN.getRow(1);
    headerHSN.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerHSN.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };

    for (const hsn of reportData.hsn_summaries || []) {
      sheetHSN.addRow({
        hsn: hsn.hsn_code,
        desc: hsn.description,
        qty: hsn.total_quantity,
        taxable: hsn.taxable_value,
        cgst: hsn.cgst,
        sgst: hsn.sgst,
        igst: hsn.igst,
        tax: hsn.total_tax,
        total: hsn.total_value,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="GSTR1_Export.xlsx"`,
      },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
