import { NextRequest, NextResponse } from "next/server";
import { getInvoiceById } from "@/app/actions/invoices";
import { getCustomerById, getSupplierById } from "@/app/actions/parties";
import { numberToWordsINR } from "@/lib/numberToWordsINR";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const invoice = await getInvoiceById(id);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch counterparty details
  let partyName = invoice.party_name;
  let partyGstin = "";
  let partyStateCode = "27";
  let partyAddress = "Mumbai, Maharashtra";

  if (invoice.type === "sales") {
    const cust = await getCustomerById(invoice.customer_or_supplier_id);
    if (cust) {
      partyName = cust.name;
      partyGstin = cust.gstin || "Unregistered Buyer";
      partyStateCode = cust.state_code;
      partyAddress = cust.billing_address || "Mumbai, Maharashtra";
    }
  } else {
    const supp = await getSupplierById(invoice.customer_or_supplier_id);
    if (supp) {
      partyName = supp.name;
      partyGstin = supp.gstin || "";
      partyStateCode = supp.state_code;
      partyAddress = supp.billing_address || "Mumbai, Maharashtra";
    }
  }

  const payload = {
    invoice: {
      ...invoice,
      amount_in_words: numberToWordsINR(invoice.total),
    },
    business: {
      name: "GST Ledger Enterprises Pvt Ltd",
      legal_name: "GST Ledger Enterprises Private Limited",
      gstin: "27AAPFU0939F1ZV",
      state_code: "27",
      address: "101, Maker Chambers V, Nariman Point, Mumbai, Maharashtra 400021",
      email: "billing@gstledger.in",
      phone: "+91 22 2288 0000",
    },
    counterparty: {
      name: partyName,
      gstin: partyGstin,
      state_code: partyStateCode,
      address: partyAddress,
    },
    items: invoice.items,
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. If Supabase Edge Function is configured, call the Edge Function
  if (supabaseUrl && supabaseKey) {
    try {
      const edgeUrl = `${supabaseUrl}/functions/v1/generate-invoice-pdf`;
      const edgeRes = await fetch(edgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (edgeRes.ok) {
        const pdfArrayBuffer = await edgeRes.arrayBuffer();
        const cleanFilename = `Invoice-${(invoice.invoice_no || id).replace(/\//g, "-")}.pdf`;

        return new NextResponse(pdfArrayBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${cleanFilename}"`,
          },
        });
      }
    } catch {
      // Fall through to dev print view
    }
  }

  // 2. Development fallback: GST Rule 46 compliant print-ready HTML view
  // Provides instant high-definition vector print/save-as-pdf in local dev
  const isInterState = (invoice.igst || 0) > 0;
  const amountWords = numberToWordsINR(invoice.total);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoice_no}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #111; font-size: 12px; }
    .invoice-box { max-width: 800px; margin: auto; border: 1px solid #ddd; padding: 24px; border-radius: 8px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0052cc; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 800; color: #0052cc; }
    .subtitle { font-size: 10px; color: #666; margin-top: 2px; }
    .inv-meta { text-align: right; }
    .inv-meta h3 { margin: 0; font-size: 14px; font-weight: 700; }
    .meta-date { font-size: 11px; color: #555; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
    .party-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .party-title { font-size: 10px; font-weight: 700; color: #0052cc; text-transform: uppercase; margin-bottom: 4px; }
    .party-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-size: 10px; font-weight: 700; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .words-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; font-weight: 600; color: #166534; margin-bottom: 16px; font-size: 11px; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd; }
    .signatory { text-align: right; }
    .sign-line { margin-top: 40px; border-top: 1px solid #333; width: 160px; display: inline-block; }
    @media print {
      body { padding: 0; }
      .invoice-box { border: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: #e0f2fe; padding: 10px 16px; border-radius: 8px;">
    <span style="color: #0369a1; font-size: 12px; font-weight: 600;">
      ⚡ Supabase Edge Function PDF Template (Preview Mode)
    </span>
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <div class="invoice-box">
    <div class="header">
      <div>
        <div class="title">${invoice.type === "credit_note" ? "CREDIT NOTE" : invoice.type === "debit_note" ? "DEBIT NOTE" : "TAX INVOICE"}</div>
        <div class="subtitle">(Issued under Section 31 of CGST Act & Rule 46 of CGST Rules)</div>
      </div>
      <div class="inv-meta">
        <h3>${invoice.invoice_no}</h3>
        <div class="meta-date">Date: ${invoice.invoice_date}</div>
        <div class="meta-date">FY: ${invoice.financial_year}</div>
        ${invoice.original_invoice_id ? `<div class="meta-date" style="color: #0052cc; font-weight: 600;">Ref Invoice: ${invoice.original_invoice_id}</div>` : ""}
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <div class="party-title">Supplier / Seller</div>
        <div class="party-name">GST Ledger Enterprises Pvt Ltd</div>
        <div>GSTIN: <strong>27AAPFU0939F1ZV</strong></div>
        <div>State: Maharashtra (Code: 27)</div>
        <div>101, Maker Chambers V, Nariman Point, Mumbai 400021</div>
      </div>
      <div class="party-box">
        <div class="party-title">Billed To / Recipient</div>
        <div class="party-name">${partyName}</div>
        <div>GSTIN: <strong>${partyGstin || "Unregistered Buyer"}</strong></div>
        <div>State: Code ${partyStateCode}</div>
        <div>Place of Supply: State Code ${partyStateCode}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 25px;">#</th>
          <th>Description of Goods / Services</th>
          <th class="text-center">HSN/SAC</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate (₹)</th>
          <th class="text-right">Discount</th>
          <th class="text-right">Taxable Val (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items
          .map(
            (item: any, idx: number) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${item.description}</strong></td>
            <td class="text-center font-mono">${item.hsn_code}</td>
            <td class="text-right">${item.qty}</td>
            <td class="text-right">${item.rate.toFixed(2)}</td>
            <td class="text-right">${(item.discount || 0).toFixed(2)}</td>
            <td class="text-right"><strong>${item.taxable_amount.toFixed(2)}</strong></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #0052cc;">
      GST TAX BREAKUP SCHEDULE (HSN-WISE)
    </div>
    <table>
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th class="text-right">Taxable Val</th>
          <th class="text-right">${isInterState ? "IGST Rate" : "CGST Rate"}</th>
          <th class="text-right">${isInterState ? "IGST Amt" : "CGST Amt"}</th>
          <th class="text-right">${isInterState ? "-" : "SGST Rate"}</th>
          <th class="text-right">${isInterState ? "-" : "SGST Amt"}</th>
          <th class="text-right">Total Tax (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items
          .map((item: any) => {
            const tax = (item.cgst_amount || 0) + (item.sgst_amount || 0) + (item.igst_amount || 0);
            return `
          <tr>
            <td>${item.hsn_code}</td>
            <td class="text-right">${item.taxable_amount.toFixed(2)}</td>
            <td class="text-right">${isInterState ? item.gst_rate + "%" : item.gst_rate / 2 + "%"}</td>
            <td class="text-right">${isInterState ? item.igst_amount.toFixed(2) : item.cgst_amount.toFixed(2)}</td>
            <td class="text-right">${isInterState ? "-" : item.gst_rate / 2 + "%"}</td>
            <td class="text-right">${isInterState ? "-" : item.sgst_amount.toFixed(2)}</td>
            <td class="text-right"><strong>${tax.toFixed(2)}</strong></td>
          </tr>
        `;
          })
          .join("")}
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
      <div style="width: 250px;">
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Total Taxable Value:</span>
          <span>₹${invoice.subtotal.toFixed(2)}</span>
        </div>
        ${
          isInterState
            ? `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>IGST Total:</span>
                 <span>₹${invoice.igst.toFixed(2)}</span>
               </div>`
            : `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>CGST Total:</span>
                 <span>₹${invoice.cgst.toFixed(2)}</span>
               </div>
               <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>SGST Total:</span>
                 <span>₹${invoice.sgst.toFixed(2)}</span>
               </div>`
        }
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 2px solid #111; font-weight: 700; font-size: 13px; color: #0052cc;">
          <span>Grand Total:</span>
          <span>₹${invoice.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="words-box">
      Amount Chargeable (in words): ${amountWords}
    </div>

    <div class="footer">
      <div style="font-size: 9px; color: #666; max-width: 400px;">
        <strong>Declaration:</strong><br>
        We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
      </div>
      <div class="signatory">
        <div style="font-weight: 700; font-size: 11px;">For GST Ledger Enterprises Pvt Ltd</div>
        <div class="sign-line"></div>
        <div style="font-size: 10px; color: #555;">Authorised Signatory</div>
      </div>
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

