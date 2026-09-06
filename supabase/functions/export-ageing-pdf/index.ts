// deno-lint-ignore-file
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
// ==============================================================================
// Supabase Edge Function: Export Accounts Receivable Ageing Report PDF
// Reference: 05-BUILD-PROMPTS.md (Prompt 22)
// Generates professional, multi-page vector PDF of Ageing report using pdf-lib
// Runtime: Deno / Supabase Edge Functions (Zero client bundle bloat)
// ==============================================================================

// @ts-ignore - Deno imports from esm.sh
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function formatCurrency(amount: number): string {
  return "Rs " + (amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reportData, businessInfo } = await req.json();

    if (!reportData) {
      return new Response(JSON.stringify({ error: "Missing reportData" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessName = businessInfo?.name || "GST Ledger Enterprises Pvt Ltd";
    const businessGstin = businessInfo?.gstin || "27AAPFU0939F1ZV";
    const asOfDate = reportData.as_of_date || new Date().toISOString().slice(0, 10);

    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageWidth = 595.28; // A4 portrait
    const pageHeight = 841.89;
    const margin = 36;
    const printableWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // 1. Header
    page.drawText(businessName, {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.22),
    });
    y -= 16;

    page.drawText(`GSTIN: ${businessGstin}`, {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    });
    y -= 18;

    // Report Title Banner
    page.drawRectangle({
      x: margin,
      y: y - 22,
      width: printableWidth,
      height: 30,
      color: rgb(0.06, 0.32, 0.73), // Navy blue
    });

    page.drawText("ACCOUNTS RECEIVABLE AGEING REPORT", {
      x: margin + 12,
      y: y - 13,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(`As of Date: ${asOfDate}`, {
      x: pageWidth - margin - 140,
      y: y - 13,
      size: 9,
      font: fontRegular,
      color: rgb(1, 1, 1),
    });
    y -= 38;

    // 2. Summary KPI Box
    page.drawRectangle({
      x: margin,
      y: y - 48,
      width: printableWidth,
      height: 48,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    });

    const colW = printableWidth / 5;
    const kpis = [
      { label: "Total Receivables", val: formatCurrency(reportData.total_receivables) },
      { label: "0-30 Days", val: formatCurrency(reportData.total_0_30) },
      { label: "31-60 Days", val: formatCurrency(reportData.total_31_60) },
      { label: "61-90 Days", val: formatCurrency(reportData.total_61_90) },
      { label: "90+ Days (Critical)", val: formatCurrency(reportData.total_90_plus) },
    ];

    kpis.forEach((kpi, idx) => {
      const kX = margin + idx * colW + 8;
      page.drawText(kpi.label, {
        x: kX,
        y: y - 16,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5),
      });
      page.drawText(kpi.val, {
        x: kX,
        y: y - 34,
        size: 9,
        font: fontBold,
        color: rgb(0.06, 0.32, 0.73),
      });
    });
    y -= 62;

    // 3. Table Header
    const drawTableHeader = () => {
      page.drawRectangle({
        x: margin,
        y: y - 16,
        width: printableWidth,
        height: 20,
        color: rgb(0.15, 0.23, 0.36),
      });

      const cols = [
        { label: "Customer Name", x: margin + 6 },
        { label: "GSTIN", x: margin + 150 },
        { label: "0-30d", x: margin + 240 },
        { label: "31-60d", x: margin + 295 },
        { label: "61-90d", x: margin + 350 },
        { label: "90+d", x: margin + 405 },
        { label: "Total (Rs)", x: margin + 460 },
      ];

      cols.forEach((col) => {
        page.drawText(col.label, {
          x: col.x,
          y: y - 12,
          size: 7.5,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      });
      y -= 22;
    };

    drawTableHeader();

    // 4. Rows
    const customers = reportData.customers || [];
    for (const cust of customers) {
      if (y < margin + 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawTableHeader();
      }

      // Customer name truncated if too long
      const custName = (cust.customer_name || "Unknown").slice(0, 24);
      const gstin = (cust.customer_gstin || "-").slice(0, 15);

      page.drawText(custName, {
        x: margin + 6,
        y,
        size: 7.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(gstin, {
        x: margin + 150,
        y,
        size: 7,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(formatCurrency(cust.bucket_0_30), {
        x: margin + 240,
        y,
        size: 7,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(formatCurrency(cust.bucket_31_60), {
        x: margin + 295,
        y,
        size: 7,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(formatCurrency(cust.bucket_61_90), {
        x: margin + 350,
        y,
        size: 7,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(formatCurrency(cust.bucket_90_plus), {
        x: margin + 405,
        y,
        size: 7,
        font: fontRegular,
        color: cust.bucket_90_plus > 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.1, 0.1),
      });
      page.drawText(formatCurrency(cust.total_outstanding), {
        x: margin + 460,
        y,
        size: 7.5,
        font: fontBold,
        color: rgb(0.06, 0.32, 0.73),
      });

      // Bottom separator line
      page.drawLine({
        start: { x: margin, y: y - 4 },
        end: { x: margin + printableWidth, y: y - 4 },
        thickness: 0.5,
        color: rgb(0.9, 0.92, 0.95),
      });

      y -= 16;
    }

    // Grand Totals Row
    if (y < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: printableWidth,
      height: 18,
      color: rgb(0.92, 0.94, 0.97),
    });

    page.drawText("GRAND TOTAL", {
      x: margin + 6,
      y: y - 11,
      size: 8,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(formatCurrency(reportData.total_0_30), {
      x: margin + 240,
      y: y - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(formatCurrency(reportData.total_31_60), {
      x: margin + 295,
      y: y - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(formatCurrency(reportData.total_61_90), {
      x: margin + 350,
      y: y - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(formatCurrency(reportData.total_90_plus), {
      x: margin + 405,
      y: y - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.8, 0.1, 0.1),
    });
    page.drawText(formatCurrency(reportData.total_receivables), {
      x: margin + 460,
      y: y - 11,
      size: 8,
      font: fontBold,
      color: rgb(0.06, 0.32, 0.73),
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Ageing_Report_${asOfDate}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "PDF Generation Error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
