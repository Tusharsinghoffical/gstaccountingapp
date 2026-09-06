"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import {
  createInvoice,
  findOrCreateSupplierForOCR,
} from "@/app/actions/invoices";
import { getSuppliers } from "@/app/actions/parties";
import { calculateInvoiceTaxes, LineItemInput } from "@/lib/tax";
import { formatINR } from "@/lib/format";
import { STATE_CODE_MAP } from "@/lib/constants/states";
import { validateGSTIN } from "@/lib/validation/gstin";
import { Supplier, PURCHASE_INVOICE_CATEGORIES, PurchaseInvoiceCategory } from "@/types";
import { StructuredInvoiceData } from "@/lib/validation/ocr";

// Default realistic sample for direct navigation or preview fallback
const DEFAULT_SAMPLE_INVOICE: StructuredInvoiceData = {
  vendor_name: "Bharat Enterprises",
  vendor_gstin: "27AAPFU0939F1ZV",
  invoice_number: "INV/2024-25/0001",
  invoice_date: "2024-04-15",
  line_items: [
    {
      description: "IT Software Advisory Services",
      hsn: "998311",
      qty: 1,
      rate: 122881.36,
      gst_rate: 18,
    },
  ],
  total_amount: 145000,
};

export default function OCRReviewPage() {
  const router = useRouter();

  // Review Form State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorGstin, setVendorGstin] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [category, setCategory] = useState<PurchaseInvoiceCategory | "">("");
  const [suggestedCategory, setSuggestedCategory] = useState<PurchaseInvoiceCategory | null>(null);
  const [suggestionConfidence, setSuggestionConfidence] = useState<number | null>(null);
  const [suggestionExplanation, setSuggestionExplanation] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);

  // Source Document Viewer State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("tax_invoice_sample.pdf");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"split" | "document" | "form">("split");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const businessStateCode = "27"; // Maharashtra default

  // Load suppliers and extracted OCR payload from sessionStorage
  useEffect(() => {
    async function initData() {
      try {
        const loadedSuppliers = await getSuppliers();
        setSuppliers(loadedSuppliers);

        let extracted = DEFAULT_SAMPLE_INVOICE;
        const stored = sessionStorage.getItem("gst_ocr_pending_invoice");

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.structuredData) {
              extracted = parsed.structuredData;
            }
            if (parsed.fileUrl) {
              setPreviewUrl(parsed.fileUrl);
            }
            if (parsed.fileName) {
              setFileName(parsed.fileName);
            }
          } catch (e) {
            console.warn("Could not parse stored OCR payload, using default:", e);
          }
        }

        // Initialize editable form fields from extracted JSON
        setVendorName(extracted.vendor_name || "");
        setVendorGstin(extracted.vendor_gstin || "");
        setInvoiceNumber(extracted.invoice_number || "");
        setInvoiceDate(extracted.invoice_date || new Date().toISOString().split("T")[0]);

        // Calculate default 30-day due date
        const d = new Date(extracted.invoice_date || Date.now());
        d.setDate(d.getDate() + 30);
        setDueDate(d.toISOString().split("T")[0]);

        // Map line items to editable format
        const initialItems: LineItemInput[] = (extracted.line_items || []).map((item) => ({
          description: item.description,
          hsn_code: item.hsn,
          qty: item.qty || 1,
          rate: item.rate || 0,
          discount: 0,
          gst_rate: item.gst_rate || 18,
        }));

        setLineItems(
          initialItems.length > 0
            ? initialItems
            : [
                {
                  description: "General Supplies / Services",
                  hsn_code: "998311",
                  qty: 1,
                  rate: 10000,
                  discount: 0,
                  gst_rate: 18,
                },
              ]
        );

        // Auto-match existing supplier by GSTIN
        if (extracted.vendor_gstin) {
          const match = loadedSuppliers.find(
            (s) => s.gstin === extracted.vendor_gstin.trim().toUpperCase()
          );
          if (match) {
            setSelectedSupplierId(match.id);
          }
        }

        // Trigger AI Category Classification in background
        // NEVER auto-applies: Only provides suggestion for the user to explicitly accept
        fetchCategorySuggestion(
          extracted.vendor_name || "",
          initialItems
        );
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }

    initData();
  }, []);

  const fetchCategorySuggestion = async (
    vendor: string,
    items: LineItemInput[]
  ) => {
    if (!vendor && items.length === 0) return;
    setIsClassifying(true);
    try {
      const res = await fetch("/api/invoices/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_name: vendor,
          line_items: items.map((it) => ({ description: it.description })),
        }),
      });
      const data = await res.json();
      if (data.success && data.category) {
        setSuggestedCategory(data.category);
        setSuggestionConfidence(data.confidence || null);
        setSuggestionExplanation(data.explanation || null);
        // STRICT REQUIREMENT: NEVER auto-apply category!
        // category state remains empty until user explicitly clicks the suggestion chip.
      }
    } catch (err) {
      console.warn("Failed to classify invoice category:", err);
    } finally {
      setIsClassifying(false);
    }
  };

  // Determine counterparty state code from GSTIN or selected supplier
  const counterpartyStateCode = useMemo(() => {
    if (vendorGstin && vendorGstin.length >= 2) {
      const code = vendorGstin.substring(0, 2);
      if (STATE_CODE_MAP[code]) return code;
    }
    const s = suppliers.find((sup) => sup.id === selectedSupplierId);
    return s ? s.state_code : "27";
  }, [vendorGstin, selectedSupplierId, suppliers]);

  // Live tax calculation (identical to manual invoice creation logic)
  const taxSummary = useMemo(() => {
    return calculateInvoiceTaxes(
      businessStateCode,
      counterpartyStateCode,
      lineItems
    );
  }, [businessStateCode, counterpartyStateCode, lineItems]);

  // GSTIN format validation check
  const gstinValidation = useMemo(() => {
    if (!vendorGstin) return { isValid: false, error: "GSTIN is required" };
    return validateGSTIN(vendorGstin);
  }, [vendorGstin]);

  // Line item manipulation
  const updateLineItem = (
    index: number,
    field: keyof LineItemInput,
    value: string | number
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
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
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submission handler through the single validated manual write path
  const handleConfirmAndSave = async (status: "final" | "draft" = "final") => {
    setErrorMessage(null);
    setValidationErrors({});

    // 1. Client pre-validation
    const errors: Record<string, string> = {};
    if (!vendorName.trim()) errors.vendorName = "Vendor name is required.";
    if (!vendorGstin.trim()) {
      errors.vendorGstin = "Vendor GSTIN is required.";
    } else if (!gstinValidation.isValid) {
      errors.vendorGstin = gstinValidation.error || "Invalid 15-character GSTIN.";
    }
    if (!invoiceNumber.trim()) errors.invoiceNumber = "Invoice number is required.";
    if (!invoiceDate.trim()) errors.invoiceDate = "Invoice date is required.";

    if (lineItems.length === 0) {
      errors.lineItems = "At least one line item is required.";
    } else {
      lineItems.forEach((item, idx) => {
        if (!item.description.trim()) {
          errors[`item_${idx}_desc`] = `Line ${idx + 1}: Description required.`;
        }
        if (!item.hsn_code.trim()) {
          errors[`item_${idx}_hsn`] = `Line ${idx + 1}: HSN/SAC code required.`;
        }
        if (item.qty <= 0) {
          errors[`item_${idx}_qty`] = `Line ${idx + 1}: Quantity must be > 0.`;
        }
        if (item.rate < 0) {
          errors[`item_${idx}_rate`] = `Line ${idx + 1}: Rate cannot be negative.`;
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMessage("Please correct the highlighted errors before confirming.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Resolve Supplier (find existing or register through validated supplier write path)
      let supplierId = selectedSupplierId;

      if (!supplierId || supplierId === "new") {
        const resolvedSupplier = await findOrCreateSupplierForOCR({
          name: vendorName.trim(),
          gstin: vendorGstin.trim().toUpperCase(),
          stateCode: counterpartyStateCode,
          address: "Address as per scanned document",
        });
        supplierId = resolvedSupplier.id;
      }

      // 3. Invoke unified manual invoice write path: createInvoice (Prompt 10)
      // Enforces createInvoiceSchema, calculates deterministic tax math,
      // and records the supplier ledger entry.
      const invoicePayload = {
        type: "purchase" as const,
        status,
        customer_or_supplier_id: supplierId,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        category: category || undefined,
        notes: notes ? `${notes} [Scanned from: ${fileName}]` : `[Scanned from: ${fileName}]`,
        items: lineItems.map((item) => ({
          description: item.description.trim(),
          hsn_code: item.hsn_code.trim(),
          qty: Number(item.qty),
          rate: Number(item.rate),
          discount: Number(item.discount || 0),
          gst_rate: Number(item.gst_rate),
        })),
      };

      const result = await createInvoice(invoicePayload);

      if (!result.success || !result.data) {
        setErrorMessage(result.error || "Failed to create purchase invoice.");
        setIsSubmitting(false);
        return;
      }

      // Clear session store after successful invoice creation
      sessionStorage.removeItem("gst_ocr_pending_invoice");

      // Redirect to Invoices dashboard
      router.push("/invoices");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while saving the invoice."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-[1600px] mx-auto">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/ocr"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to OCR Upload
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-xs font-semibold text-brand-600">Review & Confirm</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mt-1">
            OCR Invoice Review
          </h1>
        </div>

        {/* View Layout Switcher (for small screens) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 border border-neutral-200 lg:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("document")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "document"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Source Document
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "form"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Editable Form
          </button>
        </div>
      </div>

      {/* PERSISTENT VISUAL BANNER (Mandatory UX requirement) */}
      <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 shadow-sm flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
              Review extracted data — nothing is saved yet
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 uppercase">
              Pre-Commit Preview
            </span>
          </div>
          <p className="text-xs text-amber-900 mt-1 leading-relaxed">
            Data has been extracted via Groq LLM and validated with Zod. Verify all vendor details, GSTIN, HSN codes, and amounts against the pinned source document on the left before confirming. No ledger entries or purchase invoices are written until you submit this form.
          </p>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: Pinned Source Document Viewer (6 cols) */}
        <div
          className={`lg:col-span-6 space-y-3 ${
            activeTab === "form" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Source Document
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-neutral-100 text-neutral-600 border border-neutral-200">
                {fileName}
              </span>
            </div>

            {/* Viewer Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-colors"
                title="Zoom Out"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-[11px] font-mono text-neutral-500 w-10 text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-colors"
                title="Zoom In"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-colors ml-1"
                title="Rotate 90°"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Document Container */}
          <div className="relative rounded-2xl border-2 border-neutral-200 bg-neutral-900 overflow-hidden shadow-card lg:sticky lg:top-6 min-h-[560px] max-h-[calc(100vh-140px)] flex flex-col items-center justify-center">
            {previewUrl ? (
              <div
                className="w-full h-full overflow-auto p-4 flex items-center justify-center transition-all duration-200"
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Scanned Invoice"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </div>
            ) : (
              /* Simulated Document Preview when no local image file is selected */
              <div
                className="w-full max-w-md bg-white text-neutral-900 rounded-xl p-6 shadow-2xl space-y-4 m-4 transition-all duration-200 select-text"
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <div className="border-b-2 border-neutral-800 pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wider text-neutral-900">
                      TAX INVOICE
                    </h2>
                    <p className="text-xs font-bold text-neutral-700 mt-1">
                      {vendorName || "Bharat Enterprises"}
                    </p>
                    <p className="text-[11px] font-mono text-neutral-600">
                      GSTIN: {vendorGstin || "27AAPFU0939F1ZV"}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold text-neutral-900">
                      Inv #{invoiceNumber || "INV/2024-25/0001"}
                    </p>
                    <p className="text-neutral-500 text-[11px]">
                      Date: {invoiceDate || "2024-04-15"}
                    </p>
                  </div>
                </div>

                <div className="text-xs space-y-1 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                  <span className="font-bold text-[10px] text-neutral-500 uppercase">
                    Billed To:
                  </span>
                  <p className="font-semibold text-neutral-900">Mahalaxmi Trading Co</p>
                  <p className="font-mono text-neutral-600 text-[11px]">
                    Place of Supply: {counterpartyStateCode} - {STATE_CODE_MAP[counterpartyStateCode] || "Maharashtra"}
                  </p>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-neutral-200 text-neutral-500">
                    <tr>
                      <th className="py-1">Description</th>
                      <th className="py-1">HSN</th>
                      <th className="py-1 text-right">Qty</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td className="py-1.5 font-sans font-medium text-neutral-800">
                          {item.description || "Line Item"}
                        </td>
                        <td className="py-1.5 text-neutral-600">{item.hsn_code}</td>
                        <td className="py-1.5 text-right">{item.qty}</td>
                        <td className="py-1.5 text-right">₹{item.rate}</td>
                        <td className="py-1.5 text-right font-bold">
                          ₹{(item.qty * item.rate).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-neutral-800 pt-2 flex justify-between items-center text-xs">
                  <span className="font-bold uppercase tracking-wider">Gross Total:</span>
                  <span className="font-black text-sm text-brand-600">
                    {formatINR(taxSummary.total)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Fully Editable Invoice Form (6 cols) */}
        <div
          className={`lg:col-span-6 space-y-6 ${
            activeTab === "document" ? "hidden lg:block" : "block"
          }`}
        >
          {errorMessage && (
            <div className="p-4 rounded-xl bg-expense-50 border border-expense-200 text-expense-900 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-expense-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-white border border-neutral-200 shadow-card space-y-6">
            {/* Section 1: Vendor / Supplier Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-600" />
                  1. Vendor & Counterparty Details
                </h3>
                <span className="text-[11px] text-neutral-400">Pre-filled via OCR</span>
              </div>

              {/* Match Existing Supplier Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Link to Existing Supplier (or create new)
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedSupplierId(id);
                    const matched = suppliers.find((s) => s.id === id);
                    if (matched) {
                      setVendorName(matched.name);
                      if (matched.gstin) setVendorGstin(matched.gstin);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white text-neutral-900"
                >
                  <option value="">-- Create new supplier from extracted fields --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.gstin || "Unregistered"} - {STATE_CODE_MAP[s.state_code] || s.state_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Vendor / Legal Business Name *"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Bharat Enterprises"
                  error={validationErrors.vendorName}
                />

                <div>
                  <Input
                    label="Vendor GSTIN (15 Characters) *"
                    value={vendorGstin}
                    onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AAPFU0939F1ZV"
                    maxLength={15}
                    error={validationErrors.vendorGstin}
                  />
                  {vendorGstin && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                      {gstinValidation.isValid ? (
                        <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Valid GSTIN ({STATE_CODE_MAP[counterpartyStateCode] || counterpartyStateCode})
                        </span>
                      ) : (
                        <span className="text-expense-600 font-medium">
                          {gstinValidation.error}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Invoice Metadata */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-600" />
                  2. Invoice Metadata & Dates
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Invoice Number *"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV/2024-25/0001"
                  error={validationErrors.invoiceNumber}
                />

                <Input
                  label="Invoice Date *"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  error={validationErrors.invoiceDate}
                />

                <Input
                  label="Payment Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <Input
                label="Notes / Description (Optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add purchase notes or reference PO number..."
              />

              {/* Purchase Category & AI Suggestion Block (Prompt 20) */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="w-full sm:w-1/2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-neutral-700 tracking-wide">
                        Purchase Expense Category
                      </label>
                      <button
                        type="button"
                        onClick={() => fetchCategorySuggestion(vendorName, lineItems)}
                        disabled={isClassifying}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors inline-flex items-center gap-1"
                      >
                        {isClassifying ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Re-analyzing with Groq...
                          </>
                        ) : (
                          <>✨ Re-classify with Groq</>
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

                  {/* Suggestion Chip Card */}
                  <div className="w-full sm:w-1/2">
                    {suggestedCategory ? (
                      <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                            <span>✨</span> AI Suggestion Chip
                          </span>
                          {suggestionConfidence && (
                            <span className="text-[10px] font-mono text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded">
                              {Math.round(suggestionConfidence * 100)}% match
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCategory(suggestedCategory)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
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

                        <p className="text-[10px] text-purple-800 leading-tight">
                          Review extracted data — suggestions are never auto-applied. Click chip to accept.
                        </p>
                        {suggestionExplanation && (
                          <p className="text-[10px] text-neutral-500 italic">
                            &quot;{suggestionExplanation}&quot;
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="h-full min-h-[72px] flex items-center justify-center p-3 rounded-xl border border-dashed border-neutral-200 bg-white text-neutral-400 text-xs">
                        {isClassifying ? (
                          <span className="flex items-center gap-2 text-purple-600">
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Classifying vendor &amp; items with Groq AI...
                          </span>
                        ) : (
                          <span>Click &ldquo;✨ Re-classify with Groq&rdquo; to analyze this invoice.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Dynamic Line Items Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-600" />
                    3. Line Items & HSN Breakdown
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Review extracted line items. You can edit quantities, rates, and GST rate slabs.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  leftIcon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Add Row
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold min-w-[180px]">Description *</th>
                      <th className="px-2 py-2.5 font-semibold w-24">HSN/SAC *</th>
                      <th className="px-2 py-2.5 font-semibold w-20 text-right">Qty *</th>
                      <th className="px-2 py-2.5 font-semibold w-28 text-right">Rate (₹) *</th>
                      <th className="px-2 py-2.5 font-semibold w-24 text-right">GST Rate</th>
                      <th className="px-3 py-2.5 font-semibold w-28 text-right">Line Total</th>
                      <th className="px-2 py-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {lineItems.map((item, index) => {
                      const itemTotal = item.qty * item.rate * (1 + item.gst_rate / 100);
                      return (
                        <tr key={index} className="hover:bg-neutral-50/50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              placeholder="Item description"
                              className="w-full px-2 py-1.5 rounded border border-neutral-200 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.hsn_code}
                              onChange={(e) => updateLineItem(index, "hsn_code", e.target.value)}
                              placeholder="HSN"
                              className="w-full px-2 py-1.5 rounded border border-neutral-200 text-xs font-mono focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.qty}
                              onChange={(e) => updateLineItem(index, "qty", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 rounded border border-neutral-200 text-xs text-right font-mono focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.rate}
                              onChange={(e) => updateLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 rounded border border-neutral-200 text-xs text-right font-mono focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.gst_rate}
                              onChange={(e) => updateLineItem(index, "gst_rate", parseFloat(e.target.value))}
                              className="w-full px-2 py-1.5 rounded border border-neutral-200 text-xs text-right font-mono bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-neutral-900">
                            {formatINR(itemTotal)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLineItem(index)}
                                className="p-1 rounded text-neutral-400 hover:text-expense-600 hover:bg-expense-50 transition-colors"
                                title="Remove Line Item"
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

            {/* Section 4: Deterministic Tax Summary Panel */}
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Taxable Subtotal:</span>
                <span className="font-mono font-semibold text-neutral-800">
                  {formatINR(taxSummary.subtotal)}
                </span>
              </div>

              {!taxSummary.isIntraState ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">
                    Inter-state IGST ({counterpartyStateCode} → {businessStateCode}):
                  </span>
                  <span className="font-mono font-semibold text-neutral-800">
                    {formatINR(taxSummary.igst)}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">
                      Intra-state CGST (State {businessStateCode}):
                    </span>
                    <span className="font-mono font-semibold text-neutral-800">
                      {formatINR(taxSummary.cgst)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">
                      Intra-state SGST (State {businessStateCode}):
                    </span>
                    <span className="font-mono font-semibold text-neutral-800">
                      {formatINR(taxSummary.sgst)}
                    </span>
                  </div>
                </>
              )}

              <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Total Payable Amount:
                </span>
                <span className="text-base font-black text-brand-600 font-mono">
                  {formatINR(taxSummary.total)}
                </span>
              </div>
            </div>

            {/* Section 5: Form Actions */}
            <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => router.push("/ocr")}
                disabled={isSubmitting}
              >
                Cancel & Re-scan
              </Button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => handleConfirmAndSave("draft")}
                  disabled={isSubmitting}
                >
                  Save as Draft
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => handleConfirmAndSave("final")}
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                  rightIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  }
                >
                  Confirm & Create Purchase Invoice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
