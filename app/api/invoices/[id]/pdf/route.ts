import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { assertBusinessMembership } from "@/lib/auth/authorize";
import { getInvoiceById } from "@/lib/data/invoices";
import { getCustomerById } from "@/lib/data/customers";
import { getSupplierById } from "@/lib/data/suppliers";
import { numberToWordsINR } from "@/lib/numberToWordsINR";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const { searchParams } = new URL(request.url);
  const requestedBusinessId = searchParams.get("businessId") || session?.user?.businesses?.[0]?.businessId;

  if (!requestedBusinessId) {
    return NextResponse.json({ error: "Missing business context" }, { status: 400 });
  }

  let invoice;
  try {
    invoice = await getInvoiceById(session, requestedBusinessId, id);
  } catch {
    return NextResponse.json({ error: "Forbidden or Invoice not found" }, { status: 403 });
  }

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Enforce tenant boundary
  try {
    await assertBusinessMembership(userId, invoice.businessId);
  } catch {
    return NextResponse.json({ error: "Forbidden: Access denied to this business" }, { status: 403 });
  }

  const biz = invoice.business;
  const businessInfo = {
    name: biz?.name || "Business Enterprise",
    legal_name: biz?.legalName || biz?.name || "Business Enterprise",
    gstin: biz?.gstin || "N/A",
    state_code: biz?.stateCode || "27",
    address: biz?.address || "Registered Business Address",
    email: biz?.email || "",
    phone: biz?.phone || "",
  };

  // Fetch counterparty details
  let partyName = "Counterparty";
  let partyGstin = "";
  let partyStateCode = "27";
  let partyAddress = "Counterparty Address";

  if (invoice.type === "sales") {
    const cust = await getCustomerById(session, invoice.businessId, invoice.customerOrSupplierId);
    if (cust) {
      partyName = cust.name;
      partyGstin = cust.gstin || "Unregistered Buyer";
      partyStateCode = cust.stateCode;
      partyAddress = cust.billingAddress || "Counterparty Address";
    }
  } else {
    const supp = await getSupplierById(session, invoice.businessId, invoice.customerOrSupplierId);
    if (supp) {
      partyName = supp.name;
      partyGstin = supp.gstin || "";
      partyStateCode = supp.stateCode;
      partyAddress = supp.billingAddress || "Counterparty Address";
    }
  }

  const totalNumber = Number(invoice.total);
  const subtotalNumber = Number(invoice.subtotal);
  const cgstNumber = Number(invoice.cgst);
  const sgstNumber = Number(invoice.sgst);
  const igstNumber = Number(invoice.igst);

  const isInterState = igstNumber > 0;
  const amountWords = numberToWordsINR(totalNumber);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoiceNo}</title>
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
      📄 GST Rule 46 Compliant Invoice (Print / Vector PDF Mode)
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
        <h3>${invoice.invoiceNo}</h3>
        <div class="meta-date">Date: ${invoice.invoiceDate}</div>
        <div class="meta-date">FY: ${invoice.financialYear}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <div class="party-title">Supplier / Seller</div>
        <div class="party-name">${businessInfo.name}</div>
        <div>GSTIN: <strong>${businessInfo.gstin}</strong></div>
        <div>State Code: ${businessInfo.state_code}</div>
        <div>${businessInfo.address}</div>
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
            (item, idx: number) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${item.description}</strong></td>
            <td class="text-center font-mono">${item.hsnCode}</td>
            <td class="text-right">${Number(item.qty).toFixed(3)}</td>
            <td class="text-right">${Number(item.rate).toFixed(2)}</td>
            <td class="text-right">${Number(item.discount || 0).toFixed(2)}</td>
            <td class="text-right"><strong>${Number(item.taxableAmount).toFixed(2)}</strong></td>
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
          .map((item) => {
            const itemCgst = Number(item.cgstAmount || 0);
            const itemSgst = Number(item.sgstAmount || 0);
            const itemIgst = Number(item.igstAmount || 0);
            const itemTaxable = Number(item.taxableAmount || 0);
            const itemGstRate = Number(item.gstRate || 0);
            const tax = itemCgst + itemSgst + itemIgst;
            return `
          <tr>
            <td>${item.hsnCode}</td>
            <td class="text-right">${itemTaxable.toFixed(2)}</td>
            <td class="text-right">${isInterState ? itemGstRate + "%" : itemGstRate / 2 + "%"}</td>
            <td class="text-right">${isInterState ? itemIgst.toFixed(2) : itemCgst.toFixed(2)}</td>
            <td class="text-right">${isInterState ? "-" : itemGstRate / 2 + "%"}</td>
            <td class="text-right">${isInterState ? "-" : itemSgst.toFixed(2)}</td>
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
          <span>₹${subtotalNumber.toFixed(2)}</span>
        </div>
        ${
          isInterState
            ? `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>IGST Total:</span>
                 <span>₹${igstNumber.toFixed(2)}</span>
               </div>`
            : `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>CGST Total:</span>
                 <span>₹${cgstNumber.toFixed(2)}</span>
               </div>
               <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>SGST Total:</span>
                 <span>₹${sgstNumber.toFixed(2)}</span>
               </div>`
        }
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 2px solid #111; font-weight: 700; font-size: 13px; color: #0052cc;">
          <span>Grand Total:</span>
          <span>₹${totalNumber.toFixed(2)}</span>
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
        <div style="font-weight: 700; font-size: 11px;">For ${businessInfo.name}</div>
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
