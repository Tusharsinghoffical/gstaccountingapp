import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export interface InvoiceFileInput {
  name: string;
  size: number;
  type: string;
}

/**
 * Validates invoice file size (<= 10MB) and format (PDF, PNG, JPG, WEBP).
 */
export function validateInvoiceFile(file: InvoiceFileInput): {
  valid: boolean;
  error?: string;
} {
  if (!file || !file.size) {
    return { valid: false, error: "No file provided." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 10 MB.`,
    };
  }

  // Check MIME type or file extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  const validExts = ["jpg", "jpeg", "png", "webp", "pdf"];
  const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);
  const isValidExt = ext ? validExts.includes(ext) : false;

  if (!isValidMime && !isValidExt) {
    return {
      valid: false,
      error: `Unsupported file format. Please upload a PDF, PNG, JPG, or WEBP invoice document.`,
    };
  }

  return { valid: true };
}

/**
 * Generates tenant-scoped storage path: "{business_id}/{timestamp}-{cleanFileName}"
 */
export function generateScopedInvoiceStoragePath(
  businessId: string,
  fileName: string,
  timestamp: number = Date.now()
): string {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  return `${businessId}/${timestamp}-${cleanName}`;
}

export interface GroqModelItem {
  id: string;
  active?: boolean;
}

export type OcrConfidenceFlag = "high" | "medium" | "low";

/**
 * Checks whether a vision-capable model is available in the provided Groq models list.
 * Prioritizes high-capability vision models (e.g., llama-3.2-11b-vision-preview, llama-3.2-90b-vision-preview).
 */
export function selectGroqVisionModel(
  models: GroqModelItem[]
): string | null {
  if (!Array.isArray(models) || models.length === 0) {
    return null;
  }

  const visionPriorityList = [
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
  ];

  for (const target of visionPriorityList) {
    const match = models.find(
      (m) => m.id === target || m.id.toLowerCase().includes(target)
    );
    if (match) {
      return match.id;
    }
  }

  // Generic fallback check for any active model with 'vision' in its ID
  const anyVision = models.find((m) => m.id.toLowerCase().includes("vision"));
  return anyVision ? anyVision.id : null;
}

/**
 * Computes the confidence flag ("high" | "medium" | "low") based on recognized OCR score.
 * Thresholds:
 * - score > 0.8 => "high"
 * - score > 0.5 => "medium"
 * - else => "low"
 */
export function computeOcrConfidence(score: number): OcrConfidenceFlag {
  if (score > 0.8) return "high";
  if (score > 0.5) return "medium";
  return "low";
}

export const INDIAN_GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const StructuredInvoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required"),
  hsn: z
    .string()
    .trim()
    .min(2, "HSN/SAC must be at least 2 digits")
    .max(8, "HSN/SAC cannot exceed 8 digits"),
  qty: z.number().positive("Quantity must be greater than 0"),
  rate: z.number().min(0, "Rate cannot be negative"),
  gst_rate: z.number().min(0, "GST rate cannot be negative"),
});

export const StructuredInvoiceDataSchema = z.object({
  vendor_name: z.string().trim().min(1, "Vendor name is required"),
  vendor_gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      INDIAN_GSTIN_REGEX,
      "Invalid Indian GSTIN format (15 characters: 2-digit state + 10-digit PAN + entity + Z + checksum)"
    ),
  invoice_number: z.string().trim().min(1, "Invoice number is required"),
  invoice_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date must be in YYYY-MM-DD format"),
  line_items: z
    .array(StructuredInvoiceItemSchema)
    .min(1, "At least one line item is required"),
  total_amount: z.number().positive("Total amount must be greater than 0"),
});

export type StructuredInvoiceItem = z.infer<typeof StructuredInvoiceItemSchema>;
export type StructuredInvoiceData = z.infer<typeof StructuredInvoiceDataSchema>;

export interface StructuredInvoiceValidationResult {
  valid: boolean;
  data?: StructuredInvoiceData;
  error?: string;
  errors?: z.ZodIssue[];
}

/**
 * Validates extracted OCR invoice JSON against strict Zod schema.
 * Rejects any malformed, missing, or out-of-spec fields.
 */
export function validateStructuredInvoice(
  data: unknown
): StructuredInvoiceValidationResult {
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      error: "Malformed JSON: Expected non-null object payload.",
    };
  }

  const result = StructuredInvoiceDataSchema.safeParse(data);

  if (!result.success) {
    const errorMsg = result.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return {
      valid: false,
      error: `Validation failed against invoice schema: ${errorMsg}`,
      errors: result.error.issues,
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}
