"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { getAgeingReport } from "@/app/actions/reports";
import type { AgeingReportData, CustomerAgeingSummary } from "@/lib/reports/ageing";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui";

export default function AgeingReportPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const [reportData, setReportData] = useState<AgeingReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingXlsx, setIsExportingXlsx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getAgeingReport(asOfDate);
        setReportData(data);
      } catch (err) {
        console.error("Failed to load Ageing report:", err);
      } finally {
        setIsLoading(false);
      }
    }

    startTransition(() => {
      loadData();
    });
  }, [asOfDate]);

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (format === "xlsx") setIsExportingXlsx(true);
    if (format === "pdf") setIsExportingPdf(true);

    try {
      const params = new URLSearchParams({
        format,
        asOfDate,
      });

      const response = await fetch(`/api/reports/ageing/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      if (format === "pdf" && contentType.includes("text/html")) {
        // Open print preview in new window/tab
        const html = await response.text();
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
        }
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Ageing_Report_${asOfDate}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error(`Export ${format} error:`, err);
      alert(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      if (format === "xlsx") setIsExportingXlsx(false);
      if (format === "pdf") setIsExportingPdf(false);
    }
  };

  // Filter customers by search query
  const filteredCustomers = (reportData?.customers || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      (c.customer_gstin && c.customer_gstin.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
            <Link href="/reports" className="hover:text-neutral-700 transition-colors">
              Reports
            </Link>
            <span>/</span>
            <span className="text-neutral-700">Accounts Receivable Ageing</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Outstanding & Ageing Analysis</span>
            <span className="text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              Debtors Ageing
            </span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Track unpaid receivables categorized by invoice age: 0–30, 31–60, 61–90, and 90+ days.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExportingPdf || isLoading}
            className="flex items-center gap-2 text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200"
          >
            {isExportingPdf ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
            <span>Export PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={isExportingXlsx || isLoading}
            className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
          >
            {isExportingXlsx ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span>Export XLSX</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="asOfDate" className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
              As of Date:
            </label>
            <input
              id="asOfDate"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="text-xs text-neutral-400">|</div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">
              Total Debtors:{" "}
              <strong className="text-neutral-900 font-bold">{reportData?.debtor_count || 0}</strong>
            </span>
            <span className="text-neutral-300">•</span>
            <span className="text-xs font-semibold text-neutral-500">
              Open Invoices:{" "}
              <strong className="text-neutral-900 font-bold">{reportData?.total_open_invoices || 0}</strong>
            </span>
          </div>
        </div>

        {/* Search filter */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search customer or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <svg
            className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* KPI Cards: Ageing Buckets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Receivables */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-brand-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-neutral-500">Total Outstanding</span>
            <span className="w-2 h-2 rounded-full bg-brand-500" />
          </div>
          <div className="mt-2 text-xl font-black text-neutral-900 tracking-tight">
            {formatINR(reportData?.total_receivables || 0)}
          </div>
          <p className="mt-1 text-2xs text-neutral-400">All unpaid customer invoices</p>
        </div>

        {/* 0-30 Days: Current */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800">0 – 30 Days</span>
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Current</span>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-900 tracking-tight">
            {formatINR(reportData?.total_0_30 || 0)}
          </div>
          <p className="mt-1 text-2xs text-emerald-700">Healthy billing period</p>
        </div>

        {/* 31-60 Days: Follow-up */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-800">31 – 60 Days</span>
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Follow-up</span>
          </div>
          <div className="mt-2 text-xl font-black text-amber-900 tracking-tight">
            {formatINR(reportData?.total_31_60 || 0)}
          </div>
          <p className="mt-1 text-2xs text-amber-700">Payment reminder stage</p>
        </div>

        {/* 61-90 Days: Warning */}
        <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-orange-800">61 – 90 Days</span>
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">Attention</span>
          </div>
          <div className="mt-2 text-xl font-black text-orange-900 tracking-tight">
            {formatINR(reportData?.total_61_90 || 0)}
          </div>
          <p className="mt-1 text-2xs text-orange-700">Delayed credit risk</p>
        </div>

        {/* 90+ Days: Critical */}
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-rose-800">90+ Days</span>
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">Critical</span>
          </div>
          <div className="mt-2 text-xl font-black text-rose-900 tracking-tight">
            {formatINR(reportData?.total_90_plus || 0)}
          </div>
          <p className="mt-1 text-2xs text-rose-700">High default risk</p>
        </div>
      </div>

      {/* Main Table: Customer Ageing Breakdown */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-card overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/60">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Customer Ageing Summary</h3>
            <p className="text-xs text-neutral-500">
              Sorted by Total Outstanding descending. Click any row to expand open invoices drill-down.
            </p>
          </div>
          <span className="text-xs font-semibold text-neutral-400">
            Showing {filteredCustomers.length} of {reportData?.debtor_count || 0} debtors
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-900 text-white text-2xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">GSTIN</th>
                <th className="py-3 px-4 text-right">0 – 30 Days</th>
                <th className="py-3 px-4 text-right">31 – 60 Days</th>
                <th className="py-3 px-4 text-right">61 – 90 Days</th>
                <th className="py-3 px-4 text-right">90+ Days</th>
                <th className="py-3 px-4 text-right">Total Outstanding</th>
                <th className="py-3 px-4 text-center">Invoices</th>
                <th className="py-3 px-4 text-center">Drilldown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <span className="animate-spin inline-block mr-2">🔄</span>
                    Calculating outstanding ageing buckets...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    No outstanding invoices found for this date.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust: CustomerAgeingSummary) => {
                  const isExpanded = expandedCustomerId === cust.customer_id;
                  return (
                    <React.Fragment key={cust.customer_id}>
                      <tr
                        onClick={() =>
                          setExpandedCustomerId(isExpanded ? null : cust.customer_id)
                        }
                        className="hover:bg-neutral-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-neutral-900">
                          {cust.customer_name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-2xs text-neutral-600">
                          {cust.customer_gstin || (
                            <span className="text-neutral-400 italic">Unregistered</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-neutral-700">
                          {cust.bucket_0_30 > 0 ? (
                            formatINR(cust.bucket_0_30)
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-neutral-700">
                          {cust.bucket_31_60 > 0 ? (
                            formatINR(cust.bucket_31_60)
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-neutral-700">
                          {cust.bucket_61_90 > 0 ? (
                            formatINR(cust.bucket_61_90)
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold">
                          {cust.bucket_90_plus > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {formatINR(cust.bucket_90_plus)}
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-brand-700">
                          {formatINR(cust.total_outstanding)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-2xs font-bold rounded-full bg-neutral-100 text-neutral-700">
                            {cust.invoice_count}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            className="text-xs text-brand-600 hover:text-brand-800 font-semibold p-1"
                          >
                            {isExpanded ? "▲ Hide" : "▼ View"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Open Invoices Sub-table */}
                      {isExpanded && (
                        <tr className="bg-neutral-50/90">
                          <td colSpan={9} className="py-3 px-6">
                            <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-inner space-y-2">
                              <div className="flex items-center justify-between text-2xs font-bold text-neutral-600 border-b border-neutral-100 pb-2">
                                <span>OPEN INVOICES FOR {cust.customer_name.toUpperCase()}</span>
                                <span>
                                  Original Invoiced: {formatINR(cust.total_invoiced)} | Paid: {formatINR(cust.total_paid)}
                                </span>
                              </div>
                              <table className="w-full text-left text-2xs">
                                <thead>
                                  <tr className="text-neutral-400 uppercase border-b border-neutral-100">
                                    <th className="py-1.5 px-2">Invoice No</th>
                                    <th className="py-1.5 px-2">Date</th>
                                    <th className="py-1.5 px-2 text-center">Age</th>
                                    <th className="py-1.5 px-2 text-center">Bucket</th>
                                    <th className="py-1.5 px-2 text-right">Original Total</th>
                                    <th className="py-1.5 px-2 text-right">Paid</th>
                                    <th className="py-1.5 px-2 text-right">Balance Due</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                  {cust.invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-neutral-50/60">
                                      <td className="py-1.5 px-2 font-mono font-bold text-brand-700">
                                        {inv.invoice_no}
                                      </td>
                                      <td className="py-1.5 px-2 text-neutral-600">
                                        {inv.invoice_date}
                                      </td>
                                      <td className="py-1.5 px-2 text-center font-semibold text-neutral-700">
                                        {inv.age_in_days} days
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded font-bold text-3xs ${
                                            inv.bucket === "0-30"
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                              : inv.bucket === "31-60"
                                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                                              : inv.bucket === "61-90"
                                              ? "bg-orange-50 text-orange-700 border border-orange-200"
                                              : "bg-rose-50 text-rose-700 border border-rose-200"
                                          }`}
                                        >
                                          {inv.bucket} Days
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-neutral-600">
                                        {formatINR(inv.total)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-emerald-600 font-medium">
                                        {formatINR(inv.paid_amount)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-neutral-900">
                                        {formatINR(inv.remaining_balance)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Grand Totals Footer */}
            {reportData && reportData.customers.length > 0 && (
              <tfoot>
                <tr className="bg-neutral-100 font-bold text-xs border-t-2 border-neutral-300">
                  <td className="py-3 px-4 text-neutral-900" colSpan={2}>
                    GRAND TOTALS
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-900">
                    {formatINR(reportData.total_0_30)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-900">
                    {formatINR(reportData.total_31_60)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-900">
                    {formatINR(reportData.total_61_90)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-700 font-extrabold">
                    {formatINR(reportData.total_90_plus)}
                  </td>
                  <td className="py-3 px-4 text-right text-brand-700 font-black">
                    {formatINR(reportData.total_receivables)}
                  </td>
                  <td className="py-3 px-4 text-center text-neutral-800">
                    {reportData.total_open_invoices}
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
