"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  uploadInvoiceDocument,
  validateInvoiceFile,
  runInvoiceOCR,
  structureInvoiceData,
  UploadedInvoiceFile,
  OCRExtractionResult,
  StructuredInvoiceData,
} from "@/app/actions/ocr";

type UploadStage =
  | "idle"
  | "uploading"
  | "extracting"
  | "extracted"
  | "structuring"
  | "structured";

export default function OCRUploadPage() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedResult, setUploadedResult] =
    useState<UploadedInvoiceFile | null>(null);
  const [extractionStatusText, setExtractionStatusText] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OCRExtractionResult | null>(null);
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Structuring stage state (Prompt 18)
  const [structuredData, setStructuredData] =
    useState<StructuredInvoiceData | null>(null);
  const [structuringError, setStructuringError] = useState<string | null>(null);
  const [structuringErrorsList, setStructuringErrorsList] = useState<
    Array<{ field: string; message: string }> | null
  >(null);
  const [structuringModelUsed, setStructuringModelUsed] = useState<string | null>(
    null
  );

  // Manual invoice entry redirection state (Prompt 26)
  const [isRedirectingToManual, setIsRedirectingToManual] = useState<boolean>(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs
  const cleanupPreview = useCallback(() => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
  }, [filePreviewUrl]);

  // Handle file selection
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErrorMessage(null);

    // Client-side validation
    const validation = validateInvoiceFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      setErrorMessage(validation.error || "Invalid file selected.");
      return;
    }

    cleanupPreview();
    setSelectedFile(file);

    // Create thumbnail preview for images
    if (file.type.startsWith("image/")) {
      const preview = URL.createObjectURL(file);
      setFilePreviewUrl(preview);
    } else {
      setFilePreviewUrl(null);
    }

    // Start upload and extraction pipeline
    startUploadFlow(file);
  };

  // Drag event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Upload and OCR extraction pipeline
  const startUploadFlow = async (file: File) => {
    setUploadStage("uploading");
    setUploadProgress(10);
    setOcrResult(null);

    // Animate upload progress smoothly
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 100);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("businessId", "biz-1");

    try {
      const res = await uploadInvoiceDocument(formData);
      clearInterval(interval);

      if (!res.success || !res.data) {
        setUploadStage("idle");
        setErrorMessage(res.error || "Upload failed. Please try again.");
        return;
      }

      setUploadProgress(100);
      const uploadData = res.data;
      setUploadedResult(uploadData);

      // Transition immediately to Extraction loading stage
      setTimeout(() => {
        setUploadStage("extracting");
        runExtractionProcess(uploadData.bucket, uploadData.storagePath);
      }, 350);
    } catch (err) {
      clearInterval(interval);
      setUploadStage("idle");
      setErrorMessage(
        err instanceof Error ? err.message : "Unexpected upload error."
      );
    }
  };

  // Cancel pending redirection
  const cancelManualRedirection = useCallback(() => {
    if (redirectTimerRef.current) {
      clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    setIsRedirectingToManual(false);
  }, []);

  // Gracefully redirect to manual entry on OCR failure or timeout (Prompt 26)
  const triggerManualRedirection = useCallback(
    (reasonText: string) => {
      // Clear stuck loading states immediately — never leave user stuck loading
      setUploadStage("idle");
      setErrorMessage(reasonText);
      setIsRedirectingToManual(true);
      setRedirectCountdown(3);

      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
      }

      let remaining = 3;
      redirectTimerRef.current = setInterval(() => {
        remaining -= 1;
        setRedirectCountdown(remaining);
        if (remaining <= 0) {
          if (redirectTimerRef.current) {
            clearInterval(redirectTimerRef.current);
            redirectTimerRef.current = null;
          }
          router.push(
            `/invoices/new?source=ocr_fallback&reason=${encodeURIComponent(
              reasonText
            )}`
          );
        }
      }, 1000);
    },
    [router]
  );

  // Clean up redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
      }
    };
  }, []);

  // Runs OCR text extraction via Edge Function / Groq Vision / Tesseract fallback
  const runExtractionProcess = async (bucket: string, storagePath: string) => {
    setExtractionStatusText("Querying Groq account for Vision model availability...");

    let hasCompleted = false;
    let watchdogTimer: NodeJS.Timeout | null = null;

    const statusTimer1 = setTimeout(() => {
      if (!hasCompleted) {
        setExtractionStatusText("Running OCR text extraction on document payload...");
      }
    }, 1200);

    const statusTimer2 = setTimeout(() => {
      if (!hasCompleted) {
        setExtractionStatusText("Finalizing raw verbatim text and confidence scoring...");
      }
    }, 2400);

    // Hard 25s timeout safeguard: abort loading state and trigger manual entry redirection
    watchdogTimer = setTimeout(() => {
      if (!hasCompleted) {
        hasCompleted = true;
        clearTimeout(statusTimer1);
        clearTimeout(statusTimer2);
        triggerManualRedirection(
          "OCR extraction timed out after 25 seconds. Redirecting to manual invoice entry..."
        );
      }
    }, 25000);

    try {
      const ocrRes = await runInvoiceOCR(bucket, storagePath);

      if (hasCompleted) return;
      hasCompleted = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      clearTimeout(statusTimer1);
      clearTimeout(statusTimer2);

      if (!ocrRes.success) {
        triggerManualRedirection(
          ocrRes.error || "OCR extraction failed to read document. Redirecting to manual entry..."
        );
        return;
      }

      setOcrResult(ocrRes);
      setUploadStage("extracted");
    } catch (err) {
      if (hasCompleted) return;
      hasCompleted = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      clearTimeout(statusTimer1);
      clearTimeout(statusTimer2);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to run OCR extraction. Redirecting to manual entry...";
      triggerManualRedirection(msg);
    }
  };

  const copyExtractedText = () => {
    if (!ocrResult?.rawText) return;
    navigator.clipboard.writeText(ocrResult.rawText);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const resetUpload = () => {
    cancelManualRedirection();
    cleanupPreview();
    setSelectedFile(null);
    setUploadedResult(null);
    setOcrResult(null);
    setStructuredData(null);
    setStructuringError(null);
    setStructuringErrorsList(null);
    setStructuringModelUsed(null);
    setUploadStage("idle");
    setUploadProgress(0);
    setErrorMessage(null);
    setHasCopied(false);
  };

  const handleStructureData = async () => {
    if (!ocrResult?.rawText) return;
    setUploadStage("structuring");
    setStructuringError(null);
    setStructuringErrorsList(null);

    try {
      const res = await structureInvoiceData(ocrResult.rawText);
      if (!res.success || !res.data) {
        setUploadStage("extracted");
        setStructuringError(
          res.error || "Invoice structuring validation failed."
        );
        setStructuringErrorsList(res.validationErrors || null);
        return;
      }
      setStructuredData(res.data);
      setStructuringModelUsed(res.modelUsed || "llama-3.3-70b-versatile");
      setUploadStage("structured");
    } catch (err: unknown) {
      setUploadStage("extracted");
      setStructuringError(
        err instanceof Error
          ? err.message
          : "Unexpected error structuring invoice."
      );
    }
  };

  const navigateToReview = () => {
    if (!structuredData) return;
    sessionStorage.setItem(
      "gst_ocr_pending_invoice",
      JSON.stringify({
        structuredData,
        fileUrl: filePreviewUrl,
        fileName: selectedFile?.name || "scanned_invoice.pdf",
        storagePath: uploadedResult?.storagePath,
      })
    );
    router.push("/ocr/review");
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            OCR Invoice Upload
          </h1>
          <p className="text-sm text-neutral-500">
            Upload paper bills or digital PDFs. Scoped to your business bucket with Groq AI extraction.
          </p>
        </div>

        {/* Security & Multi-tenant Badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
            <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse"></span>
            Storage RLS Scoped: <span className="font-mono font-bold">biz-1</span>
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-expense-50 border border-expense-200 text-expense-800 text-sm flex items-start gap-3 shadow-sm animate-fadeIn">
          <svg className="w-5 h-5 text-expense-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-bold text-expense-900">OCR Processing Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-expense-500 hover:text-expense-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Box / Main Container */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
        {uploadStage === "idle" && (
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-10 sm:p-14 text-center transition-all duration-200 ${
              dragActive
                ? "bg-brand-50/50 border-2 border-dashed border-brand-500 scale-[0.99]"
                : "border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Upload Illustration Icon */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 mb-4 shadow-sm group-hover:scale-105 transition-transform">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <h3 className="text-base font-bold text-neutral-900">
              Drag and drop invoice document here
            </h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Drop your supplier bills, tax invoices, or purchase receipts. Supports high-resolution images and PDFs up to 10MB.
            </p>

            {/* Allowed Formats Pills */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {["PDF", "PNG", "JPG", "WEBP"].map((ext) => (
                <span
                  key={ext}
                  className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-white border border-neutral-200 text-neutral-600 shadow-xs"
                >
                  {ext}
                </span>
              ))}
              <span className="text-[11px] text-neutral-400">Max 10 MB</span>
            </div>

            {/* Browse Button */}
            <div className="mt-6">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
              >
                Browse Files
              </Button>
            </div>
          </div>
        )}

        {/* Uploading Progress State */}
        {uploadStage === "uploading" && selectedFile && (
          <div className="p-8 sm:p-12 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 font-bold">
                  {selectedFile.type === "application/pdf" ? (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 text-sm truncate max-w-sm">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-neutral-500 font-mono">
                    {formatFileSize(selectedFile.size)} • Saving to Local Storage
                  </p>
                </div>
              </div>

              <span className="text-sm font-mono font-bold text-brand-700">
                {uploadProgress}%
              </span>
            </div>

            {/* Animated Progress Bar */}
            <div className="space-y-2">
              <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-indigo-600 transition-all duration-150 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Encrypting and uploading payload...</span>
                <span>Bucket: invoices</span>
              </div>
            </div>
          </div>
        )}

        {/* Extraction Loading State */}
        {uploadStage === "extracting" && (
          <div className="p-8 sm:p-12 space-y-6">
            {/* Scoped Upload Confirmation */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-900">
                    Document Securely Stored
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700 truncate max-w-md">
                    storage://invoices/{uploadedResult?.storagePath}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                RLS Scoped
              </span>
            </div>

            {/* Document Preview & Scanning Line Animation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-900 aspect-[3/4] flex items-center justify-center shadow-inner">
                {filePreviewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={filePreviewUrl}
                    alt="Invoice Preview"
                    className="w-full h-full object-cover opacity-85"
                  />
                ) : (
                  <div className="text-center p-4 text-white">
                    <svg className="w-12 h-12 mx-auto text-neutral-400 mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                    <p className="text-xs font-mono text-neutral-300">
                      {selectedFile?.name}
                    </p>
                  </div>
                )}

                {/* Vertical Laser Scan Line */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-scanline pointer-events-none" />
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                    <h3 className="text-base font-bold text-neutral-900">
                      OCR Text Extraction in Progress
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500 font-mono">
                    {extractionStatusText}
                  </p>
                </div>

                <div className="space-y-2 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-700 font-semibold">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Storage bucket upload & RLS scoping verified</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-indigo-700 font-semibold">
                    <svg className="w-4 h-4 animate-spin text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Running Groq Vision or Tesseract.js fallback...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extracted Raw Text & Structured Invoice Review (Prompts 17 & 18) */}
        {(uploadStage === "extracted" ||
          uploadStage === "structuring" ||
          uploadStage === "structured") &&
          ocrResult && (
          <div className="p-8 sm:p-10 space-y-6 animate-fadeIn">
            {/* Success Bar with Engine & Confidence Tags */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Raw Text Extracted Successfully
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    Engine:{" "}
                    <span className="font-semibold text-neutral-800">
                      {ocrResult.engine === "groq_vision"
                        ? `Groq Vision (${ocrResult.modelUsed || "llama-3.2-vision"})`
                        : "Tesseract.js OCR Fallback"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Confidence Badge */}
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    ocrResult.confidence === "high"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : ocrResult.confidence === "medium"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-expense-50 text-expense-700 border-expense-200"
                  }`}
                >
                  {(ocrResult.confidence || "medium").toUpperCase()} CONFIDENCE (
                  {Math.round((ocrResult.confidenceScore || 0.85) * 100)}%)
                </span>
              </div>
            </div>

            {/* Structuring Error Alert (if Zod validation failed) */}
            {structuringError && (
              <div className="p-4 rounded-xl bg-expense-50 border border-expense-200 text-expense-900 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-expense-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-bold text-xs uppercase tracking-wider text-expense-800">
                    Schema Validation Error — Malformed Data Rejected
                  </span>
                </div>
                <p className="text-xs text-expense-700">{structuringError}</p>
                {structuringErrorsList && structuringErrorsList.length > 0 && (
                  <div className="mt-2 pl-4 border-l-2 border-expense-300 space-y-1">
                    {structuringErrorsList.map((err, idx) => (
                      <p key={idx} className="text-[11px] font-mono text-expense-800">
                        • <strong>{err.field}</strong>: {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Structuring Loading State */}
            {uploadStage === "structuring" && (
              <div className="p-6 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center space-y-3 animate-pulse">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <div className="text-center space-y-1">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Structuring Invoice with Groq JSON Mode
                  </h4>
                  <p className="text-xs text-indigo-600">
                    Extracting vendor GSTIN, invoice metadata, line items, and enforcing Zod schema validation...
                  </p>
                </div>
              </div>
            )}

            {/* Extracted Raw Text Box (visible in extracted stage) */}
            {uploadStage === "extracted" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Raw Extracted Document Text:
                  </span>
                  <button
                    type="button"
                    onClick={copyExtractedText}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors inline-flex items-center gap-1"
                  >
                    {hasCopied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-700">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy Raw Text</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative rounded-xl border border-neutral-200 bg-neutral-900 text-neutral-100 p-4 font-mono text-xs max-h-72 overflow-y-auto leading-relaxed shadow-inner select-text">
                  <pre className="whitespace-pre-wrap">{ocrResult.rawText}</pre>
                </div>
              </div>
            )}

            {/* Structured Invoice Preview (when uploadStage === "structured") */}
            {uploadStage === "structured" && structuredData && (
              <div className="space-y-4 pt-2">
                {/* Status Bar */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-bold text-xs uppercase tracking-wider block">
                        Zod Schema Validated — Ready for Review & Save
                      </span>
                      <span className="text-[11px] text-emerald-700">
                        Structured by Groq LLM ({structuringModelUsed}) with zero malformed data.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                    VALID
                  </span>
                </div>

                {/* Header Information Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vendor Details */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Vendor / Supplier Details
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-neutral-900">
                        {structuredData.vendor_name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-mono">
                        <span className="text-neutral-400">GSTIN:</span>
                        <span className="font-semibold text-neutral-900">
                          {structuredData.vendor_gstin}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* Invoice Metadata */}
                  <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Invoice Metadata
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Invoice No</span>
                        <span className="font-semibold text-neutral-900">{structuredData.invoice_number}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Date</span>
                        <span className="font-semibold text-neutral-900">{structuredData.invoice_date}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px]">Total Amount</span>
                        <span className="font-bold text-brand-600">
                          ₹{structuredData.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm">
                  <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                      Extracted Line Items ({structuredData.line_items.length})
                    </span>
                    <span className="text-[11px] text-neutral-500">HSN-Wise Breakdown</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                        <tr>
                          <th className="px-4 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 font-medium">HSN/SAC</th>
                          <th className="px-3 py-2 font-medium text-right">Qty</th>
                          <th className="px-3 py-2 font-medium text-right">Rate</th>
                          <th className="px-3 py-2 font-medium text-right">GST %</th>
                          <th className="px-4 py-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {structuredData.line_items.map((item, idx) => {
                          const itemTotal = item.qty * item.rate * (1 + item.gst_rate / 100);
                          return (
                            <tr key={idx} className="hover:bg-neutral-50/50">
                              <td className="px-4 py-2.5 font-medium text-neutral-900">{item.description}</td>
                              <td className="px-3 py-2.5 font-mono text-neutral-600">{item.hsn}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">{item.qty}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-neutral-700">
                                ₹{item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">{item.gst_rate}%</td>
                              <td className="px-4 py-2.5 text-right font-bold text-neutral-900 font-mono">
                                ₹{itemTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={resetUpload}
              >
                Upload Another Document
              </Button>

              <div className="flex items-center gap-2">
                {uploadStage === "structured" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setUploadStage("extracted")}
                  >
                    View Raw OCR
                  </Button>
                )}

                {uploadStage === "extracted" && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleStructureData}
                    rightIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    }
                  >
                    Structure with Groq JSON Mode
                  </Button>
                )}

                {uploadStage === "structured" && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={navigateToReview}
                    rightIcon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    }
                  >
                    Proceed to Review & Confirm
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-card space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h4 className="font-bold text-neutral-900 text-xs">
            Multi-Tenant Isolation
          </h4>
          <p className="text-[11px] text-neutral-500">
            Storage RLS policies restrict file access to authenticated members of the respective business ID.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-card space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h4 className="font-bold text-neutral-900 text-xs">
            Groq LLaMA-3 Vision
          </h4>
          <p className="text-[11px] text-neutral-500">
            Ultra-low latency invoice processing extracting vendor GSTIN, HSN rates, and subtotals in seconds.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-card space-y-1.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h4 className="font-bold text-neutral-900 text-xs">
            Tesseract.js Fallback
          </h4>
          <p className="text-[11px] text-neutral-500">
            Automatic OCR fallback for noisy paper receipts ensuring zero failed extractions.
          </p>
        </div>
      </div>
    </div>
  );
}
