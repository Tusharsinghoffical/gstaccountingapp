import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeJsonDiff,
  generateHumanReadableDiff,
  filterAuditLogs,
  formatCurrency,
  formatColumnLabel,
  type AuditLogEntry,
} from "../lib/audit/diff.ts";
import { checkAdminPermission, isUserAdmin } from "../lib/users/rbac.ts";

describe("Financial Mutation Audit Log Engine & Postgres Trigger Logic (Prompt 24)", () => {
  describe("computeJsonDiff (Database Trigger Simulation)", () => {
    it("should compute exact before/after field changes between OLD and NEW rows", () => {
      const oldRow = {
        id: "inv-1",
        status: "draft",
        subtotal: 100000,
        total: 118000,
        updated_at: "2024-04-01T10:00:00Z",
      };

      const newRow = {
        id: "inv-1",
        status: "final",
        subtotal: 100000,
        total: 118000,
        updated_at: "2024-04-01T10:05:00Z",
      };

      const diff = computeJsonDiff(oldRow, newRow);

      assert.deepEqual(diff, {
        status: {
          old: "draft",
          new: "final",
        },
      });
      // updated_at should be completely excluded
      assert.strictEqual("updated_at" in diff, false);
    });

    it("should return empty object when only updated_at changed", () => {
      const oldRow = {
        id: "pay-1",
        amount: 50000,
        updated_at: "2024-04-01T10:00:00Z",
      };

      const newRow = {
        id: "pay-1",
        amount: 50000,
        updated_at: "2024-04-01T10:02:00Z",
      };

      const diff = computeJsonDiff(oldRow, newRow);
      assert.deepEqual(diff, {});
      assert.strictEqual(Object.keys(diff).length, 0);
    });

    it("should capture multiple modified fields correctly", () => {
      const oldRow = {
        notes: "Old draft terms",
        due_date: "2024-05-01",
        amount: 5000,
      };

      const newRow = {
        notes: "Updated terms with 2% cash discount",
        due_date: "2024-05-15",
        amount: 4900,
      };

      const diff = computeJsonDiff(oldRow, newRow);
      assert.strictEqual(diff.notes.old, "Old draft terms");
      assert.strictEqual(diff.notes.new, "Updated terms with 2% cash discount");
      assert.strictEqual(diff.due_date.old, "2024-05-01");
      assert.strictEqual(diff.due_date.new, "2024-05-15");
      assert.strictEqual(diff.amount.old, 5000);
      assert.strictEqual(diff.amount.new, 4900);
    });
  });

  describe("generateHumanReadableDiff (Formatting & Summaries)", () => {
    it("should format INSERT on invoices with invoice number, amount, and status", () => {
      const entry: AuditLogEntry = {
        id: "aud-1",
        business_id: "biz-1",
        user_id: "usr-1",
        action: "INSERT",
        table_name: "invoices",
        record_id: "inv-101",
        record_identifier: "INV/2024-25/0001",
        diff: {
          created: {
            type: "sales",
            invoice_no: "INV/2024-25/0001",
            total: 141600,
            status: "draft",
          },
        },
        created_at: "2024-04-01T10:00:00Z",
      };

      const summary = generateHumanReadableDiff(entry);
      assert.strictEqual(summary.isCreation, true);
      assert.match(summary.headline, /Created SALES invoice #INV\/2024-25\/0001/);
      assert.match(summary.headline, /1,41,600/);
    });

    it("should format INSERT on payments with mode, amount, and reference", () => {
      const entry: AuditLogEntry = {
        id: "aud-2",
        business_id: "biz-1",
        user_id: "usr-1",
        action: "INSERT",
        table_name: "payments",
        record_id: "pay-101",
        record_identifier: "PAY-UPI-99",
        diff: {
          created: {
            mode: "upi",
            amount: 25000,
            reference_no: "UPI/394829104",
          },
        },
        created_at: "2024-04-02T11:00:00Z",
      };

      const summary = generateHumanReadableDiff(entry);
      assert.strictEqual(summary.isCreation, true);
      assert.match(summary.headline, /Recorded UPI payment of/);
      assert.match(summary.headline, /25,000/);
      assert.match(summary.headline, /UPI\/394829104/);
    });

    it("should format INSERT on ledger_entries with entry type and amount", () => {
      const entry: AuditLogEntry = {
        id: "aud-3",
        business_id: "biz-1",
        user_id: "usr-1",
        action: "INSERT",
        table_name: "ledger_entries",
        record_id: "led-101",
        diff: {
          created: {
            entry_type: "debit",
            amount: 141600,
            description: "Sales Invoice Posting",
          },
        },
        created_at: "2024-04-02T11:05:00Z",
      };

      const summary = generateHumanReadableDiff(entry);
      assert.strictEqual(summary.isCreation, true);
      assert.match(summary.headline, /Posted DEBIT ledger entry of/);
      assert.match(summary.headline, /1,41,600/);
      assert.match(summary.headline, /Sales Invoice Posting/);
    });

    it("should format UPDATE status change cleanly", () => {
      const entry: AuditLogEntry = {
        id: "aud-4",
        business_id: "biz-1",
        user_id: "usr-1",
        action: "UPDATE",
        table_name: "invoices",
        record_id: "inv-101",
        record_identifier: "INV/2024-25/0001",
        diff: {
          status: {
            old: "draft",
            new: "final",
          },
        },
        created_at: "2024-04-03T12:00:00Z",
      };

      const summary = generateHumanReadableDiff(entry);
      assert.strictEqual(summary.isCreation, false);
      assert.strictEqual(
        summary.headline,
        'Status transitioned from "draft" to "final"'
      );
      assert.strictEqual(summary.fieldChanges.length, 1);
      assert.strictEqual(summary.fieldChanges[0].field, "status");
    });

    it("should format currency in Indian number formatting", () => {
      assert.strictEqual(formatCurrency(100000), "₹1,00,000.00");
      assert.strictEqual(formatCurrency(1452000.5), "₹14,52,000.50");
      assert.strictEqual(formatCurrency(0), "₹0.00");
      assert.strictEqual(formatCurrency(null), "₹0.00");
    });

    it("should translate column names into professional labels", () => {
      assert.strictEqual(formatColumnLabel("invoice_no"), "Invoice Number");
      assert.strictEqual(formatColumnLabel("customer_or_supplier_id"), "Party");
      assert.strictEqual(formatColumnLabel("entry_type"), "Entry Type");
      assert.strictEqual(formatColumnLabel("subtotal"), "Taxable Subtotal");
    });
  });

  describe("filterAuditLogs", () => {
    const mockLogs: AuditLogEntry[] = [
      {
        id: "1",
        business_id: "biz-1",
        user_id: "u1",
        user_email: "rajesh@alpha.in",
        action: "INSERT",
        table_name: "invoices",
        record_id: "inv-1",
        record_identifier: "INV/2024-25/0001",
        diff: { created: { total: 10000 } },
        created_at: "2024-04-01T00:00:00Z",
      },
      {
        id: "2",
        business_id: "biz-1",
        user_id: "u1",
        user_email: "rajesh@alpha.in",
        action: "UPDATE",
        table_name: "invoices",
        record_id: "inv-1",
        record_identifier: "INV/2024-25/0001",
        diff: { status: { old: "draft", new: "final" } },
        created_at: "2024-04-01T01:00:00Z",
      },
      {
        id: "3",
        business_id: "biz-1",
        user_id: "u2",
        user_email: "priya@alpha.in",
        action: "INSERT",
        table_name: "payments",
        record_id: "pay-1",
        record_identifier: "PAY-99",
        diff: { created: { amount: 10000 } },
        created_at: "2024-04-02T00:00:00Z",
      },
      {
        id: "4",
        business_id: "biz-1",
        user_id: "u2",
        user_email: "priya@alpha.in",
        action: "INSERT",
        table_name: "ledger_entries",
        record_id: "led-1",
        record_identifier: "LED-1",
        diff: { created: { amount: 10000 } },
        created_at: "2024-04-02T00:00:00Z",
      },
    ];

    it("should filter by table_name", () => {
      const invoiceOnly = filterAuditLogs(mockLogs, { table: "invoices" });
      assert.strictEqual(invoiceOnly.length, 2);
      assert.ok(invoiceOnly.every((l) => l.table_name === "invoices"));

      const paymentsOnly = filterAuditLogs(mockLogs, { table: "payments" });
      assert.strictEqual(paymentsOnly.length, 1);
      assert.strictEqual(paymentsOnly[0].table_name, "payments");
    });

    it("should filter by action", () => {
      const inserts = filterAuditLogs(mockLogs, { action: "INSERT" });
      assert.strictEqual(inserts.length, 3);
      assert.ok(inserts.every((l) => l.action === "INSERT"));

      const updates = filterAuditLogs(mockLogs, { action: "UPDATE" });
      assert.strictEqual(updates.length, 1);
      assert.strictEqual(updates[0].action, "UPDATE");
    });

    it("should search across user, record identifier, and diff payload", () => {
      const byUser = filterAuditLogs(mockLogs, { query: "priya" });
      assert.strictEqual(byUser.length, 2);

      const byInvoiceNo = filterAuditLogs(mockLogs, { query: "INV/2024-25" });
      assert.strictEqual(byInvoiceNo.length, 2);

      const byStatusDiff = filterAuditLogs(mockLogs, { query: "final" });
      assert.strictEqual(byStatusDiff.length, 1);
      assert.strictEqual(byStatusDiff[0].id, "2");
    });
  });

  describe("Admin-Only RBAC Enforcement", () => {
    it("should grant access to admin role", () => {
      assert.strictEqual(isUserAdmin("admin"), true);
      const perm = checkAdminPermission("admin");
      assert.strictEqual(perm.allowed, true);
    });

    it("should deny access to accountant role", () => {
      assert.strictEqual(isUserAdmin("accountant"), false);
      const perm = checkAdminPermission("accountant");
      assert.strictEqual(perm.allowed, false);
      assert.match(perm.error || "", /Access Denied/);
    });

    it("should deny access to auditor role", () => {
      assert.strictEqual(isUserAdmin("auditor"), false);
      const perm = checkAdminPermission("auditor");
      assert.strictEqual(perm.allowed, false);
      assert.match(perm.error || "", /Access Denied/);
    });
  });
});
