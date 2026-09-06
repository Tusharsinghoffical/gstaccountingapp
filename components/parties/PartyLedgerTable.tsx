"use client";

import React, { useState } from "react";
import Link from "next/link";
import { LedgerEntry, LedgerEntryWithRunningBalance } from "@/types";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { formatINR } from "@/lib/format";

export interface PartyLedgerTableProps {
  entries: LedgerEntry[];
  partyName: string;
  partyType?: "customer" | "supplier";
}

interface ProcessedLedgerRow extends LedgerEntry {
  debit: number;
  credit: number;
  runningBalance: number;
  drCr: "Dr" | "Cr";
}

export const PartyLedgerTable: React.FC<PartyLedgerTableProps> = ({
  entries,
  partyName,
  partyType = "customer",
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Sort entries chronologically: entry_date ASC, then created_at ASC, then id ASC
  const sortedEntries = [...entries].sort((a, b) => {
    const dateDiff =
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
    if (dateDiff !== 0) return dateDiff;

    const timeDiff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });

  // 2. Compute query-time running balance
  let cumulative = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const processedData: ProcessedLedgerRow[] = sortedEntries.map((entry) => {
    const isDebit = entry.entry_type === "debit";
    const debit = isDebit ? entry.amount : 0;
    const credit = !isDebit ? entry.amount : 0;

    totalDebit += debit;
    totalCredit += credit;

    // Double-entry accounting convention:
    // Debit increases running balance; Credit decreases running balance
    cumulative += debit - credit;

    return {
      ...entry,
      debit,
      credit,
      runningBalance: Math.round(cumulative * 100) / 100,
      drCr: cumulative >= 0 ? "Dr" : "Cr",
    };
  });

  // Net closing balance
  const closingBalance = cumulative;
  const absClosing = Math.abs(closingBalance);
  const closingDrCr = closingBalance >= 0 ? "Dr" : "Cr";

  // Contextual meaning based on party type
  let balanceNatureLabel = "";
  let balanceBadgeColor = "";

  if (partyType === "customer") {
    if (closingBalance > 0) {
      balanceNatureLabel = "Receivable from Customer";
      balanceBadgeColor = "bg-brand-50 text-brand-700 border-brand-200";
    } else if (closingBalance < 0) {
      balanceNatureLabel = "Customer Advance (Overpaid)";
      balanceBadgeColor = "bg-income-50 text-income-700 border-income-200";
    } else {
      balanceNatureLabel = "Account Settled (Zero Balance)";
      balanceBadgeColor = "bg-neutral-100 text-neutral-600 border-neutral-200";
    }
  } else {
    // Supplier
    if (closingBalance < 0) {
      balanceNatureLabel = "Payable to Supplier";
      balanceBadgeColor = "bg-warning-50 text-warning-700 border-warning-200";
    } else if (closingBalance > 0) {
      balanceNatureLabel = "Vendor Advance (Prepaid)";
      balanceBadgeColor = "bg-income-50 text-income-700 border-income-200";
    } else {
      balanceNatureLabel = "Account Settled (Zero Balance)";
      balanceBadgeColor = "bg-neutral-100 text-neutral-600 border-neutral-200";
    }
  }

  // Filter for display
  const filteredData = processedData.filter((row) => {
    const term = searchTerm.toLowerCase();
    const matchesDesc = (row.description || "").toLowerCase().includes(term);
    const matchesRef =
      (row.ref_invoice_id || "").toLowerCase().includes(term) ||
      (row.ref_payment_id || "").toLowerCase().includes(term);
    const matchesDate = row.entry_date.includes(term);
    return matchesDesc || matchesRef || matchesDate;
  });

  const columns: Column<ProcessedLedgerRow>[] = [
    {
      header: "Date",
      accessorKey: "entry_date",
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-semibold text-neutral-900 block">
            {row.entry_date}
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </div>
      ),
    },
    {
      header: "Particulars & Reference",
      accessorKey: "description",
      render: (row) => (
        <div className="space-y-1">
          <div className="font-semibold text-neutral-900 text-xs">
            {row.description || "General Ledger Entry"}
          </div>
          <div className="flex items-center gap-2">
            {row.ref_invoice_id && (
              <Link
                href={`/invoices`}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-600 hover:text-brand-800 hover:underline"
              >
                <span>Invoice: {row.ref_invoice_id}</span>
              </Link>
            )}
            {row.ref_payment_id && (
              <Link
                href={`/payments`}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-income-700 hover:text-income-900 hover:underline"
              >
                <span>Payment: {row.ref_payment_id}</span>
              </Link>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Debit (Dr)",
      align: "right",
      render: (row) => (
        <span
          className={`font-mono text-xs font-semibold ${
            row.debit > 0 ? "text-neutral-900" : "text-neutral-300"
          }`}
        >
          {row.debit > 0 ? formatINR(row.debit) : "—"}
        </span>
      ),
    },
    {
      header: "Credit (Cr)",
      align: "right",
      render: (row) => (
        <span
          className={`font-mono text-xs font-semibold ${
            row.credit > 0 ? "text-income-700" : "text-neutral-300"
          }`}
        >
          {row.credit > 0 ? formatINR(row.credit) : "—"}
        </span>
      ),
    },
    {
      header: "Running Balance",
      align: "right",
      render: (row) => {
        const isDr = row.drCr === "Dr";
        return (
          <div className="text-right">
            <span
              className={`font-mono font-bold text-xs ${
                partyType === "customer"
                  ? isDr
                    ? "text-brand-700"
                    : "text-income-700"
                  : !isDr
                  ? "text-warning-700"
                  : "text-income-700"
              }`}
            >
              {formatINR(Math.abs(row.runningBalance))}
            </span>
            <span className="text-[10px] font-bold text-neutral-400 ml-1">
              {row.drCr}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview & Live Running Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Debits */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Total Invoiced (Debits)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-neutral-200 text-neutral-700">
              Dr
            </span>
          </div>
          <p className="font-mono font-bold text-lg text-neutral-900">
            {formatINR(totalDebit)}
          </p>
          <p className="text-[11px] text-neutral-400">
            Sum of all sales/inward debits
          </p>
        </div>

        {/* Total Credits */}
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Total Payments (Credits)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-income-100 text-income-800">
              Cr
            </span>
          </div>
          <p className="font-mono font-bold text-lg text-income-700">
            {formatINR(totalCredit)}
          </p>
          <p className="text-[11px] text-neutral-400">
            Sum of all receipts/disbursements
          </p>
        </div>

        {/* Net Running Closing Balance */}
        <div className="p-4 rounded-xl bg-white border border-brand-200 shadow-sm space-y-1 ring-1 ring-brand-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Net Closing Balance
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${balanceBadgeColor}`}
            >
              {balanceNatureLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-extrabold text-xl text-neutral-900">
              {formatINR(absClosing)}
            </span>
            <span className="text-xs font-bold text-neutral-500">
              {closingDrCr}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500">
            Computed on-the-fly from {entries.length} double-entry records
          </p>
        </div>
      </div>

      {/* Table Header & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="text-base font-bold text-neutral-900">
            Chronological Ledger Statement
          </h3>
          <p className="text-xs text-neutral-500">
            Audit-grade double-entry transaction trail for {partyName} with query-time running balance.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search particulars or references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftPrefix={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Ledger DataTable */}
      <DataTable
        columns={columns}
        data={filteredData}
        keyExtractor={(item) => item.id}
        emptyTitle="No ledger transactions found"
        emptyDescription="Invoices and payments recorded for this counterparty will automatically generate double-entry ledger items."
      />
    </div>
  );
};
