import { STATE_CODE_MAP } from "../constants/states.ts";
import type { Invoice, InvoiceItem } from "../../types/index.ts";

export interface Gstr1PeriodFilter {
  financialYear: string; // e.g. "2024-25"
  periodType: "month" | "quarter";
  month?: string; // "04" for April, "05" for May, etc.
  quarter?: "Q1" | "Q2" | "Q3" | "Q4";
}

export interface B2BInvoiceLine {
  invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  pos_state: string;
  reverse_charge: "N" | "Y";
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  invoice_value: number;
}

export interface B2BGstr1Group {
  customer_gstin: string;
  customer_name: string;
  pos_state: string;
  pos_state_name: string;
  invoice_count: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_invoice_value: number;
  invoices: B2BInvoiceLine[];
}

export interface B2CGstr1Summary {
  pos_state: string;
  pos_state_name: string;
  tax_rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_invoice_value: number;
  invoice_count: number;
}

export interface HsnGstr1Summary {
  hsn_code: string;
  description: string;
  uqc: string;
  total_quantity: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_value: number;
}

export interface Gstr1ReportData {
  financial_year: string;
  period_label: string;
  period_filter: Gstr1PeriodFilter;
  gross_turnover: number;
  total_taxable_value: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax_liability: number;
  total_b2b_value: number;
  total_b2c_value: number;
  total_b2b_taxable: number;
  total_b2c_taxable: number;
  b2b_groups: B2BGstr1Group[];
  b2c_summaries: B2CGstr1Summary[];
  hsn_summaries: HsnGstr1Summary[];
}

export type SalesInvoiceForReport = Invoice & {
  party_name?: string;
  party_gstin?: string | null;
  party_state_code?: string;
  items?: InvoiceItem[];
};

export const GSTR1_MONTHS = [
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
];

export const GSTR1_QUARTERS = [
  { value: "Q1", label: "Q1 (April - June)" },
  { value: "Q2", label: "Q2 (July - September)" },
  { value: "Q3", label: "Q3 (October - December)" },
  { value: "Q4", label: "Q4 (January - March)" },
];

/**
 * Checks if a specific invoice date falls within the GSTR-1 period filter.
 * Indian Financial Year runs April 1 to March 31.
 */
export function matchesGstr1Period(
  invoiceDate: string,
  filter: Gstr1PeriodFilter
): boolean {
  if (!invoiceDate) return false;

  const [fyStartYearStr] = filter.financialYear.split("-");
  const fyStartYear = parseInt(fyStartYearStr, 10);
  if (isNaN(fyStartYear)) return true;

  const invDate = new Date(invoiceDate);
  const year = invDate.getFullYear();
  const month = invDate.getMonth() + 1; // 1-12
  const monthPadded = String(month).padStart(2, "0");

  // Determine FY of the invoice
  const invFyStart = month >= 4 ? year : year - 1;
  if (invFyStart !== fyStartYear) {
    return false;
  }

  if (filter.periodType === "month") {
    if (!filter.month) return true;
    return monthPadded === filter.month;
  }

  if (filter.periodType === "quarter") {
    if (!filter.quarter) return true;
    switch (filter.quarter) {
      case "Q1": // Apr, May, Jun
        return month >= 4 && month <= 6;
      case "Q2": // Jul, Aug, Sep
        return month >= 7 && month <= 9;
      case "Q3": // Oct, Nov, Dec
        return month >= 10 && month <= 12;
      case "Q4": // Jan, Feb, Mar
        return month >= 1 && month <= 3;
      default:
        return true;
    }
  }

  return true;
}

/**
 * Computes the complete GSTR-1 report dataset from outward supplies (sales invoices).
 */
export function computeGstr1Report(
  invoices: SalesInvoiceForReport[],
  filter: Gstr1PeriodFilter
): Gstr1ReportData {
  // Filter for sales invoices within selected financial period
  const outwardInvoices = invoices.filter((inv) => {
    if (inv.type !== "sales") return false;
    if (inv.status === "cancelled") return false;
    return matchesGstr1Period(inv.invoice_date, filter);
  });

  // Period label
  let periodLabel = filter.financialYear;
  if (filter.periodType === "month" && filter.month) {
    const monthObj = GSTR1_MONTHS.find((m) => m.value === filter.month);
    periodLabel = `${monthObj?.label || filter.month} ${filter.financialYear}`;
  } else if (filter.periodType === "quarter" && filter.quarter) {
    const qObj = GSTR1_QUARTERS.find((q) => q.value === filter.quarter);
    periodLabel = `${qObj?.label || filter.quarter} ${filter.financialYear}`;
  }

  // --- 1. Table 4: B2B Invoices (Grouped by Customer GSTIN) ---
  const b2bMap = new Map<string, B2BGstr1Group>();

  // --- 2. Table 7: B2C Invoices (Grouped by State & Tax Rate) ---
  const b2cMap = new Map<string, B2CGstr1Summary>();

  // --- 3. Table 12: HSN Summary (Grouped by HSN Code) ---
  const hsnMap = new Map<string, HsnGstr1Summary>();

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let grossTurnover = 0;
  let totalB2bValue = 0;
  let totalB2cValue = 0;
  let totalB2bTaxable = 0;
  let totalB2cTaxable = 0;

  for (const inv of outwardInvoices) {
    const taxable = Number(inv.subtotal) || 0;
    const cgst = Number(inv.cgst) || 0;
    const sgst = Number(inv.sgst) || 0;
    const igst = Number(inv.igst) || 0;
    const totalTax = cgst + sgst + igst;
    const invoiceTotal = Number(inv.total) || taxable + totalTax;

    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    grossTurnover += invoiceTotal;

    const gstin = (inv.party_gstin || "").trim().toUpperCase();
    const isB2B = gstin.length === 15;
    const posState = inv.party_state_code || (gstin.length >= 2 ? gstin.substring(0, 2) : "27");
    const posStateName = STATE_CODE_MAP[posState] || `State ${posState}`;

    if (isB2B) {
      totalB2bValue += invoiceTotal;
      totalB2bTaxable += taxable;

      const invoiceLine: B2BInvoiceLine = {
        invoice_id: inv.id,
        invoice_no: inv.invoice_no,
        invoice_date: inv.invoice_date,
        pos_state: posState,
        reverse_charge: "N",
        taxable_value: taxable,
        cgst,
        sgst,
        igst,
        total_tax: totalTax,
        invoice_value: invoiceTotal,
      };

      if (!b2bMap.has(gstin)) {
        b2bMap.set(gstin, {
          customer_gstin: gstin,
          customer_name: inv.party_name || "Registered Customer",
          pos_state: posState,
          pos_state_name: posStateName,
          invoice_count: 0,
          taxable_value: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total_tax: 0,
          total_invoice_value: 0,
          invoices: [],
        });
      }

      const group = b2bMap.get(gstin)!;
      group.invoice_count += 1;
      group.taxable_value = Math.round((group.taxable_value + taxable) * 100) / 100;
      group.cgst = Math.round((group.cgst + cgst) * 100) / 100;
      group.sgst = Math.round((group.sgst + sgst) * 100) / 100;
      group.igst = Math.round((group.igst + igst) * 100) / 100;
      group.total_tax = Math.round((group.total_tax + totalTax) * 100) / 100;
      group.total_invoice_value =
        Math.round((group.total_invoice_value + invoiceTotal) * 100) / 100;
      group.invoices.push(invoiceLine);
    } else {
      // B2C Unregistered supply
      totalB2cValue += invoiceTotal;
      totalB2cTaxable += taxable;

      // Group line items by tax rate for B2C statutory summary
      const items = inv.items && inv.items.length > 0 ? inv.items : [];
      if (items.length > 0) {
        for (const item of items) {
          const rateSlab = Number(item.gst_rate) || 18;
          const key = `${posState}-${rateSlab}`;
          const itemTaxable = Number(item.taxable_amount) || Number(item.qty) * Number(item.rate);
          const itemCgst = Number(item.cgst_amount) || 0;
          const itemSgst = Number(item.sgst_amount) || 0;
          const itemIgst = Number(item.igst_amount) || 0;
          const itemTotalTax = itemCgst + itemSgst + itemIgst;
          const itemTotalVal = itemTaxable + itemTotalTax;

          if (!b2cMap.has(key)) {
            b2cMap.set(key, {
              pos_state: posState,
              pos_state_name: posStateName,
              tax_rate: rateSlab,
              taxable_value: 0,
              cgst: 0,
              sgst: 0,
              igst: 0,
              total_tax: 0,
              total_invoice_value: 0,
              invoice_count: 0,
            });
          }

          const b2cEntry = b2cMap.get(key)!;
          b2cEntry.invoice_count += 1;
          b2cEntry.taxable_value = Math.round((b2cEntry.taxable_value + itemTaxable) * 100) / 100;
          b2cEntry.cgst = Math.round((b2cEntry.cgst + itemCgst) * 100) / 100;
          b2cEntry.sgst = Math.round((b2cEntry.sgst + itemSgst) * 100) / 100;
          b2cEntry.igst = Math.round((b2cEntry.igst + itemIgst) * 100) / 100;
          b2cEntry.total_tax = Math.round((b2cEntry.total_tax + itemTotalTax) * 100) / 100;
          b2cEntry.total_invoice_value =
            Math.round((b2cEntry.total_invoice_value + itemTotalVal) * 100) / 100;
        }
      } else {
        // Fallback if line items not expanded
        const key = `${posState}-18`;
        if (!b2cMap.has(key)) {
          b2cMap.set(key, {
            pos_state: posState,
            pos_state_name: posStateName,
            tax_rate: 18,
            taxable_value: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total_tax: 0,
            total_invoice_value: 0,
            invoice_count: 0,
          });
        }
        const b2cEntry = b2cMap.get(key)!;
        b2cEntry.invoice_count += 1;
        b2cEntry.taxable_value = Math.round((b2cEntry.taxable_value + taxable) * 100) / 100;
        b2cEntry.cgst = Math.round((b2cEntry.cgst + cgst) * 100) / 100;
        b2cEntry.sgst = Math.round((b2cEntry.sgst + sgst) * 100) / 100;
        b2cEntry.igst = Math.round((b2cEntry.igst + igst) * 100) / 100;
        b2cEntry.total_tax = Math.round((b2cEntry.total_tax + totalTax) * 100) / 100;
        b2cEntry.total_invoice_value =
          Math.round((b2cEntry.total_invoice_value + invoiceTotal) * 100) / 100;
      }
    }

    // --- HSN Summary Aggregation ---
    const invoiceItems = inv.items && inv.items.length > 0 ? inv.items : [];
    for (const it of invoiceItems) {
      const rawHsn = (it.hsn_code || "998311").trim();
      const itemTaxable = Number(it.taxable_amount) || Number(it.qty) * Number(it.rate);
      const itemCgst = Number(it.cgst_amount) || 0;
      const itemSgst = Number(it.sgst_amount) || 0;
      const itemIgst = Number(it.igst_amount) || 0;
      const itemTax = itemCgst + itemSgst + itemIgst;
      const itemVal = itemTaxable + itemTax;
      const qty = Number(it.qty) || 1;

      if (!hsnMap.has(rawHsn)) {
        hsnMap.set(rawHsn, {
          hsn_code: rawHsn,
          description: it.description || "General Goods or Services",
          uqc: "NOS",
          total_quantity: 0,
          taxable_value: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total_tax: 0,
          total_value: 0,
        });
      }

      const hsnSummary = hsnMap.get(rawHsn)!;
      hsnSummary.total_quantity += qty;
      hsnSummary.taxable_value = Math.round((hsnSummary.taxable_value + itemTaxable) * 100) / 100;
      hsnSummary.cgst = Math.round((hsnSummary.cgst + itemCgst) * 100) / 100;
      hsnSummary.sgst = Math.round((hsnSummary.sgst + itemSgst) * 100) / 100;
      hsnSummary.igst = Math.round((hsnSummary.igst + itemIgst) * 100) / 100;
      hsnSummary.total_tax = Math.round((hsnSummary.total_tax + itemTax) * 100) / 100;
      hsnSummary.total_value = Math.round((hsnSummary.total_value + itemVal) * 100) / 100;
    }
  }

  // If no items were in invoice items, provide high level HSN entry if outward invoices exist
  if (hsnMap.size === 0 && outwardInvoices.length > 0) {
    hsnMap.set("998311", {
      hsn_code: "998311",
      description: "Information Technology and Software Advisory Services",
      uqc: "OTH",
      total_quantity: outwardInvoices.length,
      taxable_value: totalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      total_tax: totalCgst + totalSgst + totalIgst,
      total_value: grossTurnover,
    });
  }

  return {
    financial_year: filter.financialYear,
    period_label: periodLabel,
    period_filter: filter,
    gross_turnover: Math.round(grossTurnover * 100) / 100,
    total_taxable_value: Math.round(totalTaxable * 100) / 100,
    total_cgst: Math.round(totalCgst * 100) / 100,
    total_sgst: Math.round(totalSgst * 100) / 100,
    total_igst: Math.round(totalIgst * 100) / 100,
    total_tax_liability: Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100,
    total_b2b_value: Math.round(totalB2bValue * 100) / 100,
    total_b2c_value: Math.round(totalB2cValue * 100) / 100,
    total_b2b_taxable: Math.round(totalB2bTaxable * 100) / 100,
    total_b2c_taxable: Math.round(totalB2cTaxable * 100) / 100,
    b2b_groups: Array.from(b2bMap.values()).sort((a, b) =>
      b.total_invoice_value - a.total_invoice_value
    ),
    b2c_summaries: Array.from(b2cMap.values()).sort((a, b) =>
      a.pos_state.localeCompare(b.pos_state)
    ),
    hsn_summaries: Array.from(hsnMap.values()).sort((a, b) =>
      b.taxable_value - a.taxable_value
    ),
  };
}
