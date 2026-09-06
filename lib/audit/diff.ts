// ==============================================================================
// Audit Log Human-Readable Diff & Transformation Engine
// Reference: Prompt 24 - Read-Only Audit Log Screen (Admin-Only)
// ==============================================================================

export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "RECONCILE"
  | "SYSTEM";

export type AuditTable = "invoices" | "payments" | "ledger_entries" | string;

export interface AuditLogEntry {
  id: string;
  business_id: string;
  user_id: string | null;
  user_email?: string;
  user_name?: string;
  action: AuditAction;
  table_name: AuditTable;
  record_id: string;
  record_identifier?: string;
  diff: Record<string, any>;
  created_at: string;
}

export interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  formattedChange: string;
}

export interface HumanReadableAuditSummary {
  headline: string;
  fieldChanges: FieldChange[];
  isCreation: boolean;
  isDeletion: boolean;
}

/**
 * Format currency values into standard Indian Rupee notation (₹1,25,000.00).
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "₹0.00";
  }
  const num = Number(amount);
  return "₹" + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Transform snake_case column names into readable labels.
 */
export function formatColumnLabel(col: string): string {
  const map: Record<string, string> = {
    invoice_no: "Invoice Number",
    invoice_date: "Invoice Date",
    due_date: "Due Date",
    customer_or_supplier_id: "Party",
    subtotal: "Taxable Subtotal",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    total: "Total Amount",
    financial_year: "Fiscal Year",
    status: "Status",
    party_id: "Party",
    reference_no: "Reference #",
    entry_type: "Entry Type",
    entry_date: "Entry Date",
    amount: "Amount",
    mode: "Payment Mode",
    notes: "Notes",
    description: "Description",
    category: "Category",
    ref_invoice_id: "Invoice Ref",
    ref_payment_id: "Payment Ref",
  };

  if (map[col]) return map[col];

  return col
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Formats a single field value based on column semantic context.
 */
export function formatFieldValue(col: string, val: any): string {
  if (val === null || val === undefined) return "—";

  const monetaryFields = new Set([
    "amount",
    "total",
    "subtotal",
    "cgst",
    "sgst",
    "igst",
    "allocated_amount",
  ]);

  if (monetaryFields.has(col)) {
    return formatCurrency(val);
  }

  if (typeof val === "boolean") {
    return val ? "Yes" : "No";
  }

  if (typeof val === "object") {
    return JSON.stringify(val);
  }

  return String(val);
}

/**
 * Pure JavaScript replica of the Postgres trigger's delta computation.
 * Compares OLD and NEW rows, filtering out `updated_at`.
 */
export function computeJsonDiff(
  oldRow: Record<string, any>,
  newRow: Record<string, any>
): Record<string, { old: any; new: any }> {
  const diff: Record<string, { old: any; new: any }> = {};

  const allKeys = Array.from(
    new Set([...Object.keys(oldRow), ...Object.keys(newRow)])
  );

  for (const key of allKeys) {
    if (key === "updated_at") continue;

    const oldVal = oldRow[key];
    const newVal = newRow[key];

    // Check if distinct
    const isDistinct =
      JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null);

    if (isDistinct) {
      diff[key] = {
        old: oldVal,
        new: newVal,
      };
    }
  }

  return diff;
}

/**
 * Generates human-readable diff breakdown and summary sentence.
 */
export function generateHumanReadableDiff(
  entry: AuditLogEntry
): HumanReadableAuditSummary {
  const { action, table_name, diff } = entry;

  // 1. INSERT Operations
  if (action === "INSERT") {
    const createdData = diff?.created || diff || {};
    const fieldChanges: FieldChange[] = [];

    for (const [k, v] of Object.entries(createdData)) {
      if (["business_id", "created_at", "updated_at", "id"].includes(k)) continue;
      fieldChanges.push({
        field: k,
        label: formatColumnLabel(k),
        oldValue: null,
        newValue: v,
        formattedChange: `Set ${formatColumnLabel(k)} to ${formatFieldValue(k, v)}`,
      });
    }

    let headline = `Created new record in ${table_name}`;
    if (table_name === "invoices") {
      const type = createdData.type ? createdData.type.toUpperCase() : "SALES";
      const num = createdData.invoice_no || entry.record_identifier || "draft";
      const total = formatCurrency(createdData.total);
      const status = createdData.status || "draft";
      headline = `Created ${type} invoice #${num} totaling ${total} (${status})`;
    } else if (table_name === "payments") {
      const mode = (createdData.mode || "bank").toUpperCase();
      const amount = formatCurrency(createdData.amount);
      const ref = createdData.reference_no ? ` [Ref: ${createdData.reference_no}]` : "";
      headline = `Recorded ${mode} payment of ${amount}${ref}`;
    } else if (table_name === "ledger_entries") {
      const entryType = (createdData.entry_type || "entry").toUpperCase();
      const amount = formatCurrency(createdData.amount);
      const desc = createdData.description ? ` (${createdData.description})` : "";
      headline = `Posted ${entryType} ledger entry of ${amount}${desc}`;
    }

    return {
      headline,
      fieldChanges,
      isCreation: true,
      isDeletion: false,
    };
  }

  // 2. DELETE Operations
  if (action === "DELETE") {
    return {
      headline: `Deleted record #${entry.record_identifier || entry.record_id} from ${table_name}`,
      fieldChanges: [],
      isCreation: false,
      isDeletion: true,
    };
  }

  // 3. UPDATE Operations (Compute human field-by-field diff)
  const fieldChanges: FieldChange[] = [];
  const deltaEntries = Object.entries(diff || {});

  for (const [key, change] of deltaEntries) {
    if (key === "updated_at") continue;

    const oldVal = change && typeof change === "object" && "old" in change ? change.old : null;
    const newVal = change && typeof change === "object" && "new" in change ? change.new : change;

    const label = formatColumnLabel(key);
    const oldFormatted = formatFieldValue(key, oldVal);
    const newFormatted = formatFieldValue(key, newVal);

    let changeText = `${label}: ${oldFormatted} → ${newFormatted}`;
    if (key === "status") {
      changeText = `Status transitioned from "${oldFormatted}" to "${newFormatted}"`;
    } else if (key === "total" || key === "amount") {
      changeText = `${label} adjusted from ${oldFormatted} to ${newFormatted}`;
    }

    fieldChanges.push({
      field: key,
      label,
      oldValue: oldVal,
      newValue: newVal,
      formattedChange: changeText,
    });
  }

  let headline = `Updated ${fieldChanges.length} field${fieldChanges.length === 1 ? "" : "s"} in ${table_name}`;

  if (fieldChanges.length === 1) {
    headline = fieldChanges[0].formattedChange;
  } else if (fieldChanges.length > 1) {
    const keySummaries = fieldChanges.map((f) => f.label).join(", ");
    headline = `Modified ${keySummaries} on ${table_name} #${entry.record_identifier || entry.record_id.slice(0, 8)}`;
  } else {
    headline = `Updated record on ${table_name} (no substantive fields changed)`;
  }

  return {
    headline,
    fieldChanges,
    isCreation: false,
    isDeletion: false,
  };
}

/**
 * Filter audit log list by table, action, or fuzzy text query.
 */
export function filterAuditLogs(
  logs: AuditLogEntry[],
  filters: {
    table?: string;
    action?: string;
    query?: string;
  }
): AuditLogEntry[] {
  return logs.filter((log) => {
    // 1. Table filter
    if (filters.table && filters.table !== "ALL" && log.table_name !== filters.table) {
      return false;
    }

    // 2. Action filter
    if (filters.action && filters.action !== "ALL" && log.action !== filters.action) {
      return false;
    }

    // 3. Search query
    if (filters.query && filters.query.trim() !== "") {
      const q = filters.query.toLowerCase().trim();
      const user = (log.user_email || log.user_name || "").toLowerCase();
      const recId = (log.record_identifier || log.record_id).toLowerCase();
      const diffStr = JSON.stringify(log.diff).toLowerCase();
      const tbl = log.table_name.toLowerCase();

      return (
        user.includes(q) ||
        recId.includes(q) ||
        tbl.includes(q) ||
        diffStr.includes(q)
      );
    }

    return true;
  });
}
