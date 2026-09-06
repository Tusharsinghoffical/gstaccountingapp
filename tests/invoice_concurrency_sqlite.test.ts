import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.ts";
import { createInvoice } from "../lib/data/invoices.ts";
import { AuthSession } from "../lib/auth/authorize.ts";

test("SQLite Concurrent Invoice Numbering - 20 Concurrent Transactions", async () => {
  // 1. Setup an isolated test business and user
  const businessId = "test-concurrency-biz-" + Date.now();
  const userId = "test-concurrency-user-" + Date.now();

  await prisma.business.create({
    data: {
      id: businessId,
      name: "Concurrency Test Corp",
      gstin: "27AABCT1234F1Z1",
      stateCode: "27",
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      email: `concurrency-${Date.now()}@test.com`,
      passwordHash: "dummy-hash",
      name: "Concurrency Tester",
    },
  });

  await prisma.businessUser.create({
    data: {
      businessId,
      userId,
      role: "admin",
      status: "active",
    },
  });

  const session: AuthSession = {
    user: { id: userId, email: "tester@test.com" },
  };

  const customer = await prisma.customer.create({
    data: {
      businessId,
      name: "Concurrency Customer",
      stateCode: "27",
    },
  });

  // 2. Fire 20 concurrent invoice creations
  const CONCURRENT_COUNT = 20;
  const fy = "2024-25";

  const promises = Array.from({ length: CONCURRENT_COUNT }).map((_, i) =>
    createInvoice(session, businessId, {
      type: "sales",
      customerOrSupplierId: customer.id,
      invoiceDate: "2024-05-10",
      financialYear: fy,
      status: "final",
      items: [
        {
          description: `Item #${i + 1}`,
          hsnCode: "998311",
          qty: 1,
          rate: 1000,
          discount: 0,
          taxableAmount: 1000,
          gstRate: 18,
          cgstAmount: 90,
          sgstAmount: 90,
          igstAmount: 0,
          amount: 1180,
        },
      ],
    })
  );

  const results = await Promise.all(promises);

  // 3. Assertions
  assert.equal(results.length, CONCURRENT_COUNT, "Must return exactly 20 created invoices");

  const invoiceNumbers = results.map((inv) => inv.invoiceNo);
  const uniqueNumbers = new Set(invoiceNumbers);

  assert.equal(
    uniqueNumbers.size,
    CONCURRENT_COUNT,
    `Must have zero duplicate invoice numbers. Found: ${invoiceNumbers.join(", ")}`
  );

  // Extract sequence numbers and sort them numerically
  const sequences = invoiceNumbers
    .map((no) => {
      const match = no.match(/^INV-2024-25-(\d+)$/);
      assert.ok(match, `Invoice number ${no} must match format INV-2024-25-XXXX`);
      return parseInt(match[1], 10);
    })
    .sort((a, b) => a - b);

  // Assert strictly contiguous sequence from 1 to 20 without any skips
  for (let idx = 0; idx < CONCURRENT_COUNT; idx++) {
    const expected = idx + 1;
    const actual = sequences[idx];
    assert.equal(
      actual,
      expected,
      `Sequence number at index ${idx} must be ${expected}, got ${actual}`
    );
  }
});
