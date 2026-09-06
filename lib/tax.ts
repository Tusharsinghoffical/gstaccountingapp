/**
 * Deterministic GST Calculation Engine for Indian Invoicing.
 *
 * Tax Rules:
 * - Intra-State (Business State == Counterparty State): CGST (rate / 2) + SGST (rate / 2), IGST = 0
 * - Inter-State (Business State != Counterparty State): IGST (rate), CGST = 0, SGST = 0
 *
 * Important: Tax math is always calculated server-side on save to prevent client manipulation.
 */

export interface LineItemInput {
  description: string;
  hsn_code: string;
  qty: number;
  rate: number;
  discount?: number;
  gst_rate: number;
}

export interface CalculatedLineItem extends LineItemInput {
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  amount: number;
}

export interface CalculatedInvoiceSummary {
  isIntraState: boolean;
  business_state_code: string;
  party_state_code: string;
  items: CalculatedLineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

// Round to 2 decimal places (Indian currency standard)
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Deterministically computes line items and invoice tax totals.
 */
export function calculateInvoiceTaxes(
  business_state_code: string,
  party_state_code: string,
  items: LineItemInput[]
): CalculatedInvoiceSummary {
  const isIntraState =
    business_state_code.trim() === party_state_code.trim();

  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    const qty = Math.max(0, item.qty || 0);
    const rate = Math.max(0, item.rate || 0);
    const discount = Math.max(0, item.discount || 0);

    const grossAmount = round2(qty * rate);
    const taxable_amount = Math.max(0, round2(grossAmount - discount));
    const gst_rate = Math.max(0, item.gst_rate || 0);

    let cgst_amount = 0;
    let sgst_amount = 0;
    let igst_amount = 0;

    if (isIntraState) {
      const halfRate = gst_rate / 2;
      cgst_amount = round2(taxable_amount * (halfRate / 100));
      sgst_amount = round2(taxable_amount * (halfRate / 100));
      igst_amount = 0;
    } else {
      cgst_amount = 0;
      sgst_amount = 0;
      igst_amount = round2(taxable_amount * (gst_rate / 100));
    }

    const itemTotal = round2(
      taxable_amount + cgst_amount + sgst_amount + igst_amount
    );

    subtotal = round2(subtotal + taxable_amount);
    totalCgst = round2(totalCgst + cgst_amount);
    totalSgst = round2(totalSgst + sgst_amount);
    totalIgst = round2(totalIgst + igst_amount);

    return {
      ...item,
      qty,
      rate,
      discount,
      taxable_amount,
      cgst_amount,
      sgst_amount,
      igst_amount,
      amount: itemTotal,
    };
  });

  const grandTotal = round2(subtotal + totalCgst + totalSgst + totalIgst);

  return {
    isIntraState,
    business_state_code,
    party_state_code,
    items: calculatedItems,
    subtotal,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    total: grandTotal,
  };
}
