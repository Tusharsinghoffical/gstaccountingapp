import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
          Compliance & Financial Reports
        </h1>
        <p className="text-sm text-neutral-500">
          Export GSTR-1 summaries, ageing analysis, and P&L statements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-card space-y-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
            GSTR-1
          </div>
          <h3 className="text-base font-bold text-neutral-900">GSTR-1 Summary</h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            B2B & B2C invoice breakdown, HSN-wise tax distribution, and state-wise supplies.
          </p>
          <Link href="/reports/gstr1" className="block w-full">
            <Button variant="outline" size="sm" className="w-full">
              View GSTR-1 Summary
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-card space-y-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
            AGE
          </div>
          <h3 className="text-base font-bold text-neutral-900">Outstanding Ageing</h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Receivables age buckets (0–30, 31–60, 61–90, 90+ days) for credit management.
          </p>
          <Link href="/reports/ageing" className="block w-full">
            <Button variant="outline" size="sm" className="w-full">
              View Ageing Report
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-card space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
            P&L
          </div>
          <h3 className="text-base font-bold text-neutral-900">Profit & Loss Snapshot</h3>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Revenue against direct expenses and Input Tax Credit (ITC) balance.
          </p>
          <Button variant="outline" size="sm" className="w-full">
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
}
