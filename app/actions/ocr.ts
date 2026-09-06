"use server";

import path from "path";
import { saveInvoiceFile } from "@/lib/storage/local-files";

import {
  validateInvoiceFile,
  generateScopedInvoiceStoragePath,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  StructuredInvoiceData,
} from "@/lib/validation/ocr";

export {
  validateInvoiceFile,
  generateScopedInvoiceStoragePath,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
};
export type { StructuredInvoiceData };

export interface UploadedInvoiceFile {
  storagePath: string;
  bucket: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  publicUrl?: string;
  fileId?: string;
}

export interface UploadResult {
  success: boolean;
  data?: UploadedInvoiceFile;
  error?: string;
}

/**
 * Uploads an invoice document to local filesystem storage,
 * strictly scoped under ./storage/{businessId}/invoices/{uuid}.{ext}
 */
export async function uploadInvoiceDocument(
  formData: FormData
): Promise<UploadResult> {
  try {
    const file = formData.get("file") as File | null;
    const businessId = (formData.get("businessId") as string) || "biz-1";

    if (!file) {
      return { success: false, error: "No file provided in form data." };
    }

    // 1. Validation
    const validation = validateInvoiceFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 2. Save directly to local filesystem storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(file.name) || ".bin";
    const saved = await saveInvoiceFile(businessId, buffer, ext, file.name);

    return {
      success: true,
      data: {
        storagePath: `${businessId}/invoices/${saved.fileId}.${saved.extension}`,
        bucket: "local",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        fileId: saved.fileId,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to upload document. Please try again.",
    };
  }
}

export interface OCRExtractionResult {
  success: boolean;
  rawText?: string;
  confidence?: "high" | "medium" | "low";
  confidenceScore?: number;
  engine?: string;
  modelUsed?: string | null;
  error?: string;
  fallbackToManual?: boolean;
}

/**
 * Runs OCR text extraction via the Edge Function or local handler with timeout handling.
 */
export async function runInvoiceOCR(
  bucket: string,
  storagePath: string
): Promise<OCRExtractionResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/ocr/extract`, {
      signal: AbortSignal.timeout(20000), // 20s timeout safeguard
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, filePath: storagePath }),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        error: `OCR extraction service unavailable (HTTP ${res.status}).`,
        fallbackToManual: true,
      };
    }

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || "OCR extraction failed to read document.",
        fallbackToManual: true,
      };
    }

    return {
      success: true,
      rawText: data.raw_text,
      confidence: data.confidence,
      confidenceScore: data.confidence_score,
      engine: data.engine,
      modelUsed: data.model_used,
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout"));
    return {
      success: false,
      error: isTimeout
        ? "OCR extraction timed out after 20 seconds. Please enter invoice details manually."
        : err instanceof Error
        ? err.message
        : "Failed to run OCR extraction. Please enter invoice details manually.",
      fallbackToManual: true,
    };
  }
}

export interface StructuredInvoiceResult {
  success: boolean;
  data?: StructuredInvoiceData;
  modelUsed?: string;
  error?: string;
  validationErrors?: Array<{ field: string; message: string }>;
  fallbackToManual?: boolean;
}

/**
 * Server action to structure raw OCR text into a validated invoice schema.
 * Rejects and returns error state if Zod validation fails, with graceful manual entry fallback.
 */
export async function structureInvoiceData(
  rawText: string
): Promise<StructuredInvoiceResult> {
  try {
    if (!rawText || !rawText.trim()) {
      return {
        success: false,
        error: "Empty raw OCR text provided.",
        fallbackToManual: true,
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/ocr/structure`, {
      signal: AbortSignal.timeout(20000), // 20s timeout safeguard
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText }),
      cache: "no-store",
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || "Invoice structuring validation failed.",
        validationErrors: result.validation_errors,
        fallbackToManual: true,
      };
    }

    return {
      success: true,
      data: result.structured_data,
      modelUsed: result.model_used,
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.message.toLowerCase().includes("timeout"));
    return {
      success: false,
      error: isTimeout
        ? "Invoice structuring timed out. Please enter details manually."
        : err instanceof Error
        ? err.message
        : "Unexpected error structuring invoice. Please enter details manually.",
      fallbackToManual: true,
    };
  }
}

