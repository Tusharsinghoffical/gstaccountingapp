import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  hsn_code: z.string().min(2, "HSN/SAC code must be at least 2 digits"),
  qty: z.number().positive("Quantity must be greater than 0"),
  rate: z.number().min(0, "Rate cannot be negative"),
  discount: z.number().min(0, "Discount cannot be negative").default(0),
  gst_rate: z.number().min(0, "GST rate cannot be negative").default(18),
});

export const PURCHASE_INVOICE_CATEGORIES = [
  "Office Supplies",
  "Raw Materials",
  "Utilities",
  "Professional Services",
  "Travel",
  "Other",
] as const;

export type PurchaseInvoiceCategory = (typeof PURCHASE_INVOICE_CATEGORIES)[number];

export const purchaseCategorySchema = z.enum(PURCHASE_INVOICE_CATEGORIES);

export const createInvoiceSchema = z.object({
  type: z.enum(["sales", "purchase"]),
  status: z.enum(["draft", "final"]).default("final"),
  customer_or_supplier_id: z.string().min(1, "Counterparty is required"),
  invoice_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  category: z
    .enum(PURCHASE_INVOICE_CATEGORIES)
    .optional()
    .or(z.literal(""))
    .nullable(),
  notes: z.string().optional().or(z.literal("")),
  items: z
    .array(lineItemSchema)
    .min(1, "Invoice must have at least one line item"),
});

export const createCreditDebitNoteSchema = z.object({
  original_invoice_id: z.string().min(1, "Original invoice reference is required"),
  type: z.enum(["credit_note", "debit_note"]),
  note_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  reason: z.string().min(3, "Reason for credit/debit note is required"),
  items: z
    .array(lineItemSchema)
    .min(1, "Note must have at least one line item"),
});

export type LineItemFormData = z.infer<typeof lineItemSchema>;
export type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;
export type CreateCreditDebitNoteFormData = z.infer<typeof createCreditDebitNoteSchema>;
