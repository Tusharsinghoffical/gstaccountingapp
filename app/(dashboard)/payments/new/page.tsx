"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getOpenInvoicesForParty,
  recordPayment,
  OpenInvoiceItem,
} from "@/app/actions/payments";
import { getCustomers, getSuppliers } from "@/app/actions/parties";
import { Customer, Supplier } from "@/types";
import { Button, Input, CurrencyInput } from "@/components/ui";
import { formatINR } from "@/lib/format";

interface InvoiceAllocationRow extends OpenInvoiceItem {
  allocated: number;
  rowError?: string;
}

export default function RecordPaymentPage() {
  const router = useRouter();

  // Form State
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [partyId, setPartyId] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [mode, setMode] = useState<
    "bank_transfer" | "upi" | "cash" | "cheque" | "other"
  >("bank_transfer");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Parties & Invoices
  const [customers, setCustomers] = useState<(Customer & { balance?: number })[]>([]);
  const [suppliers, setSuppliers] = useState<(Supplier & { balance?: number })[]>([]);
  const [openInvoices, setOpenInvoices] = useState<InvoiceAllocationRow[]>([]);
  const [loadingParties, setLoadingParties] = useState<boolean>(true);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load parties on mount
  useEffect(() => {
    async function loadParties() {
      try {
        const [cList, sList] = await Promise.all([
          getCustomers(),
          getSuppliers(),
        ]);
        setCustomers(cList);
        setSuppliers(sList);

        // Pre-select first customer if available
        if (cList.length > 0) {
          setPartyId((prev) => prev || cList[0].id);
        }
      } catch (err) {
        setFormError("Failed to load counterparties.");
      } finally {
        setLoadingParties(false);
      }
    }
    loadParties();
  }, []);

  // Whenever partyId changes, fetch their open invoices
  useEffect(() => {
    if (!partyId) {
      setOpenInvoices([]);
      return;
    }

    async function loadInvoices() {
      setLoadingInvoices(true);
      try {
        const list = await getOpenInvoicesForParty(partyId);
        setOpenInvoices(
          list.map((inv) => ({
            ...inv,
            allocated: 0,
          }))
        );
      } catch (err) {
        console.error("Failed to load open invoices", err);
      } finally {
        setLoadingInvoices(false);
      }
    }
    loadInvoices();
  }, [partyId]);

  // Calculations
  const totalAllocated = openInvoices.reduce(
    (sum, inv) => sum + (Number(inv.allocated) || 0),
    0
  );
  const roundedAllocated = Math.round(totalAllocated * 100) / 100;
  const unallocatedAmount = Math.max(0, Math.round((amount - roundedAllocated) * 100) / 100);
  const isOverAllocated = roundedAllocated > amount + 0.01;

  // Selected party object
  const currentPartyList = partyType === "customer" ? customers : suppliers;
  const selectedParty = currentPartyList.find((p) => p.id === partyId);

  // Handle party type toggle
  const handlePartyTypeChange = (newType: "customer" | "supplier") => {
    setPartyType(newType);
    const targetList = newType === "customer" ? customers : suppliers;
    if (targetList.length > 0) {
      setPartyId(targetList[0].id);
    } else {
      setPartyId("");
    }
  };

  // Handle individual row allocation change
  const handleAllocationChange = (index: number, val: number) => {
    setOpenInvoices((prev) => {
      const copy = [...prev];
      const inv = copy[index];
      const validVal = isNaN(val) ? 0 : Math.max(0, val);

      let rowError: string | undefined = undefined;
      if (validVal > inv.remaining_balance + 0.01) {
        rowError = `Cannot exceed remaining balance of ${formatINR(inv.remaining_balance)}`;
      }

      copy[index] = {
        ...inv,
        allocated: validVal,
        rowError,
      };
      return copy;
    });
  };

  // Auto Allocate using FIFO (First-In, First-Out by invoice date)
  const handleFIFOAutoAllocate = () => {
    if (amount <= 0) {
      setFormError("Please enter a payment amount first to auto-allocate.");
      return;
    }
    setFormError(null);

    let remainingToAllocate = amount;
    setOpenInvoices((prev) =>
      prev.map((inv) => {
        if (remainingToAllocate <= 0) {
          return { ...inv, allocated: 0, rowError: undefined };
        }

        const allocationForThis = Math.min(
          inv.remaining_balance,
          remainingToAllocate
        );
        const rounded = Math.round(allocationForThis * 100) / 100;
        remainingToAllocate = Math.max(0, Math.round((remainingToAllocate - rounded) * 100) / 100);

        return {
          ...inv,
          allocated: rounded,
          rowError: undefined,
        };
      })
    );
  };

  // Quick action: Pay single invoice in full
  const handlePayInFull = (index: number) => {
    setOpenInvoices((prev) => {
      const copy = [...prev];
      const inv = copy[index];

      // Calculate how much payment capacity is left
      const otherAllocations = copy
        .filter((_, idx) => idx !== index)
        .reduce((sum, item) => sum + item.allocated, 0);
      const remainingPaymentCapacity = Math.max(0, amount - otherAllocations);

      // If payment amount is already set, don't exceed remaining capacity unless payment amount is 0
      const targetAllocation =
        amount > 0
          ? Math.min(inv.remaining_balance, remainingPaymentCapacity)
          : inv.remaining_balance;

      copy[index] = {
        ...inv,
        allocated: targetAllocation,
        rowError: undefined,
      };
      return copy;
    });
  };

  // Clear all allocations
  const handleClearAllocations = () => {
    setOpenInvoices((prev) =>
      prev.map((inv) => ({ ...inv, allocated: 0, rowError: undefined }))
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    // Client-side validations
    if (!partyId) {
      setFormError("Please select a valid customer or supplier.");
      return;
    }

    if (amount <= 0) {
      setFormError("Payment amount must be greater than zero.");
      return;
    }

    if (isOverAllocated) {
      setFormError(
        `Total allocations (${formatINR(roundedAllocated)}) exceed total payment amount (${formatINR(amount)}).`
      );
      return;
    }

    // Check individual row errors
    const hasRowError = openInvoices.some(
      (inv) => inv.allocated > inv.remaining_balance + 0.01
    );
    if (hasRowError) {
      setFormError("One or more invoice allocations exceed the remaining balance.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Filter allocations with positive amounts
      const allocationsPayload = openInvoices
        .filter((inv) => inv.allocated > 0)
        .map((inv) => ({
          invoice_id: inv.id,
          allocated_amount: inv.allocated,
        }));

      const res = await recordPayment({
        party_type: partyType,
        party_id: partyId,
        amount,
        date,
        mode,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: allocationsPayload,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to record payment.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        `Payment of ${formatINR(amount)} recorded successfully! Redirecting...`
      );
      setTimeout(() => {
        router.push("/payments");
      }, 1200);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/payments"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Payments Register
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Record Payment & Allocation
          </h1>
          <p className="text-sm text-neutral-500">
            Record customer receipts or vendor disbursements with atomic multi-invoice allocation.
          </p>
        </div>

        {/* Financial Year & Compliance Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Single-Transaction ACID Enforced
          </span>
        </div>
      </div>

      {/* Error & Success Banners */}
      {formError && (
        <div className="p-4 rounded-xl bg-expense-50 border border-expense-200 text-expense-800 text-sm flex items-start gap-3 shadow-sm animate-fadeIn">
          <svg className="w-5 h-5 text-expense-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-bold text-expense-900">Payment Allocation Error</p>
            <p className="mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-income-50 border border-income-200 text-income-800 text-sm flex items-center gap-3 shadow-sm animate-fadeIn">
          <svg className="w-5 h-5 text-income-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Counterparty & Payment Meta */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-extrabold">
                1
              </span>
              Counterparty & Payment Details
            </h2>

            {/* Inward vs Outward Toggle */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => handlePartyTypeChange("customer")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  partyType === "customer"
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Customer (Inward)
              </button>
              <button
                type="button"
                onClick={() => handlePartyTypeChange("supplier")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  partyType === "supplier"
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Supplier (Outward)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Party Selector */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                Select {partyType === "customer" ? "Customer" : "Supplier"} *
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                disabled={loadingParties}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
              >
                {currentPartyList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `— GSTIN: ${p.gstin}` : "(Unregistered)"}
                  </option>
                ))}
              </select>
              {selectedParty && (
                <div className="flex items-center gap-4 text-[11px] text-neutral-500 pt-1">
                  <span>
                    State Code: <strong className="text-neutral-700">{selectedParty.state_code}</strong>
                  </span>
                  {selectedParty.billing_address && (
                    <span className="truncate max-w-[280px]">
                      {selectedParty.billing_address}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Payment Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                Payment Date *
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <CurrencyInput
                label="Payment Amount *"
                value={amount > 0 ? amount : ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>

            {/* Payment Mode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                Payment Mode *
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
              >
                <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                <option value="upi">UPI / QR</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                Reference / UTR / Cheque #
              </label>
              <Input
                placeholder="e.g. UTR98214488 / CHQ-10492"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                Notes / Narration
              </label>
              <Input
                placeholder="Optional remarks or ledger note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Invoices Allocation Table */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-extrabold">
                  2
                </span>
                Allocate Across Open Invoices
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Allocate payment to one or more finalized unpaid invoices. Unallocated amounts remain as an advance.
              </p>
            </div>

            {openInvoices.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFIFOAutoAllocate}
                >
                  Auto-Allocate (FIFO)
                </Button>
                <button
                  type="button"
                  onClick={handleClearAllocations}
                  className="text-xs font-semibold text-neutral-500 hover:text-expense-600 transition-colors px-2 py-1"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Allocation Progress & Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Total Payment Amount
              </span>
              <span className="text-base font-mono font-bold text-neutral-900">
                {formatINR(amount)}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Allocated to Invoices
              </span>
              <span
                className={`text-base font-mono font-bold ${
                  isOverAllocated ? "text-expense-600" : "text-brand-700"
                }`}
              >
                {formatINR(roundedAllocated)}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                Unallocated Advance
              </span>
              <span className="text-base font-mono font-bold text-income-700">
                {formatINR(unallocatedAmount)}
              </span>
            </div>

            {isOverAllocated && (
              <div className="sm:col-span-3 text-xs font-semibold text-expense-600 bg-expense-50 p-2 rounded-lg border border-expense-200">
                ⚠️ Over-allocation detected: Total allocated exceeds payment by{" "}
                {formatINR(roundedAllocated - amount)}.
              </div>
            )}
          </div>

          {/* Open Invoices Table */}
          {loadingInvoices ? (
            <div className="py-12 text-center text-sm text-neutral-500 animate-pulse">
              Loading open invoices for {selectedParty?.name}...
            </div>
          ) : openInvoices.length === 0 ? (
            <div className="py-10 text-center rounded-lg border border-dashed border-neutral-300 p-6">
              <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-neutral-800">No open finalized invoices</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                This counterparty has no pending invoices. Any payment recorded will be saved as an unallocated advance against their ledger.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                    <th className="py-3 px-3">Invoice # & Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Total (₹)</th>
                    <th className="py-3 px-3 text-right">Paid (₹)</th>
                    <th className="py-3 px-3 text-right">Remaining (₹)</th>
                    <th className="py-3 px-3 text-right w-44">Allocate (₹)</th>
                    <th className="py-3 px-3 text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-sm">
                  {openInvoices.map((inv, index) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-neutral-50/50 transition-colors ${
                        inv.allocated > 0 ? "bg-brand-50/30" : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-xs text-neutral-900 block">
                          {inv.invoice_no}
                        </span>
                        <span className="text-[11px] text-neutral-500 font-mono">
                          {inv.invoice_date}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            inv.type === "sales"
                              ? "bg-brand-50 text-brand-700"
                              : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {inv.type}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs text-neutral-700">
                        {formatINR(inv.total)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs text-neutral-500">
                        {formatINR(inv.paid_amount)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs font-bold text-neutral-900">
                        {formatINR(inv.remaining_balance)}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-neutral-400 text-xs font-mono select-none">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={inv.remaining_balance}
                            value={inv.allocated > 0 ? inv.allocated : ""}
                            onChange={(e) =>
                              handleAllocationChange(index, parseFloat(e.target.value))
                            }
                            placeholder="0.00"
                            className={`w-full h-8 pl-6 pr-2 text-right font-mono text-xs rounded-md border bg-white focus:outline-none focus:ring-1 ${
                              inv.rowError
                                ? "border-expense-500 focus:border-expense-500 focus:ring-expense-200"
                                : "border-neutral-300 focus:border-brand-500 focus:ring-brand-200"
                            }`}
                          />
                        </div>
                        {inv.rowError && (
                          <p className="text-[10px] text-expense-600 font-semibold mt-1">
                            {inv.rowError}
                          </p>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handlePayInFull(index)}
                          className="text-xs font-bold text-brand-700 hover:text-brand-900 hover:underline px-1.5 py-0.5 rounded transition-colors"
                        >
                          Pay Full
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
          <Link href="/payments">
            <Button type="button" variant="outline" size="md">
              Cancel
            </Button>
          </Link>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting || amount <= 0 || isOverAllocated}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            Save & Allocate Payment
          </Button>
        </div>
      </form>
    </div>
  );
}
