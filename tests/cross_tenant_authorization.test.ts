import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.ts";
import { AuthSession, ForbiddenError } from "../lib/auth/authorize.ts";

import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
} from "../lib/data/invoices.ts";

import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../lib/data/customers.ts";

import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../lib/data/suppliers.ts";

import {
  getPayments,
  getPaymentById,
  createPayment,
} from "../lib/data/payments.ts";

import {
  getPartyLedger,
  getPartyRunningBalance,
  createLedgerEntry,
} from "../lib/data/ledger.ts";

import { getAuditLogs } from "../lib/data/audit.ts";

test("Cross-Tenant Authorization Test Suite - Rigorous Multi-Tenant Boundary Enforcement", async (t) => {
  const ts = Date.now();

  // 1. Seed Business A & User A
  const bizA = await prisma.business.create({
    data: {
      id: `biz-a-${ts}`,
      name: "Business A Alpha Corp",
      gstin: "27AAAAA0000A1Z5",
      stateCode: "27",
    },
  });

  const userA = await prisma.user.create({
    data: {
      id: `usr-a-${ts}`,
      email: `user-a-${ts}@alpha.in`,
      passwordHash: "hash-a",
      name: "Admin User A",
    },
  });

  await prisma.businessUser.create({
    data: {
      businessId: bizA.id,
      userId: userA.id,
      role: "admin",
      status: "active",
    },
  });

  // 2. Seed Business B & User B
  const bizB = await prisma.business.create({
    data: {
      id: `biz-b-${ts}`,
      name: "Business B Beta Ltd",
      gstin: "29BBBBB1111B1Z6",
      stateCode: "29",
    },
  });

  const userB = await prisma.user.create({
    data: {
      id: `usr-b-${ts}`,
      email: `user-b-${ts}@beta.in`,
      passwordHash: "hash-b",
      name: "Admin User B",
    },
  });

  await prisma.businessUser.create({
    data: {
      businessId: bizB.id,
      userId: userB.id,
      role: "admin",
      status: "active",
    },
  });

  const sessionA: AuthSession = { user: { id: userA.id, email: userA.email } };
  const sessionB: AuthSession = { user: { id: userB.id, email: userB.email } };

  // 3. Seed resources in Business A owned by User A
  const customerA = await createCustomer(sessionA, bizA.id, {
    name: "Customer of Business A",
    stateCode: "27",
  });

  const supplierA = await createSupplier(sessionA, bizA.id, {
    name: "Supplier of Business A",
    stateCode: "27",
  });

  const invoiceA = await createInvoice(sessionA, bizA.id, {
    type: "sales",
    customerOrSupplierId: customerA.id,
    invoiceDate: "2024-04-10",
    status: "final",
    items: [
      {
        description: "Services A",
        hsnCode: "998311",
        qty: 1,
        rate: 5000,
        taxableAmount: 5000,
        gstRate: 18,
        cgstAmount: 450,
        sgstAmount: 450,
        igstAmount: 0,
        amount: 5900,
      },
    ],
  });

  const paymentA = await createPayment(sessionA, bizA.id, {
    partyId: customerA.id,
    amount: 5900,
    date: "2024-04-11",
    mode: "bank_transfer",
  });

  // Helper to assert that an async operation throws 403 Forbidden
  async function assertThrows403(fn: () => Promise<unknown>, desc: string) {
    await assert.rejects(
      async () => {
        await fn();
      },
      (err: unknown) => {
        assert.ok(
          err instanceof ForbiddenError ||
            (err instanceof Error && err.message.includes("403")),
          `${desc} must fail with 403 Forbidden. Got: ${err}`
        );
        return true;
      },
      desc
    );
  }

  // ── INVOICES MODULE AUTHORIZATION TESTS ─────────────────────────────────────
  await t.test("Invoices: User B cannot read Business A invoices", async () => {
    await assertThrows403(
      () => getInvoices(sessionB, bizA.id),
      "User B querying Business A invoices"
    );
  });

  await t.test("Invoices: User B cannot read Business A invoice by ID", async () => {
    await assertThrows403(
      () => getInvoiceById(sessionB, bizA.id, invoiceA.id),
      "User B reading Business A invoice by ID"
    );
  });

  await t.test("Invoices: User B cannot create invoice in Business A", async () => {
    await assertThrows403(
      () =>
        createInvoice(sessionB, bizA.id, {
          type: "sales",
          customerOrSupplierId: customerA.id,
          invoiceDate: "2024-04-12",
          items: [
            {
              description: "Attack item",
              hsnCode: "998311",
              qty: 1,
              rate: 100,
              taxableAmount: 100,
              gstRate: 18,
              cgstAmount: 9,
              sgstAmount: 9,
              igstAmount: 0,
              amount: 118,
            },
          ],
        }),
      "User B creating invoice in Business A"
    );
  });

  await t.test("Invoices: User B cannot modify invoice status in Business A", async () => {
    await assertThrows403(
      () => updateInvoiceStatus(sessionB, bizA.id, invoiceA.id, "cancelled"),
      "User B updating invoice status in Business A"
    );
  });

  // ── CUSTOMERS MODULE AUTHORIZATION TESTS ────────────────────────────────────
  await t.test("Customers: User B cannot read Business A customers", async () => {
    await assertThrows403(
      () => getCustomers(sessionB, bizA.id),
      "User B querying Business A customers"
    );
  });

  await t.test("Customers: User B cannot read Business A customer by ID", async () => {
    await assertThrows403(
      () => getCustomerById(sessionB, bizA.id, customerA.id),
      "User B reading Business A customer by ID"
    );
  });

  await t.test("Customers: User B cannot create customer in Business A", async () => {
    await assertThrows403(
      () =>
        createCustomer(sessionB, bizA.id, {
          name: "Malicious Customer",
          stateCode: "27",
        }),
      "User B creating customer in Business A"
    );
  });

  await t.test("Customers: User B cannot update customer in Business A", async () => {
    await assertThrows403(
      () => updateCustomer(sessionB, bizA.id, customerA.id, { name: "Hacked Name" }),
      "User B updating customer in Business A"
    );
  });

  await t.test("Customers: User B cannot delete customer in Business A", async () => {
    await assertThrows403(
      () => deleteCustomer(sessionB, bizA.id, customerA.id),
      "User B deleting customer in Business A"
    );
  });

  // ── SUPPLIERS MODULE AUTHORIZATION TESTS ────────────────────────────────────
  await t.test("Suppliers: User B cannot read Business A suppliers", async () => {
    await assertThrows403(
      () => getSuppliers(sessionB, bizA.id),
      "User B querying Business A suppliers"
    );
  });

  await t.test("Suppliers: User B cannot read Business A supplier by ID", async () => {
    await assertThrows403(
      () => getSupplierById(sessionB, bizA.id, supplierA.id),
      "User B reading Business A supplier by ID"
    );
  });

  await t.test("Suppliers: User B cannot create supplier in Business A", async () => {
    await assertThrows403(
      () =>
        createSupplier(sessionB, bizA.id, {
          name: "Malicious Supplier",
          stateCode: "27",
        }),
      "User B creating supplier in Business A"
    );
  });

  await t.test("Suppliers: User B cannot update supplier in Business A", async () => {
    await assertThrows403(
      () => updateSupplier(sessionB, bizA.id, supplierA.id, { name: "Hacked Supplier" }),
      "User B updating supplier in Business A"
    );
  });

  await t.test("Suppliers: User B cannot delete supplier in Business A", async () => {
    await assertThrows403(
      () => deleteSupplier(sessionB, bizA.id, supplierA.id),
      "User B deleting supplier in Business A"
    );
  });

  // ── PAYMENTS MODULE AUTHORIZATION TESTS ─────────────────────────────────────
  await t.test("Payments: User B cannot read Business A payments", async () => {
    await assertThrows403(
      () => getPayments(sessionB, bizA.id),
      "User B querying Business A payments"
    );
  });

  await t.test("Payments: User B cannot read Business A payment by ID", async () => {
    await assertThrows403(
      () => getPaymentById(sessionB, bizA.id, paymentA.id),
      "User B reading Business A payment by ID"
    );
  });

  await t.test("Payments: User B cannot create payment in Business A", async () => {
    await assertThrows403(
      () =>
        createPayment(sessionB, bizA.id, {
          partyId: customerA.id,
          amount: 1000,
          date: "2024-04-15",
          mode: "cash",
        }),
      "User B creating payment in Business A"
    );
  });

  // ── LEDGER MODULE AUTHORIZATION TESTS ───────────────────────────────────────
  await t.test("Ledger: User B cannot read Business A party ledger", async () => {
    await assertThrows403(
      () => getPartyLedger(sessionB, bizA.id, customerA.id),
      "User B querying Business A ledger entries"
    );
  });

  await t.test("Ledger: User B cannot read Business A running balance", async () => {
    await assertThrows403(
      () => getPartyRunningBalance(sessionB, bizA.id, customerA.id),
      "User B querying Business A party balance"
    );
  });

  await t.test("Ledger: User B cannot create ledger entry in Business A", async () => {
    await assertThrows403(
      () =>
        createLedgerEntry(sessionB, bizA.id, {
          partyId: customerA.id,
          entryType: "debit",
          amount: 500,
          entryDate: "2024-04-15",
        }),
      "User B creating ledger entry in Business A"
    );
  });

  // ── AUDIT LOG MODULE AUTHORIZATION TESTS ────────────────────────────────────
  await t.test("Audit: User B cannot view Business A audit trail", async () => {
    await assertThrows403(
      () => getAuditLogs(sessionB, bizA.id),
      "User B reading Business A audit logs"
    );
  });

  // ── SYMMETRIC BIDIRECTIONAL TEST (User A -> Business B) ────────────────────
  await t.test("Symmetric Isolation: User A cannot read Business B resources", async () => {
    await assertThrows403(
      () => getInvoices(sessionA, bizB.id),
      "User A querying Business B invoices"
    );
    await assertThrows403(
      () => getCustomers(sessionA, bizB.id),
      "User A querying Business B customers"
    );
    await assertThrows403(
      () => getSuppliers(sessionA, bizB.id),
      "User A querying Business B suppliers"
    );
    await assertThrows403(
      () => getPayments(sessionA, bizB.id),
      "User A querying Business B payments"
    );
    await assertThrows403(
      () => getAuditLogs(sessionA, bizB.id),
      "User A querying Business B audit logs"
    );
  });
});
