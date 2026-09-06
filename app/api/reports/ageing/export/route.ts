import { NextRequest, NextResponse } from "next/server";
import { getAgeingReport } from "@/app/actions/reports";
import { generateAgeingExcelWorkbook } from "@/lib/reports/exportAgeingXlsx";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();
    const asOfDate = searchParams.get("asOfDate") || undefined;

    const reportData = await getAgeingReport(asOfDate);

    const businessInfo = {
      name: "GST Ledger Enterprises Pvt Ltd",
      legal_name: "GST Ledger Enterprises Private Limited",
      gstin: "27AAPFU0939F1ZV",
      state_code: "27",
      address: "101, Maker Chambers V, Nariman Point, Mumbai, Maharashtra 400021",
    };

    const dateSlug = reportData.as_of_date || "today";

    // ------------------------------------------------------------------------
    // 1. PDF EXPORT
    // ------------------------------------------------------------------------
    if (format === "pdf") {
      // Server-side export: high-fidelity print-ready vector PDF view
      const formatCurrency = (n: number) =>
        "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accounts Receivable Ageing Report - ${dateSlug}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #111; font-size: 11px; }
    .report-box { max-width: 960px; margin: auto; }
    .header { border-bottom: 2px solid #0052cc; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 800; color: #0052cc; }
    .subtitle { font-size: 10px; color: #555; margin-top: 2px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
    .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
    .kpi-value { font-size: 13px; font-weight: 800; color: #0f172a; }
    .critical { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #0f172a; color: white; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals-row { background: #f1f5f9; font-weight: 800; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 960px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: #e0f2fe; padding: 10px 16px; border-radius: 8px;">
    <span style="color: #0369a1; font-size: 12px; font-weight: 600;">
      ⚡ Accounts Receivable Ageing Report (Print Preview)
    </span>
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-weight: 600; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <div class="report-box">
    <div class="header">
      <div>
        <div class="title">ACCOUNTS RECEIVABLE AGEING REPORT</div>
        <div class="subtitle">Generated for ${businessInfo.name} (GSTIN: ${businessInfo.gstin})</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: 700; font-size: 12px;">As of Date: ${reportData.as_of_date}</div>
        <div style="font-size: 9px; color: #666;">Generated: ${new Date().toLocaleString("en-IN")}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Receivables</div>
        <div class="kpi-value">${formatCurrency(reportData.total_receivables)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">0 - 30 Days</div>
        <div class="kpi-value">${formatCurrency(reportData.total_0_30)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">31 - 60 Days</div>
        <div class="kpi-value">${formatCurrency(reportData.total_31_60)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">61 - 90 Days</div>
        <div class="kpi-value">${formatCurrency(reportData.total_61_90)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">90+ Days (Critical)</div>
        <div class="kpi-value critical">${formatCurrency(reportData.total_90_plus)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 25px;">#</th>
          <th>Customer Name</th>
          <th>GSTIN</th>
          <th class="text-right">0-30 Days</th>
          <th class="text-right">31-60 Days</th>
          <th class="text-right">61-90 Days</th>
          <th class="text-right">90+ Days</th>
          <th class="text-right">Total Outstanding</th>
          <th class="text-center">Open Invs</th>
        </tr>
      </thead>
      <tbody>
        ${reportData.customers
          .map(
            (c, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${c.customer_name}</strong></td>
            <td style="font-family: monospace;">${c.customer_gstin || "Unregistered"}</td>
            <td class="text-right">${formatCurrency(c.bucket_0_30)}</td>
            <td class="text-right">${formatCurrency(c.bucket_31_60)}</td>
            <td class="text-right">${formatCurrency(c.bucket_61_90)}</td>
            <td class="text-right ${c.bucket_90_plus > 0 ? "critical" : ""}">${formatCurrency(c.bucket_90_plus)}</td>
            <td class="text-right" style="font-weight: 700; color: #0052cc;">${formatCurrency(c.total_outstanding)}</td>
            <td class="text-center">${c.invoice_count}</td>
          </tr>
        `
          )
          .join("")}
        <tr class="totals-row">
          <td colspan="3">GRAND TOTALS</td>
          <td class="text-right">${formatCurrency(reportData.total_0_30)}</td>
          <td class="text-right">${formatCurrency(reportData.total_31_60)}</td>
          <td class="text-right">${formatCurrency(reportData.total_61_90)}</td>
          <td class="text-right critical">${formatCurrency(reportData.total_90_plus)}</td>
          <td class="text-right" style="color: #0052cc;">${formatCurrency(reportData.total_receivables)}</td>
          <td class="text-center">${reportData.total_open_invoices}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div>GST Ledger • Compliance & Ageing Analysis Engine</div>
      <div>Confidential • Internal Financial Records</div>
    </div>
  </div>
</body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // ------------------------------------------------------------------------
    // 2. XLSX EXPORT (Default)
    // ------------------------------------------------------------------------
    const xlsxBuffer = await generateAgeingExcelWorkbook(reportData, businessInfo);
    const filename = `Ageing_Report_${dateSlug}.xlsx`;

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while exporting the Ageing Report.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
