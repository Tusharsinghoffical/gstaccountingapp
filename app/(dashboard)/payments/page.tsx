"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getPayments, PaymentWithParty } from "@/app/actions/payments";
import { DataTable, Column, Button, Input } from "@/components/ui";
import { formatINR } from "@/lib/format";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithParty[]>([]);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getPayments();
        setPayments(data);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filtered = payments.filter((pay) => {
    const matchesSearch =
      (pay.reference_no || "").toLowerCase().includes(search.toLowerCase()) ||
      pay.party_name.toLowerCase().includes(search.toLowerCase()) ||
      (pay.notes || "").toLowerCase().includes(search.toLowerCase());

    const matchesMode = modeFilter === "all" || pay.mode === modeFilter;

    return matchesSearch && matchesMode;
  });

  const columns: Column<PaymentWithParty>[] = [
    {
      header: "Date",
      accessorKey: "date",
      render: (row) => (
        <span className="font-mono text-xs text-neutral-600">{row.date}</span>
      ),
    },
    {
      header: "Reference #",
      accessorKey: "reference_no",
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-neutral-900">
            {row.reference_no || "N/A"}
          </span>
          {row.notes && (
            <p className="text-[11px] text-neutral-400 truncate max-w-[180px]">
              {row.notes}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Counterparty",
      accessorKey: "party_name",
      render: (row) => (
        <div className="font-semibold text-neutral-900 text-sm">
          {row.party_name}
        </div>
      ),
    },
    {
      header: "Payment Mode",
      accessorKey: "mode",
      align: "center",
      render: (row) => {
        const labels: Record<string, string> = {
          bank_transfer: "Bank Transfer",
          upi: "UPI",
          cash: "Cash",
          cheque: "Cheque",
          other: "Other",
        };
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-neutral-700 uppercase">
            {labels[row.mode] || row.mode}
          </span>
        );
      },
    },
    {
      header: "Total Amount (₹)",
      align: "right",
      accessorKey: "amount",
      render: (row) => (
        <span className="font-mono font-bold text-sm text-neutral-900">
          {formatINR(row.amount)}
        </span>
      ),
    },
    {
      header: "Allocated (₹)",
      align: "right",
      accessorKey: "allocated_total",
      render: (row) => (
        <span className="font-mono font-semibold text-xs text-brand-700">
          {formatINR(row.allocated_total)}
        </span>
      ),
    },
    {
      header: "Unallocated (Advance)",
      align: "right",
      accessorKey: "unallocated",
      render: (row) => (
        <span
          className={`font-mono text-xs font-semibold ${
            row.unallocated > 0 ? "text-income-700" : "text-neutral-400"
          }`}
        >
          {row.unallocated > 0 ? formatINR(row.unallocated) : "₹0.00"}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      render: (row) => {
        if (row.unallocated === 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-income-50 text-income-700 border border-income-200">
              Fully Allocated
            </span>
          );
        }
        if (row.allocated_total > 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-warning-50 text-warning-700 border border-warning-200">
              Partially Allocated
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
            Unallocated Advance
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Payments Register
          </h1>
          <p className="text-sm text-neutral-500">
            Record customer collections and supplier disbursements with multi-invoice allocation.
          </p>
        </div>

        <Link href="/payments/new">
          <Button
            variant="primary"
            size="sm"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Record Payment
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-card flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search reference # or party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftPrefix={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "All Modes"],
              ["bank_transfer", "Bank Transfer"],
              ["upi", "UPI"],
              ["cheque", "Cheque"],
              ["cash", "Cash"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                modeFilter === m
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Payments DataTable */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No payments recorded"
        emptyDescription="Record your first customer payment or vendor disbursement and allocate it against open invoices."
        emptyAction={{
          label: "Record Payment",
          onClick: () => (window.location.href = "/payments/new"),
        }}
      />
    </div>
  );
}
