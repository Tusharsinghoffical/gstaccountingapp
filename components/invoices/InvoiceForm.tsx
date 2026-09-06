"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Customer, Supplier, PURCHASE_INVOICE_CATEGORIES, PurchaseInvoiceCategory } from "@/types";
import { calculateInvoiceTaxes, LineItemInput } from "@/lib/tax";
import { formatINR } from "@/lib/format";
import { Button, Input } from "@/components/ui";
import { STATE_CODE_MAP } from "@/lib/constants/states";

export interface InvoiceFormProps {
  customers: Customer[];
  suppliers: Supplier[];
  businessStateCode?: string;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  customers,
  suppliers,
  businessStateCode = "27", // Maharashtra default
}) => {
  const router = useRouter();

  // Invoice Header State
  const [invoiceType, setInvoiceType] = useState<"sales" | "purchase">("sales");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [category, setCategory] = useState<PurchaseInvoiceCategory | "">("");
  const [suggestedCategory, setSuggestedCategory] = useState<PurchaseInvoiceCategory | null>(null);
  const [suggestionConfidence, setSuggestionConfidence] = useState<number | null>(null);
  const [suggestionExplanation, setSuggestionExplanation] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // Dynamic Line Items State
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    {
      description: "Consulting / Professional Services",
      hsn_code: "998311",
      qty: 1,
      rate: 10000,
      discount: 0,
      gst_rate: 18,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default selected party when type changes
  useEffect(() => {
    const list = invoiceType === "sales" ? customers : suppliers;
    if (list.length > 0 && !list.some((p) => p.id === selectedPartyId)) {
      setSelectedPartyId(list[0].id);
    }
  }, [invoiceType, customers, suppliers, selectedPartyId]);

  // Find currently selected party
  const partyList = invoiceType === "sales" ? customers : suppliers;
  const selectedParty = partyList.find((p) => p.id === selectedPartyId);
  const partyStateCode = selectedParty?.state_code || businessStateCode;

  // Live client-side tax computation
  const taxSummary = calculateInvoiceTaxes(
    businessStateCode,
    partyStateCode,
    lineItems
  );

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: "",
        hsn_code: "998311",
        qty: 1,
        rate: 0,
        discount: 0,
        gst_rate: 18,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItemInput,
    value: any
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSuggestCategory = async () => {
    if (invoiceType !== "purchase") return;
    const vendor = selectedParty?.name || "";
    const items = lineItems.map((it) => ({ description: it.description }));
    if (!vendor && items.length === 0) return;

    setIsClassifying(true);
    try {
      const res = await fetch("/api/invoices/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_name: vendor, line_items: items }),
      });
      const data = await res.json();
      if (data.success && data.category) {
        setSuggestedCategory(data.category);
        setSuggestionConfidence(data.confidence || null);
        setSuggestionExplanation(data.explanation || null);
        // CRITICAL INVARIANT: NEVER auto-apply category!
        // category state remains untouched until user clicks the suggestion chip.
      }
    } catch (classifyErr) {
      console.warn("Failed to retrieve category suggestion:", classifyErr);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId) {
      setErrorMsg("Please select a counterparty");
      return;
    }

    if (lineItems.length === 0) {
      setErrorMsg("Invoice must have at least one line item");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // POST to Route Handler which recalculates taxes server-side
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: invoiceType,
          customer_or_supplier_id: selectedPartyId,
          invoice_date: invoiceDate,
          due_date: dueDate || undefined,
          category: invoiceType === "purchase" && category ? category : undefined,
          notes: notes || undefined,
          items: lineItems,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save invoice");
      }

      router.push("/invoices");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
            Create Tax Invoice
          </h1>
          <p className="text-sm text-neutral-500">
            GST compliant invoicing with automated intra/inter-state tax splitting.
          </p>
        </div>

        {/* Invoice Type Toggle */}
        <div className="inline-flex rounded-xl p-1 bg-neutral-200/80 border border-neutral-300">
          <button
            type="button"
            onClick={() => setInvoiceType("sales")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              invoiceType === "sales"
                ? "bg-white text-brand-700 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Sales Invoice
          </button>
          <button
            type="button"
            onClick={() => setInvoiceType("purchase")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              invoiceType === "purchase"
                ? "bg-white text-brand-700 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Purchase Invoice
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-expense-50 border border-expense-200 text-expense-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Invoice Meta Grid */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card space-y-6">
        <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider text-neutral-400">
          Invoice Details & Counterparty
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Party Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
              {invoiceType === "sales" ? "Customer (Buyer)" : "Supplier (Vendor)"}{" "}
              <span className="text-expense-500">*</span>
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            >
              {partyList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.state_code} - {STATE_CODE_MAP[p.state_code] || "State"})
                </option>
              ))}
            </select>
            {selectedParty?.gstin && (
              <p className="text-[11px] font-mono text-neutral-500">
                GSTIN: {selectedParty.gstin}
              </p>
            )}
          </div>

          {/* Invoice Date */}
          <Input
            label="Invoice Date"
            type="date"
            required
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />

          {/* Due Date */}
          <Input
            label="Payment Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Purchase Category & AI Suggestion Block (Prompt 20) */}
        {invoiceType === "purchase" && (
          <div className="pt-4 border-t border-neutral-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="w-full sm:w-1/2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                    Expense Category (Purchase Invoice)
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestCategory}
                    disabled={isClassifying}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors inline-flex items-center gap-1"
                  >
                    {isClassifying ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Groq AI Analyzing...
                      </>
                    ) : (
                      <>✨ Suggest with Groq AI</>
                    )}
                  </button>
                </div>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as PurchaseInvoiceCategory | "")
                  }
                  className="w-full h-10 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="">-- Select Category (Optional) --</option>
                  {PURCHASE_INVOICE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* AI Suggestion Chip Banner */}
              <div className="w-full sm:w-1/2">
                {suggestedCategory ? (
                  <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                        <span>✨</span> AI Suggestion
                      </span>
                      {suggestionConfidence && (
                        <span className="text-[10px] font-mono text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                          {Math.round(suggestionConfidence * 100)}% match
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCategory(suggestedCategory)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
                          category === suggestedCategory
                            ? "bg-purple-700 text-white ring-2 ring-purple-400"
                            : "bg-white text-purple-700 border border-purple-300 hover:bg-purple-100 hover:border-purple-400"
                        }`}
                      >
                        <span>{suggestedCategory}</span>
                        {category === suggestedCategory ? (
                          <span className="text-[10px] bg-purple-800/60 px-1.5 py-0.5 rounded text-purple-100">
                            ✓ Accepted
                          </span>
                        ) : (
                          <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                            Click to Accept
                          </span>
                        )}
                      </button>

                      {category === suggestedCategory && (
                        <button
                          type="button"
                          onClick={() => setCategory("")}
                          className="text-[10px] text-neutral-500 hover:text-neutral-700 underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-purple-700 leading-tight">
                      Never auto-applied: Click chip to accept, or choose manually from dropdown.
                    </p>
                    {suggestionExplanation && (
                      <p className="text-[10px] text-neutral-500 italic">
                        &quot;{suggestionExplanation}&quot;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="h-full min-h-[72px] flex items-center justify-center p-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400 text-xs">
                    Click &ldquo;✨ Suggest with Groq AI&rdquo; to classify based on vendor and items.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Line Items Table */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-card overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              Line Items
            </h2>
            <p className="text-xs text-neutral-500">
              Enter goods or services, HSN/SAC codes, and applicable GST slabs.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addLineItem}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                <th className="px-4 py-3 min-w-[220px]">Item Description</th>
                <th className="px-4 py-3 w-28">HSN/SAC</th>
                <th className="px-4 py-3 w-24 text-right">Qty</th>
                <th className="px-4 py-3 w-32 text-right">Rate (₹)</th>
                <th className="px-4 py-3 w-28 text-center">GST %</th>
                <th className="px-4 py-3 w-32 text-right">Amount (₹)</th>
                <th className="px-2 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lineItems.map((item, index) => {
                const calculated = taxSummary.items[index];
                return (
                  <tr key={index} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        required
                        placeholder="Description of goods or service"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(index, "description", e.target.value)
                        }
                        className="w-full h-9 rounded-lg border border-neutral-300 px-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        required
                        placeholder="HSN"
                        value={item.hsn_code}
                        onChange={(e) =>
                          updateLineItem(index, "hsn_code", e.target.value)
                        }
                        className="w-full h-9 rounded-lg border border-neutral-300 px-2.5 text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.qty}
                        onChange={(e) =>
                          updateLineItem(index, "qty", parseFloat(e.target.value) || 0)
                        }
                        className="w-full h-9 rounded-lg border border-neutral-300 px-2.5 text-xs font-mono text-right text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) =>
                          updateLineItem(index, "rate", parseFloat(e.target.value) || 0)
                        }
                        className="w-full h-9 rounded-lg border border-neutral-300 px-2.5 text-xs font-mono text-right text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.gst_rate}
                        onChange={(e) =>
                          updateLineItem(
                            index,
                            "gst_rate",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full h-9 rounded-lg border border-neutral-300 px-2 text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value={0}>0% (Nil)</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-bold text-xs text-neutral-900">
                        {formatINR(calculated ? calculated.amount : 0)}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-neutral-400 hover:text-expense-600 transition-colors p-1"
                          title="Remove row"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Section: Notes & Live Tax Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Notes */}
        <div className="lg:col-span-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card space-y-2">
          <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
            Invoice Remarks / Payment Terms
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment due within 30 days. Transfer to Bank A/C..."
            className="w-full rounded-xl border border-neutral-300 p-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Right: Live Tax Summary Panel */}
        <div className="lg:col-span-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h3 className="text-sm font-bold text-neutral-900">
              Tax Computation Summary
            </h3>

            {/* Place of Supply Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                taxSummary.isIntraState
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  taxSummary.isIntraState ? "bg-emerald-500" : "bg-indigo-500"
                }`}
              />
              <span>
                {taxSummary.isIntraState
                  ? `Intra-State (${businessStateCode} ↔ ${partyStateCode})`
                  : `Inter-State (${businessStateCode} ↔ ${partyStateCode})`}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>Subtotal (Taxable Value):</span>
              <span className="font-mono font-semibold text-neutral-900">
                {formatINR(taxSummary.subtotal)}
              </span>
            </div>

            {taxSummary.isIntraState ? (
              <>
                <div className="flex justify-between text-neutral-700">
                  <span>Central GST (CGST):</span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {formatINR(taxSummary.cgst)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-700">
                  <span>State GST (SGST):</span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {formatINR(taxSummary.sgst)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-neutral-700">
                <span>Integrated GST (IGST):</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {formatINR(taxSummary.igst)}
                </span>
              </div>
            )}

            <div className="border-t border-neutral-200 pt-3 flex justify-between text-base font-bold text-neutral-900">
              <span>Grand Total:</span>
              <span className="font-mono text-brand-700 text-lg">
                {formatINR(taxSummary.total)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/invoices")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            >
              Save & Finalize Invoice
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
