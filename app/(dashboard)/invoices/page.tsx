"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Invoice } from "@/types";
import {
  getInvoices,
  transitionInvoiceStatus,
  createCreditDebitNote,
} from "@/app/actions/invoices";
import { DataTable, Column, Button, Input, StatusBadge } from "@/components/ui";
import { formatINR } from "@/lib/format";

type InvoiceWithParty = Invoice & { party_name: string };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithParty[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "sales" | "purchase" | "credit_note" | "debit_note"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "final" | "cancelled"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Credit / Debit Note Modal State
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<InvoiceWithParty | null>(null);
  const [noteType, setNoteType] = useState<"credit_note" | "debit_note">("credit_note");
  const [noteReason, setNoteReason] = useState("");
  const [noteAmount, setNoteAmount] = useState<number>(0);
  const [noteDescription, setNoteDescription] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getInvoices();
        setInvoices(data as InvoiceWithParty[]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleStatusChange = async (
    invoiceId: string,
    newStatus: Invoice["status"]
  ) => {
    setActionError(null);
    try {
      const res = await transitionInvoiceStatus(invoiceId, newStatus);
      if (!res.success) {
        setActionError(res.error || "Failed to update status");
        return;
      }
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: newStatus } : inv
        )
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Error transitioning invoice status"
      );
    }
  };

  const handleOpenNoteModal = (
    inv: InvoiceWithParty,
    type: "credit_note" | "debit_note"
  ) => {
    setTargetInvoice(inv);
    setNoteType(type);
    setNoteReason(
      type === "credit_note" ? "Post-sale discount / price revision" : "Additional service adjustment"
    );
    setNoteDescription(
      type === "credit_note"
        ? `Credit adjustment for ${inv.invoice_no}`
        : `Debit adjustment for ${inv.invoice_no}`
    );
    setNoteAmount(Math.round(inv.subtotal * 0.1)); // Default 10%
    setNoteModalOpen(true);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoice || noteAmount <= 0) return;

    setIsSubmittingNote(true);
    setActionError(null);

    try {
      const res = await createCreditDebitNote({
        original_invoice_id: targetInvoice.id,
        type: noteType,
        note_date: new Date().toISOString().split("T")[0],
        reason: noteReason,
        items: [
          {
            description: noteDescription,
            hsn_code: "998311",
            qty: 1,
            rate: noteAmount,
            discount: 0,
            gst_rate: 18,
          },
        ],
      });

      if (!res.success) {
        setActionError(res.error || "Failed to create note");
      } else {
        const updatedInvoices = await getInvoices();
        setInvoices(updatedInvoices as InvoiceWithParty[]);
        setNoteModalOpen(false);
      }
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      inv.party_name.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || inv.type === typeFilter;
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const columns: Column<InvoiceWithParty>[] = [
    {
      header: "Invoice #",
      accessorKey: "invoice_no",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-neutral-900">
            {row.invoice_no}
          </span>
          {row.status === "final" && (
            <span
              title="Immutable: locked against direct editing at DB engine level"
              className="inline-flex items-center text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded text-[10px] font-medium"
            >
              <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Locked
            </span>
          )}
          {row.original_invoice_id && (
            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-mono">
              Ref: {row.original_invoice_id.substring(0, 8)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Counterparty",
      accessorKey: "party_name",
      render: (row) => (
        <div>
          <div className="font-semibold text-neutral-900">{row.party_name}</div>
          <div className="text-[11px] font-mono text-neutral-400 capitalize">
            {row.type === "credit_note"
              ? "Credit Note"
              : row.type === "debit_note"
              ? "Debit Note"
              : `${row.type} Invoice`}{" "}
            · {row.financial_year}
            {row.category && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded ml-1.5">
                🏷️ {row.category}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Date",
      accessorKey: "invoice_date",
      render: (row) => (
        <span className="font-mono text-xs text-neutral-600">
          {row.invoice_date}
        </span>
      ),
    },
    {
      header: "Taxable Value",
      align: "right",
      accessorKey: "subtotal",
      render: (row) => (
        <span className="font-mono text-xs text-neutral-600">
          {formatINR(row.subtotal)}
        </span>
      ),
    },
    {
      header: "GST Tax",
      align: "right",
      render: (row) => {
        const taxTotal = (row.cgst || 0) + (row.sgst || 0) + (row.igst || 0);
        return (
          <div className="text-right">
            <span className="font-mono font-semibold text-xs text-brand-700">
              {formatINR(taxTotal)}
            </span>
            <div className="text-[10px] text-neutral-400">
              {row.igst > 0 ? "IGST" : "CGST + SGST"}
            </div>
          </div>
        );
      },
    },
    {
      header: "Total (₹)",
      align: "right",
      accessorKey: "total",
      render: (row) => (
        <span className="font-mono font-bold text-sm text-neutral-900">
          {formatINR(row.total)}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      accessorKey: "status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Actions",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          {row.status === "draft" && (
            <>
              <button
                type="button"
                onClick={() => handleStatusChange(row.id, "final")}
                className="px-2 py-1 text-xs font-medium rounded bg-income-50 text-income-700 hover:bg-income-100 transition-colors"
              >
                Finalize
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(row.id, "cancelled")}
                className="px-2 py-1 text-xs font-medium rounded bg-neutral-100 text-neutral-600 hover:bg-expense-50 hover:text-expense-700 transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {row.status === "final" && (
            <>
              <a
                href={`/api/invoices/${row.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                title="Export GST Rule 46 Compliant PDF"
                className="px-2 py-1 text-[11px] font-semibold rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors inline-flex items-center gap-1"
              >
                <svg className="w-3 h-3 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </a>
              <button
                type="button"
                title="Create Credit Note to reduce taxable value or tax"
                onClick={() => handleOpenNoteModal(row, "credit_note")}
                className="px-2 py-1 text-[11px] font-semibold rounded bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
              >
                + CN
              </button>
              <button
                type="button"
                title="Create Debit Note for upward adjustment"
                onClick={() => handleOpenNoteModal(row, "debit_note")}
                className="px-2 py-1 text-[11px] font-semibold rounded bg-warning-50 text-warning-700 hover:bg-warning-100 transition-colors"
              >
                + DN
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(row.id, "cancelled")}
                className="px-1.5 py-1 text-[11px] font-medium rounded text-neutral-400 hover:text-expense-600 transition-colors"
                title="Cancel finalized invoice (only allowed without altering financial details)"
              >
                Cancel
              </button>
            </>
          )}

          {row.status === "cancelled" && (
            <span className="text-[11px] text-neutral-400 font-medium">
              Terminal
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Invoices & Adjustments
          </h1>
          <p className="text-sm text-neutral-500">
            GST-compliant invoicing with database-enforced immutability and credit/debit note linking.
          </p>
        </div>

        <Link href="/invoices/new">
          <Button
            variant="primary"
            size="sm"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Create Invoice
          </Button>
        </Link>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-expense-50 border border-expense-200 text-expense-800 text-sm flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-expense-500 hover:text-expense-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-card flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search invoice # or party..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftPrefix={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All Types"],
                ["sales", "Sales"],
                ["purchase", "Purchase"],
                ["credit_note", "Credit Notes"],
                ["debit_note", "Debit Notes"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === t
                    ? "bg-brand-50 text-brand-700 border border-brand-200"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
          <span className="text-xs text-neutral-400 font-medium mr-1">Status:</span>
          {(
            [
              ["all", "All Statuses"],
              ["draft", "Draft"],
              ["final", "Final (Locked)"],
              ["cancelled", "Cancelled"],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices DataTable */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No invoices found"
        emptyDescription="Create your first GST invoice or issue a credit/debit note against a finalized bill."
        emptyAction={{
          label: "Create Invoice",
          onClick: () => (window.location.href = "/invoices/new"),
        }}
      />

      {/* Issue Credit / Debit Note Modal */}
      {noteModalOpen && targetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">
                  Issue {noteType === "credit_note" ? "Credit Note (CN)" : "Debit Note (DN)"}
                </h3>
                <p className="text-xs text-neutral-500 font-mono">
                  Referencing Invoice: {targetInvoice.invoice_no}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Party:</span>
                  <span className="font-semibold text-neutral-800">{targetInvoice.party_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Original Invoice Total:</span>
                  <span className="font-mono font-bold text-neutral-800">{formatINR(targetInvoice.total)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={noteReason}
                  onChange={(e) => setNoteReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Rate revision discount, quantity difference"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Line Item Description *
                </label>
                <input
                  type="text"
                  required
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Taxable Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  value={noteAmount || ""}
                  onChange={(e) => setNoteAmount(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  GST will be automatically calculated server-side based on the counterparty state code.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNoteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmittingNote}
                >
                  Confirm & Issue Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
