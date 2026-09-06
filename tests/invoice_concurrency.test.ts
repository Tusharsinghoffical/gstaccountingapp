import { describe, it } from "node:test";
import assert from "node:assert/strict";

// JavaScript mirror of Postgres get_indian_financial_year function
export function getIndianFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1 to 12

  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");

  return `${startYear}-${endYearShort}`;
}

// Simulates row-level locked sequential counter (matching Postgres invoice_counters table)
class SafeInvoiceCounter {
  private counters = new Map<string, number>();
  private locks = new Map<string, Promise<void>>();

  async getNextNumber(businessId: string, type: string, fy: string): Promise<string> {
    const key = `${businessId}:${type}:${fy}`;

    // Acquire lock (mutex) for this specific business and FY (emulating Postgres row-level lock)
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      // Simulate minor async DB I/O delay to test race condition resilience
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5)));

      const current = this.counters.get(key) || 0;
      const next = current + 1;
      this.counters.set(key, next);

      const prefix = type === "purchase" ? "PUR" : "INV";
      return `${prefix}/${fy}/${String(next).padStart(4, "0")}`;
    } finally {
      this.locks.delete(key);
      releaseLock();
    }
  }
}

describe("Indian Financial Year Calculation", () => {
  it("computes correct FY across April-March boundaries", () => {
    // April 1, 2025 (FY start)
    assert.equal(getIndianFinancialYear(new Date(2025, 3, 1)), "2025-26");

    // Dec 31, 2025 (mid FY)
    assert.equal(getIndianFinancialYear(new Date(2025, 11, 31)), "2025-26");

    // Jan 1, 2026 (same FY)
    assert.equal(getIndianFinancialYear(new Date(2026, 0, 1)), "2025-26");

    // March 31, 2026 (FY end)
    assert.equal(getIndianFinancialYear(new Date(2026, 2, 31)), "2025-26");

    // April 1, 2026 (Next FY start)
    assert.equal(getIndianFinancialYear(new Date(2026, 3, 1)), "2026-27");
  });
});

describe("Concurrent Invoice Numbering (20 Parallel Invoices)", () => {
  it("creates 20 concurrent invoices with zero duplicates and zero skipped numbers", async () => {
    const counter = new SafeInvoiceCounter();
    const businessId = "biz-concurrency-test";
    const type = "sales";
    const fy = "2025-26";

    // Launch 20 concurrent invoice creation promises simultaneously
    const invoicePromises = Array.from({ length: 20 }, () =>
      counter.getNextNumber(businessId, type, fy)
    );

    const generatedNumbers = await Promise.all(invoicePromises);

    // 1. Assert exactly 20 numbers were generated
    assert.equal(generatedNumbers.length, 20);

    // 2. Assert NO duplicates
    const uniqueNumbers = new Set(generatedNumbers);
    assert.equal(uniqueNumbers.size, 20, "Must have zero duplicate numbers");

    // 3. Assert correct formatting
    for (const num of generatedNumbers) {
      assert.match(num, /^INV\/2025-26\/\d{4}$/);
    }

    // 4. Assert NO gaps (strictly contiguous numbers 1 to 20)
    const seqNumbers = generatedNumbers
      .map((num) => parseInt(num.split("/")[2], 10))
      .sort((a, b) => a - b);

    for (let i = 0; i < 20; i++) {
      const expected = i + 1;
      assert.equal(
        seqNumbers[i],
        expected,
        `Expected sequence number ${expected}, but found ${seqNumbers[i]}`
      );
    }
  });
});
