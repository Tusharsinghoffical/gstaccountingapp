"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  GSTR1_MONTHS,
  GSTR1_QUARTERS,
  Gstr1PeriodFilter,
  Gstr1ReportData,
} from "@/lib/reports/gstr1";
import { getGstr1Report } from "@/app/actions/reports";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui";

export default function Gstr1ReportPage() {
  const [financialYear, setFinancialYear] = useState<string>("2024-25");
  const [periodType, setPeriodType] = useState<"month" | "quarter">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("04"); // April default
  const [selectedQuarter, setSelectedQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q1");
  const [activeTab, setActiveTab] = useState<"b2b" | "b2c" | "hsn">("b2b");
  const [expandedGstin, setExpandedGstin] = useState<string | null>(null);

  const [reportData, setReportData] = useState<Gstr1ReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const filter: Gstr1PeriodFilter = {
          financialYear,
          periodType,
          month: periodType === "month" ? selectedMonth : undefined,
          quarter: periodType === "quarter" ? selectedQuarter : undefined,
        };
        const data = await getGstr1Report(filter);
        setReportData(data);
      } catch (err) {
        console.error("Failed to load GSTR-1 report:", err);
      } finally {
        setIsLoading(false);
      }
    }

    startTransition(() => {
      loadData();
    });
  }, [financialYear, periodType, selectedMonth, selectedQuarter]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        financialYear,
        periodType,
        ...(periodType === "month" ? { month: selectedMonth } : { quarter: selectedQuarter }),
      });

      const response = await fetch(`/api/reports/gstr1/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanPeriod = (reportData?.period_label || "Return").replace(/[\s/]/g, "_");
      a.download = `GSTR1_${cleanPeriod}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel spreadsheet. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

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
            <span className="text-neutral-700">GSTR-1 Outward Supplies</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>GSTR-1 Return Summary</span>
            <span className="text-xs font-mono font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-0.5 rounded-full">
              Form GSTR-1
            </span>
          </h1>
          <p className="text-xs text-neutral-500">
            Outward supplies categorized for GST statutory filing (B2B, B2C, and HSN).
          </p>
        </div>

        {/* Export to Excel CTA */}
        <Button
          variant="primary"
          onClick={handleExportExcel}
          disabled={isExporting || isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm inline-flex items-center gap-2"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Generating Excel...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export to Excel (.xlsx)</span>
            </>
          )}
        </Button>
      </div>

      {/* Filter Bar: FY, Period Type (Month/Quarter), Period Selector */}
      <div className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-card space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Financial Year Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Financial Year
              </label>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="2024-25">FY 2024-25</option>
                <option value="2025-26">FY 2025-26</option>
              </select>
            </div>

            {/* Period Type Toggle */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Frequency
              </label>
              <div className="inline-flex rounded-lg p-0.5 bg-neutral-100 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setPeriodType("month")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    periodType === "month"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType("quarter")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    periodType === "quarter"
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>

            {/* Dynamic Period Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                {periodType === "month" ? "Return Month" : "Return Quarter"}
              </label>
              {periodType === "month" ? (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[160px]"
                >
                  {GSTR1_MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedQuarter}
                  onChange={(e) =>
                    setSelectedQuarter(e.target.value as "Q1" | "Q2" | "Q3" | "Q4")
                  }
                  className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[180px]"
                >
                  {GSTR1_QUARTERS.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono text-neutral-400 block">
              Place of Supply Engine: Multi-State
            </span>
            <span className="text-xs font-semibold text-neutral-700">
              Active Period: {reportData?.period_label || "Loading..."}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Turnover */}
        <div className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-card space-y-1.5">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Gross Outward Turnover
          </span>
          <div className="text-2xl font-mono font-black text-neutral-900">
            {formatINR(reportData?.gross_turnover || 0)}
          </div>
          <p className="text-[11px] text-neutral-500">
            Taxable Value: {formatINR(reportData?.total_taxable_value || 0)}
          </p>
        </div>

        {/* Total Tax Liability */}
        <div className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-card space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Total Tax Liability
            </span>
            <span className="text-[10px] font-mono bg-expense-50 text-expense-700 px-1.5 py-0.5 rounded font-bold">
              Payable
            </span>
          </div>
          <div className="text-2xl font-mono font-black text-brand-700">
            {formatINR(reportData?.total_tax_liability || 0)}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
            <span>CGST: {formatINR(reportData?.total_cgst || 0)}</span>
            <span>·</span>
            <span>SGST: {formatINR(reportData?.total_sgst || 0)}</span>
            <span>·</span>
            <span>IGST: {formatINR(reportData?.total_igst || 0)}</span>
          </div>
        </div>

        {/* B2B Supplies */}
        <div className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-card space-y-1.5">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Table 4: B2B Supplies
          </span>
          <div className="text-2xl font-mono font-black text-neutral-900">
            {formatINR(reportData?.total_b2b_value || 0)}
          </div>
          <p className="text-[11px] text-neutral-500">
            {reportData?.b2b_groups.length || 0} Registered Parties
          </p>
        </div>

        {/* B2C Supplies */}
        <div className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-card space-y-1.5">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Table 7: B2C Supplies
          </span>
          <div className="text-2xl font-mono font-black text-neutral-900">
            {formatINR(reportData?.total_b2c_value || 0)}
          </div>
          <p className="text-[11px] text-neutral-500">
            {reportData?.b2c_summaries.length || 0} State/Rate Buckets
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-card overflow-hidden">
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-4 pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("b2b")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "b2b"
                ? "border-brand-600 text-brand-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>Table 4: B2B Invoices</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {reportData?.b2b_groups.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("b2c")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "b2c"
                ? "border-brand-600 text-brand-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>Table 7: B2C Small Supplies</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {reportData?.b2c_summaries.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("hsn")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "hsn"
                ? "border-brand-600 text-brand-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <span>Table 12: HSN Summary</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {reportData?.hsn_summaries.length || 0}
            </span>
          </button>
        </div>

        {/* Tab 1: Table 4 - B2B Invoices */}
        {activeTab === "b2b" && (
          <div className="overflow-x-auto">
            {reportData?.b2b_groups.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center font-bold">
                  B2B
                </div>
                <h4 className="text-sm font-bold text-neutral-700">No B2B Invoices Found</h4>
                <p className="text-xs text-neutral-500">
                  There are no sales invoices for registered GSTIN customers in this period.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">Customer GSTIN / Trade Name</th>
                    <th className="px-4 py-3">Place of Supply</th>
                    <th className="px-4 py-3 text-center">Invoices</th>
                    <th className="px-4 py-3 text-right">Taxable Value</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">Total Invoice Value</th>
                    <th className="px-4 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reportData?.b2b_groups.map((group) => {
                    const isExpanded = expandedGstin === group.customer_gstin;
                    return (
                      <React.Fragment key={group.customer_gstin}>
                        <tr className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-neutral-900 text-xs">
                              {group.customer_gstin}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {group.customer_name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-600">
                            {group.pos_state} - {group.pos_state_name}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-xs text-neutral-800">
                            {group.invoice_count}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-neutral-800">
                            {formatINR(group.taxable_value)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                            {formatINR(group.cgst)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                            {formatINR(group.sgst)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                            {formatINR(group.igst)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-neutral-900">
                            {formatINR(group.total_invoice_value)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedGstin(isExpanded ? null : group.customer_gstin)
                              }
                              className="text-xs font-semibold text-brand-600 hover:text-brand-800 px-2 py-1 rounded bg-brand-50 hover:bg-brand-100 transition-colors"
                            >
                              {isExpanded ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Drill-Down of Invoices for this GSTIN */}
                        {isExpanded && (
                          <tr className="bg-brand-50/30">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm space-y-2">
                                <div className="text-xs font-bold text-brand-900 uppercase tracking-wider flex items-center justify-between">
                                  <span>Invoices for {group.customer_name}</span>
                                  <span className="font-mono text-neutral-500">
                                    GSTIN: {group.customer_gstin}
                                  </span>
                                </div>

                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase text-neutral-500">
                                      <th className="py-1.5">Invoice #</th>
                                      <th className="py-1.5">Date</th>
                                      <th className="py-1.5 text-right">Taxable</th>
                                      <th className="py-1.5 text-right">CGST</th>
                                      <th className="py-1.5 text-right">SGST</th>
                                      <th className="py-1.5 text-right">IGST</th>
                                      <th className="py-1.5 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100">
                                    {group.invoices.map((inv) => (
                                      <tr key={inv.invoice_id}>
                                        <td className="py-2 font-mono font-bold text-neutral-900">
                                          {inv.invoice_no}
                                        </td>
                                        <td className="py-2 font-mono text-neutral-500">
                                          {inv.invoice_date}
                                        </td>
                                        <td className="py-2 font-mono text-right text-neutral-800">
                                          {formatINR(inv.taxable_value)}
                                        </td>
                                        <td className="py-2 font-mono text-right text-neutral-600">
                                          {formatINR(inv.cgst)}
                                        </td>
                                        <td className="py-2 font-mono text-right text-neutral-600">
                                          {formatINR(inv.sgst)}
                                        </td>
                                        <td className="py-2 font-mono text-right text-neutral-600">
                                          {formatINR(inv.igst)}
                                        </td>
                                        <td className="py-2 font-mono text-right font-bold text-neutral-900">
                                          {formatINR(inv.invoice_value)}
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
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Table 7 - B2C Small Supplies */}
        {activeTab === "b2c" && (
          <div className="overflow-x-auto">
            {reportData?.b2c_summaries.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center font-bold">
                  B2C
                </div>
                <h4 className="text-sm font-bold text-neutral-700">No B2C Supplies Found</h4>
                <p className="text-xs text-neutral-500">
                  No outward sales to unregistered consumers occurred in this period.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">Place of Supply (POS)</th>
                    <th className="px-4 py-3">Applicable GST Rate</th>
                    <th className="px-4 py-3 text-center">Items/Count</th>
                    <th className="px-4 py-3 text-right">Taxable Value</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">Total Invoice Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reportData?.b2c_summaries.map((b2c, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-neutral-900 text-xs">
                          {b2c.pos_state}
                        </span>{" "}
                        - <span className="text-xs text-neutral-600">{b2c.pos_state_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-neutral-100 text-neutral-800">
                          {b2c.tax_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-neutral-700">
                        {b2c.invoice_count}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-neutral-800">
                        {formatINR(b2c.taxable_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                        {formatINR(b2c.cgst)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                        {formatINR(b2c.sgst)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                        {formatINR(b2c.igst)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-neutral-900">
                        {formatINR(b2c.total_invoice_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Table 12 - HSN Summary */}
        {activeTab === "hsn" && (
          <div className="overflow-x-auto">
            {reportData?.hsn_summaries.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center font-bold">
                  HSN
                </div>
                <h4 className="text-sm font-bold text-neutral-700">No HSN Data Available</h4>
                <p className="text-xs text-neutral-500">
                  No line items were recorded in outward sales invoices during this period.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">HSN / SAC Code</th>
                    <th className="px-4 py-3 min-w-[200px]">Description</th>
                    <th className="px-4 py-3 text-center">UQC</th>
                    <th className="px-4 py-3 text-right">Total Qty</th>
                    <th className="px-4 py-3 text-right">Taxable Value</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reportData?.hsn_summaries.map((hsn) => (
                    <tr key={hsn.hsn_code} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-xs text-neutral-900">
                        {hsn.hsn_code}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-700">
                        {hsn.description}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-neutral-500">
                        {hsn.uqc}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-neutral-800">
                        {hsn.total_quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-neutral-800">
                        {formatINR(hsn.taxable_value)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                        {formatINR(hsn.cgst)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                        {formatINR(hsn.sgst)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-neutral-600">
                        {formatINR(hsn.igst)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-neutral-900">
                        {formatINR(hsn.total_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
