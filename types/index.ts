/**
 * Core TypeScript Types for GST Ledger
 * Aligned with Supabase Core Schema (03-ARCHITECTURE.md §4)
 */

export type UserRole = "admin" | "accountant" | "auditor";
export type InvoiceType = "sales" | "purchase" | "credit_note" | "debit_note";
export type InvoiceStatus = "draft" | "final" | "cancelled";
export type PaymentMode = "cash" | "bank_transfer" | "upi" | "cheque" | "other";
export type LedgerEntryType = "debit" | "credit";
export type AuditAction = "INSERT" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "RECONCILE" | "SYSTEM";

export interface Business {
  id: string;
  name: string;
  gstin: string;
  state_code: string;
  legal_name?: string | null;
  trade_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  pincode?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessUser {
  id: string;
  business_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type MemberStatus = "active" | "invited" | "revoked";

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id?: string | null;
  email: string;
  name?: string | null;
  role: UserRole;
  status: MemberStatus;
  invited_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  gstin?: string | null;
  state_code: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  pan?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  gstin?: string | null;
  state_code: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  pan?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const PURCHASE_INVOICE_CATEGORIES = [
  "Office Supplies",
  "Raw Materials",
  "Utilities",
  "Professional Services",
  "Travel",
  "Other",
] as const;

export type PurchaseInvoiceCategory = (typeof PURCHASE_INVOICE_CATEGORIES)[number];

export interface Invoice {
  id: string;
  business_id: string;
  type: InvoiceType;
  customer_or_supplier_id: string;
  original_invoice_id?: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date?: string | null;
  status: InvoiceStatus;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  financial_year: string;
  category?: PurchaseInvoiceCategory | string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditDebitNote extends Invoice {
  type: "credit_note" | "debit_note";
  original_invoice_id: string;
  original_invoice_no?: string;
}

export interface InvoiceItem {
  id: string;
  business_id: string;
  invoice_id: string;
  description: string;
  hsn_code: string;
  qty: number;
  rate: number;
  discount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  party_id: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  id: string;
  business_id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  business_id: string;
  party_id: string;
  entry_type: LedgerEntryType;
  amount: number;
  ref_invoice_id?: string | null;
  ref_payment_id?: string | null;
  description?: string | null;
  entry_date: string;
  created_at: string;
}

export interface LedgerEntryWithRunningBalance extends LedgerEntry {
  debit: number;
  credit: number;
  running_balance: number;
  dr_cr: "Dr" | "Cr";
}

export interface PartyBalanceSummary {
  party_id: string;
  net_balance: number;
  total_debit: number;
  total_credit: number;
  entry_count: number;
  dr_cr: "Dr" | "Cr";
  nature: "receivable" | "payable" | "advance" | "settled";
}

export interface AuditLog {
  id: string;
  business_id: string;
  user_id?: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string;
  diff: Record<string, unknown>;
  created_at: string;
}

export interface TaxRateConfig {
  id: string;
  business_id?: string | null;
  hsn_code: string;
  description?: string | null;
  gst_rate: number;
  effective_from: string;
  effective_to?: string | null;
  created_at: string;
}
