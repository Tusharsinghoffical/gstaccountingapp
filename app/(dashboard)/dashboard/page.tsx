"use client";

import React from "react";
import Link from "next/link";
import { Button, StatusBadge, DataTable, Column } from "@/components/ui";
import { formatINR } from "@/lib/format";

interface RecentInvoice {
  id: string;
  invoice_no: string;
  party_name: string;
  type: "sales" | "purchase";
  date: string;
  amount: number;
  status: "paid" | "partial" | "draft" | "overdue";
}

const mockInvoices: RecentInvoice[] = [
  {
    id: "inv-1",
    invoice_no: "INV-2024-001",
    party_name: "Bharat Enterprises",
    type: "sales",
    date: "15/04/2024",
    amount: 145000,
    status: "paid",
  },
  {
    id: "inv-2",
    invoice_no: "INV-2024-002",
    party_name: "Mahalaxmi Trading Co",
    type: "sales",
    date: "16/04/2024",
    amount: 88500,
    status: "partial",
  },
  {
    id: "inv-3",
    invoice_no: "PUR-2024-019",
    party_name: "Tata Steel Logistics",
    type: "purchase",
    date: "17/04/2024",
    amount: 236000,
    status: "paid",
  },
  {
    id: "inv-4",
    invoice_no: "INV-2024-003",
    party_name: "Shree Ganesh Motors",
    type: "sales",
    date: "18/04/2024",
    amount: 42000,
    status: "draft",
  },
];

export default function DashboardPage() {
  const columns: Column<RecentInvoice>[] = [
    {
      header: "Invoice #",
      accessorKey: "invoice_no",
      render: (row) => (
        <span className="font-mono font-semibold text-neutral-900">
          {row.invoice_no}
        </span>
      ),
    },
    {
      header: "Counterparty",
      accessorKey: "party_name",
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.party_name}</div>
          <div className="text-[11px] text-neutral-500 capitalize">
            {row.type} Invoice
          </div>
        </div>
      ),
    },
    {
      header: "Date",
      accessorKey: "date",
      render: (row) => (
        <span className="text-neutral-600 font-mono text-xs">{row.date}</span>
      ),
    },
    {
      header: "Amount",
      align: "right",
      accessorKey: "amount",
      render: (row) => (
        <span className="font-mono font-bold text-neutral-900">
          {formatINR(row.amount)}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      accessorKey: "status",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-sm text-neutral-500">
            Real-time cash position, receivables, and GST compliance overview.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/ocr">
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              Scan via OCR
            </Button>
          </Link>

          <Link href="/invoices">
            <Button
              variant="primary"
              size="sm"
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards: Money In / Money Out / Net Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <span>Money In (Receivables)</span>
            <span className="w-2 h-2 rounded-full bg-income-500"></span>
          </div>
          <div className="text-2xl font-bold font-mono text-income-700">
            {formatINR(485000)}
          </div>
          <p className="text-xs text-neutral-500">From 8 pending sales invoices</p>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <span>Money Out (Payables)</span>
            <span className="w-2 h-2 rounded-full bg-expense-500"></span>
          </div>
          <div className="text-2xl font-bold font-mono text-expense-700">
            {formatINR(236000)}
          </div>
          <p className="text-xs text-neutral-500">Due to 3 suppliers</p>
        </div>

        <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <span>Net Monthly Balance</span>
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900">
            {formatINR(249000)}
          </div>
          <p className="text-xs text-neutral-500">Positive cash flow</p>
        </div>

        {/* GST Filing Compliance Status Widget */}
        <div className="p-5 rounded-xl border border-brand-200 bg-brand-50/40 shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-800">
            <span>GST Filing (Apr 2024)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-200 text-brand-800">
              GSTR-1
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status="final" label="Ready to Export" />
          </div>
          <p className="text-xs text-brand-700 font-medium">
            Next deadline: 11th May 2024
          </p>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">
            Recent Invoices
          </h2>
          <Link
            href="/invoices"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            View All Invoices →
          </Link>
        </div>

        <DataTable
          columns={columns}
          data={mockInvoices}
          keyExtractor={(item) => item.id}
        />
      </div>
    </div>
  );
}
