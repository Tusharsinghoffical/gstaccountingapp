import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSupplierById,
  getPartyLedgerEntries,
  getPartyBalance,
} from "@/app/actions/parties";
import { PartyLedgerTable } from "@/components/parties";
import { Button, StatusBadge } from "@/components/ui";
import { STATE_CODE_MAP } from "@/lib/constants/states";
import { formatINR } from "@/lib/format";

export default async function SupplierDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supplier = await getSupplierById(params.id);

  if (!supplier) {
    notFound();
  }

  // Derived at query time from double-entry ledger records (never stored mutably)
  const [ledgerEntries, balanceSummary] = await Promise.all([
    getPartyLedgerEntries(supplier.id),
    getPartyBalance(supplier.id, "supplier"),
  ]);

  const absBalance = Math.abs(balanceSummary.net_balance);
  const isPayable = balanceSummary.net_balance < 0; // Credits > Debits
  const isAdvance = balanceSummary.net_balance > 0; // Debits > Credits

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Suppliers
        </Link>
      </div>

      {/* Profile & Overview Header */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
                {supplier.name}
              </h1>
              <StatusBadge
                status={supplier.is_active ? "active" : "inactive"}
              />
            </div>
            <p className="text-xs text-neutral-500">
              Supplier ID: <span className="font-mono">{supplier.id}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/payments/new`}>
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

            <Link href={`/invoices/new`}>
              <Button variant="secondary" size="sm">
                New Purchase Bill
              </Button>
            </Link>

            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Button variant="outline" size="sm">
                Edit Details
              </Button>
            </Link>
          </div>
        </div>

        {/* GST & Registration Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Query-time Live Balance Card */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              <span>Running Balance</span>
              <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-900 font-extrabold">
                Live
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-black text-base text-amber-950">
                {formatINR(absBalance)}
              </span>
              <span className="font-mono text-xs font-bold text-neutral-500">
                {balanceSummary.dr_cr}
              </span>
            </div>
            <p className="text-[10px] font-semibold text-amber-700">
              {isPayable
                ? "Payable to Supplier"
                : isAdvance
                ? "Vendor Advance (Prepaid)"
                : "Account Settled"}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              GSTIN
            </div>
            <div className="font-mono font-bold text-xs text-neutral-900">
              {supplier.gstin ? (
                <div className="flex items-center gap-1.5">
                  <span>{supplier.gstin}</span>
                  <span
                    title="Verified Checksum"
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  />
                </div>
              ) : (
                <span className="text-neutral-400 italic">Unregistered</span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Place of Supply
            </div>
            <div className="text-xs font-bold text-neutral-900">
              {supplier.state_code} - {STATE_CODE_MAP[supplier.state_code] || "State"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              PAN
            </div>
            <div className="font-mono font-bold text-xs text-neutral-900">
              {supplier.pan || "Not Provided"}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Phone / Mobile
            </div>
            <div className="text-xs font-bold text-neutral-900">
              {supplier.phone || "Not Provided"}
            </div>
          </div>
        </div>

        {supplier.billing_address && (
          <div className="text-xs text-neutral-600 bg-neutral-50/50 p-3 rounded-xl border border-neutral-100">
            <span className="font-semibold text-neutral-800">Billing Address: </span>
            {supplier.billing_address}
          </div>
        )}
      </div>

      {/* Ledger History View */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card">
        <PartyLedgerTable
          entries={ledgerEntries}
          partyName={supplier.name}
          partyType="supplier"
        />
      </div>
    </div>
  );
}
