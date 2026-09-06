"use server";

import { getInvoices } from "./invoices";
import { getCustomers } from "./parties";
import { getPaymentAllocations } from "./payments";
import {
  computeGstr1Report,
  type Gstr1PeriodFilter,
  type Gstr1ReportData,
  type SalesInvoiceForReport,
} from "@/lib/reports/gstr1";
import {
  computeAgeingReport,
  type AgeingReportData,
} from "@/lib/reports/ageing";

/**
 * Server action to generate GSTR-1 dataset for a specified financial year and month/quarter period.
 */
export async function getGstr1Report(
  filter: Gstr1PeriodFilter
): Promise<Gstr1ReportData> {
  const [invoices, customers] = await Promise.all([
    getInvoices(),
    getCustomers(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const salesInvoices: SalesInvoiceForReport[] = invoices
    .filter((inv) => inv.type === "sales")
    .map((inv) => {
      const cust = customerMap.get(inv.customer_or_supplier_id);
      return {
        ...inv,
        party_name: cust?.name || inv.party_name,
        party_gstin: cust?.gstin || null,
        party_state_code: cust?.state_code || "27",
      };
    });

  return computeGstr1Report(salesInvoices, filter);
}

/**
 * Server action to generate Accounts Receivable Ageing & Outstanding report.
 */
export async function getAgeingReport(
  asOfDate?: string
): Promise<AgeingReportData> {
  const [invoices, customers, allocations] = await Promise.all([
    getInvoices(),
    getCustomers(),
    getPaymentAllocations(),
  ]);

  return computeAgeingReport(invoices, customers, allocations, asOfDate);
}
