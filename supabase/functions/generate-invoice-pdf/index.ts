// ==============================================================================
// Supabase Edge Function: Generate GST-Compliant Invoice PDF
// Reference: 05-BUILD-PROMPTS.md (Prompt 13)
// Specification: GST Rule 46 compliant layout with HSN-wise item table,
// tax breakup table, and amount in words in INR.
// Runtime: Deno / Supabase Edge Functions (Zero client-side bundle bloat)
// ==============================================================================

// @ts-ignore - Deno imports from esm.sh
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.9";

// CORS Headers for browser invocations
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// State code to state name map (Rule 46 compliance)
const STATE_NAMES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "19": "West Bengal",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};

// ------------------------------------------------------------------------------
// INR Number-to-Words Algorithm (Self-contained for Deno Edge Function)
// ------------------------------------------------------------------------------
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function convertTwoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one > 0 ? "-" + ONES[one] : "");
}

function convertThreeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let str = "";
  if (hundred > 0) str += ONES[hundred] + " Hundred";
  if (rest > 0) {
    if (str !== "") str += " ";
    str += convertTwoDigits(rest);
  }
  return str;
}

function convertIntegerINR(num: number): string {
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertIntegerINR(crore) + " Crore");
  if (lakh > 0) parts.push(convertTwoDigits(lakh) + " Lakh");
  if (thousand > 0) parts.push(convertTwoDigits(thousand) + " Thousand");
  if (remainder > 0) parts.push(convertThreeDigits(remainder));

  return parts.join(" ");
}

function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return "Zero";
  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let result = "Rupees " + convertIntegerINR(rupees);
  if (paise > 0) result += " and " + convertTwoDigits(paise) + " Paise";
  result += " Only";
  return amount < 0 ? "Minus " + result : result;
}

function formatINRNumber(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

// ------------------------------------------------------------------------------
// Core PDF Generator (Pure Vector pdf-lib)
// ------------------------------------------------------------------------------
export async function generateInvoicePdfBuffer(payload: any): Promise<Uint8Array> {
  const { invoice, business, counterparty, items } = payload;

  const doc = await PDFDocument.create();
  // Standard A4: 595.28 x 841.89 points
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 36;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Colors
  const dark = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.4, 0.4, 0.4);
  const lineGray = rgb(0.85, 0.85, 0.85);
  const tableHeaderBg = rgb(0.94, 0.96, 0.98); // Light brand tint
  const brandBlue = rgb(0.08, 0.35, 0.72);

  // 1. Watermark if DRAFT
  if (invoice.status === "draft") {
    page.drawText("DRAFT - NOT A TAX INVOICE", {
      x: 100,
      y: 400,
      size: 32,
      font: fontBold,
      color: rgb(0.9, 0.9, 0.9),
      rotate: { type: "degrees", angle: 45 },
    });
  }

  // 2. Header Banner
  const invoiceTypeTitle =
    invoice.type === "credit_note"
      ? "CREDIT NOTE"
      : invoice.type === "debit_note"
      ? "DEBIT NOTE"
      : "TAX INVOICE";

  page.drawText(invoiceTypeTitle, {
    x: margin,
    y: y,
    size: 16,
    font: fontBold,
    color: brandBlue,
  });

  page.drawText("(Issued under Section 31 of CGST Act & Rule 46 of CGST Rules)", {
    x: margin,
    y: y - 12,
    size: 7.5,
    font: fontRegular,
    color: muted,
  });

  const invoiceNoText = `Invoice No: ${invoice.invoice_no}`;
  page.drawText(invoiceNoText, {
    x: width - margin - fontBold.widthOfTextAtSize(invoiceNoText, 11),
    y: y,
    size: 11,
    font: fontBold,
    color: dark,
  });

  const dateText = `Date: ${invoice.invoice_date}`;
  page.drawText(dateText, {
    x: width - margin - fontRegular.widthOfTextAtSize(dateText, 9),
    y: y - 13,
    size: 9,
    font: fontRegular,
    color: dark,
  });

  y -= 26;

  // Horizontal divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: brandBlue,
  });

  y -= 14;

  // 3. Supplier & Customer Details (2 Columns)
  const colWidth = (contentWidth - 16) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 16;
  const boxTop = y;

  // Supplier details
  page.drawText("SUPPLIER / SELLER", {
    x: col1X,
    y: boxTop,
    size: 8,
    font: fontBold,
    color: brandBlue,
  });
  page.drawText(business.name || "My Business Pvt Ltd", {
    x: col1X,
    y: boxTop - 12,
    size: 10,
    font: fontBold,
    color: dark,
  });
  page.drawText(`GSTIN: ${business.gstin || "27AAPFU0939F1ZV"}`, {
    x: col1X,
    y: boxTop - 23,
    size: 8.5,
    font: fontBold,
    color: dark,
  });
  const supplierState = STATE_NAMES[business.state_code || "27"] || "Maharashtra";
  page.drawText(`State: ${supplierState} (Code: ${business.state_code || "27"})`, {
    x: col1X,
    y: boxTop - 33,
    size: 8,
    font: fontRegular,
    color: muted,
  });
  page.drawText(business.address || "Nariman Point, Mumbai, Maharashtra 400021", {
    x: col1X,
    y: boxTop - 43,
    size: 8,
    font: fontRegular,
    color: muted,
  });

  // Buyer / Recipient details
  page.drawText("BILLED TO / RECIPIENT", {
    x: col2X,
    y: boxTop,
    size: 8,
    font: fontBold,
    color: brandBlue,
  });
  page.drawText(counterparty.name || "Customer Name", {
    x: col2X,
    y: boxTop - 12,
    size: 10,
    font: fontBold,
    color: dark,
  });
  page.drawText(`GSTIN: ${counterparty.gstin || "Unregistered Buyer"}`, {
    x: col2X,
    y: boxTop - 23,
    size: 8.5,
    font: fontBold,
    color: dark,
  });
  const buyerState = STATE_NAMES[counterparty.state_code || "27"] || "Maharashtra";
  page.drawText(`State: ${buyerState} (Code: ${counterparty.state_code || "27"})`, {
    x: col2X,
    y: boxTop - 33,
    size: 8,
    font: fontRegular,
    color: muted,
  });
  page.drawText(`Place of Supply: ${buyerState} (${counterparty.state_code || "27"})`, {
    x: col2X,
    y: boxTop - 43,
    size: 8,
    font: fontRegular,
    color: muted,
  });

  if (invoice.original_invoice_id) {
    page.drawText(`Ref Original Invoice: ${invoice.original_invoice_id}`, {
      x: col2X,
      y: boxTop - 53,
      size: 7.5,
      font: fontBold,
      color: brandBlue,
    });
  }

  y = boxTop - 64;

  // 4. Line Items Table (Rule 46: HSN-wise itemization)
  const itemTableCols = [
    { label: "#", width: 22, align: "center" },
    { label: "Description of Goods / Services", width: 210, align: "left" },
    { label: "HSN/SAC", width: 55, align: "center" },
    { label: "Qty", width: 35, align: "right" },
    { label: "Rate (₹)", width: 65, align: "right" },
    { label: "Discount", width: 50, align: "right" },
    { label: "Taxable Val (₹)", width: 86.28, align: "right" },
  ];

  // Draw table header
  page.drawRectangle({
    x: margin,
    y: y - 14,
    width: contentWidth,
    height: 18,
    color: tableHeaderBg,
  });

  let curX = margin;
  for (const col of itemTableCols) {
    page.drawText(col.label, {
      x: col.align === "center" ? curX + col.width / 4 : curX + 4,
      y: y - 10,
      size: 7.5,
      font: fontBold,
      color: dark,
    });
    curX += col.width;
  }

  y -= 16;

  // Draw line items
  let lineIdx = 1;
  for (const itm of items) {
    const rowY = y - 10;

    // Alternate background
    if (lineIdx % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 14,
        width: contentWidth,
        height: 16,
        color: rgb(0.98, 0.98, 0.99),
      });
    }

    let xPos = margin;
    // S.No
    page.drawText(String(lineIdx), { x: xPos + 8, y: rowY, size: 8, font: fontRegular, color: dark });
    xPos += itemTableCols[0].width;

    // Description (truncate if too long)
    const desc = itm.description.length > 42 ? itm.description.substring(0, 39) + "..." : itm.description;
    page.drawText(desc, { x: xPos + 4, y: rowY, size: 8, font: fontRegular, color: dark });
    xPos += itemTableCols[1].width;

    // HSN
    page.drawText(itm.hsn_code || "-", { x: xPos + 10, y: rowY, size: 8, font: fontRegular, color: dark });
    xPos += itemTableCols[2].width;

    // Qty
    page.drawText(String(itm.qty), { x: xPos + 15, y: rowY, size: 8, font: fontRegular, color: dark });
    xPos += itemTableCols[3].width;

    // Rate
    page.drawText(formatINRNumber(itm.rate), { x: xPos + 15, y: rowY, size: 8, font: fontRegular, color: dark });
    xPos += itemTableCols[4].width;

    // Discount
    page.drawText(formatINRNumber(itm.discount || 0), { x: xPos + 10, y: rowY, size: 8, font: fontRegular, color: dark });
    xPos += itemTableCols[5].width;

    // Taxable Amount
    const taxableText = formatINRNumber(itm.taxable_amount || itm.rate * itm.qty);
    page.drawText(taxableText, { x: xPos + 15, y: rowY, size: 8, font: fontBold, color: dark });

    y -= 16;
    lineIdx++;
  }

  // Item table bottom line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: lineGray,
  });

  y -= 14;

  // 5. Tax Breakup Table (Rule 46 Requirement)
  page.drawText("GST TAX BREAKUP SCHEDULE", {
    x: margin,
    y: y,
    size: 8,
    font: fontBold,
    color: brandBlue,
  });

  y -= 14;

  const isInterState = (invoice.igst || 0) > 0;
  const taxHeaderHeight = 16;

  page.drawRectangle({
    x: margin,
    y: y - 12,
    width: contentWidth,
    height: taxHeaderHeight,
    color: tableHeaderBg,
  });

  const taxCols = [
    { label: "HSN/SAC", width: 70 },
    { label: "Taxable Val (₹)", width: 95 },
    { label: isInterState ? "IGST Rate" : "CGST Rate", width: 65 },
    { label: isInterState ? "IGST Amt (₹)" : "CGST Amt (₹)", width: 85 },
    { label: isInterState ? "-" : "SGST Rate", width: 65 },
    { label: isInterState ? "-" : "SGST Amt (₹)", width: 85 },
    { label: "Total Tax (₹)", width: 58.28 },
  ];

  let taxX = margin;
  for (const c of taxCols) {
    page.drawText(c.label, {
      x: taxX + 4,
      y: y - 8,
      size: 7,
      font: fontBold,
      color: dark,
    });
    taxX += c.width;
  }

  y -= 16;

  // Aggregate by HSN
  const hsnMap = new Map<string, any>();
  for (const itm of items) {
    const existing = hsnMap.get(itm.hsn_code) || {
      hsn: itm.hsn_code,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gst_rate: itm.gst_rate || 18,
    };
    existing.taxable += itm.taxable_amount || 0;
    existing.cgst += itm.cgst_amount || 0;
    existing.sgst += itm.sgst_amount || 0;
    existing.igst += itm.igst_amount || 0;
    hsnMap.set(itm.hsn_code, existing);
  }

  for (const entry of Array.from(hsnMap.values())) {
    const rowY = y - 8;
    let x = margin;

    page.drawText(entry.hsn, { x: x + 4, y: rowY, size: 7.5, font: fontRegular, color: dark });
    x += taxCols[0].width;

    page.drawText(formatINRNumber(entry.taxable), { x: x + 4, y: rowY, size: 7.5, font: fontRegular, color: dark });
    x += taxCols[1].width;

    const rate1 = isInterState ? `${entry.gst_rate}%` : `${entry.gst_rate / 2}%`;
    const amt1 = isInterState ? entry.igst : entry.cgst;
    page.drawText(rate1, { x: x + 8, y: rowY, size: 7.5, font: fontRegular, color: dark });
    x += taxCols[2].width;
    page.drawText(formatINRNumber(amt1), { x: x + 8, y: rowY, size: 7.5, font: fontRegular, color: dark });
    x += taxCols[3].width;

    const rate2 = isInterState ? "-" : `${entry.gst_rate / 2}%`;
    const amt2 = isInterState ? 0 : entry.sgst;
    page.drawText(rate2, { x: x + 8, y: rowY, size: 7.5, font: fontRegular, color: dark });
    x += taxCols[4].width;
    page.drawText(isInterState ? "-" : formatINRNumber(amt2), { x: x + 8, y: rowY, size: 7.5, font: fontRegular, color: dark });
    x += taxCols[5].width;

    const totalTaxForHsn = (entry.cgst || 0) + (entry.sgst || 0) + (entry.igst || 0);
    page.drawText(formatINRNumber(totalTaxForHsn), { x: x + 4, y: rowY, size: 7.5, font: fontBold, color: dark });

    y -= 14;
  }

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: lineGray,
  });

  y -= 16;

  // 6. Summary Totals Box (Right Aligned)
  const summaryBoxWidth = 200;
  const summaryX = width - margin - summaryBoxWidth;

  const totalTax = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);

  const summaryRows = [
    { label: "Total Taxable Value:", val: formatINRNumber(invoice.subtotal) },
    ...(isInterState
      ? [{ label: "Integrated GST (IGST):", val: formatINRNumber(invoice.igst) }]
      : [
          { label: "Central GST (CGST):", val: formatINRNumber(invoice.cgst) },
          { label: "State GST (SGST):", val: formatINRNumber(invoice.sgst) },
        ]),
    { label: "Total Tax Amount:", val: formatINRNumber(totalTax) },
    { label: "Total Invoice Value (₹):", val: formatINRNumber(invoice.total), bold: true },
  ];

  for (const row of summaryRows) {
    page.drawText(row.label, {
      x: summaryX,
      y,
      size: row.bold ? 9 : 8,
      font: row.bold ? fontBold : fontRegular,
      color: dark,
    });
    const valText = row.val;
    const valWidth = (row.bold ? fontBold : fontRegular).widthOfTextAtSize(valText, row.bold ? 9 : 8);
    page.drawText(valText, {
      x: width - margin - valWidth,
      y,
      size: row.bold ? 9 : 8,
      font: row.bold ? fontBold : fontRegular,
      color: row.bold ? brandBlue : dark,
    });
    y -= 13;
  }

  y -= 6;

  // 7. Amount in Words Box
  page.drawRectangle({
    x: margin,
    y: y - 16,
    width: contentWidth,
    height: 22,
    color: rgb(0.97, 0.98, 0.99),
    borderWidth: 0.5,
    borderColor: lineGray,
  });

  const words = numberToWordsINR(invoice.total);
  page.drawText(`Amount in Words: ${words}`, {
    x: margin + 8,
    y: y - 10,
    size: 8.5,
    font: fontBold,
    color: brandBlue,
  });

  y -= 36;

  // 8. Terms, Declaration & Signatory Box
  const footerY = 50; // Fixed near bottom
  page.drawLine({
    start: { x: margin, y: footerY + 55 },
    end: { x: width - margin, y: footerY + 55 },
    thickness: 0.5,
    color: lineGray,
  });

  // Terms & Conditions
  page.drawText("Terms & Conditions & Declaration:", {
    x: margin,
    y: footerY + 44,
    size: 7,
    font: fontBold,
    color: dark,
  });
  page.drawText(
    "1. We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.\n2. Interest @ 18% p.a. will be charged if payment is not made within the due date.",
    {
      x: margin,
      y: footerY + 34,
      size: 6.5,
      font: fontRegular,
      color: muted,
      lineHeight: 8,
    }
  );

  // Authorized Signatory
  const signatoryX = width - margin - 150;
  page.drawText(`For ${business.name || "Business Name"}`, {
    x: signatoryX,
    y: footerY + 44,
    size: 8,
    font: fontBold,
    color: dark,
  });
  page.drawText("Authorised Signatory", {
    x: signatoryX,
    y: footerY + 12,
    size: 7.5,
    font: fontRegular,
    color: muted,
  });

  return await doc.save();
}

// ------------------------------------------------------------------------------
// HTTP Request Handler
// ------------------------------------------------------------------------------
// @ts-ignore - Deno global
if (typeof Deno !== "undefined") {
  // @ts-ignore
  Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      if (!body || !body.invoice) {
        return new Response(JSON.stringify({ error: "Missing invoice payload." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfBytes = await generateInvoicePdfBuffer(body);

      const filename = `Invoice-${(body.invoice.invoice_no || "draft").replace(/\//g, "-")}.pdf`;

      return new Response(pdfBytes as any, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message || "Failed to generate invoice PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  });
}
