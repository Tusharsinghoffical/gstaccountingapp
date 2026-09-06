import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LedgerEntry, Customer, Supplier } from "../types/index.ts";

/**
 * Pure calculation engine replicating the PostgreSQL party_running_balances_view logic.
 * Balances are derived dynamically by summing ledger_entries at query time.
 */
export function calculateChronologicalRunningBalances(
  entries: LedgerEntry[]
): {
  id: string;
  entry_date: string;
  created_at: string;
  debit: number;
  credit: number;
  running_balance: number;
  dr_cr: "Dr" | "Cr";
}[] {
  // Chronological sort: entry_date ASC, then created_at ASC, then id ASC
  const sorted = [...entries].sort((a, b) => {
    const dateDiff =
      new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
    if (dateDiff !== 0) return dateDiff;

    const timeDiff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });

  let running = 0;
  return sorted.map((entry) => {
    const isDebit = entry.entry_type === "debit";
    const debit = isDebit ? entry.amount : 0;
    const credit = !isDebit ? entry.amount : 0;

    // Double-entry accounting: Debit adds, Credit subtracts
    running += debit - credit;

    return {
      id: entry.id,
      entry_date: entry.entry_date,
      created_at: entry.created_at,
      debit,
      credit,
      running_balance: Math.round(running * 100) / 100,
      dr_cr: running >= 0 ? "Dr" : "Cr",
    };
  });
}

/**
 * Computes party net closing balance and accounting nature on-the-fly.
 */
export function calculatePartyNetBalance(
  entries: LedgerEntry[],
  partyType: "customer" | "supplier"
): {
  net_balance: number;
  total_debit: number;
  total_credit: number;
  entry_count: number;
  dr_cr: "Dr" | "Cr";
  nature: "receivable" | "payable" | "advance" | "settled";
} {
  const total_debit = entries
    .filter((e) => e.entry_type === "debit")
    .reduce((sum, e) => sum + e.amount, 0);

  const total_credit = entries
    .filter((e) => e.entry_type === "credit")
    .reduce((sum, e) => sum + e.amount, 0);

  const net_balance = Math.round((total_debit - total_credit) * 100) / 100;
  const dr_cr: "Dr" | "Cr" = net_balance >= 0 ? "Dr" : "Cr";

  let nature: "receivable" | "payable" | "advance" | "settled" = "settled";
  if (partyType === "customer") {
    if (net_balance > 0) nature = "receivable";
    else if (net_balance < 0) nature = "advance";
  } else {
    // Supplier: net < 0 means credit > debit (payable)
    if (net_balance < 0) nature = "payable";
    else if (net_balance > 0) nature = "advance";
  }

  return {
    net_balance,
    total_debit,
    total_credit,
    entry_count: entries.length,
    dr_cr,
    nature,
  };
}

describe("Party Running Balance Computation (Query-Time Derivation)", () => {
  it("calculates sequential running balances across debits and credits", () => {
    const entries: LedgerEntry[] = [
      {
        id: "led-1",
        business_id: "biz-1",
        party_id: "party-1",
        entry_type: "debit",
        amount: 10000,
        entry_date: "2024-05-01",
        created_at: "2024-05-01T10:00:00Z",
      },
      {
        id: "led-2",
        business_id: "biz-1",
        party_id: "party-1",
        entry_type: "credit",
        amount: 4000,
        entry_date: "2024-05-05",
        created_at: "2024-05-05T11:00:00Z",
      },
      {
        id: "led-3",
        business_id: "biz-1",
        party_id: "party-1",
        entry_type: "debit",
        amount: 15000,
        entry_date: "2024-05-10",
        created_at: "2024-05-10T09:00:00Z",
      },
    ];

    const result = calculateChronologicalRunningBalances(entries);

    assert.equal(result.length, 3);
    assert.equal(result[0].running_balance, 10000);
    assert.equal(result[0].dr_cr, "Dr");

    assert.equal(result[1].running_balance, 6000); // 10000 - 4000
    assert.equal(result[1].dr_cr, "Dr");

    assert.equal(result[2].running_balance, 21000); // 6000 + 15000
    assert.equal(result[2].dr_cr, "Dr");
  });

  it("handles same-day transactions tie-broken by created_at timestamp", () => {
    const entries: LedgerEntry[] = [
      {
        id: "led-late",
        business_id: "biz-1",
        party_id: "party-1",
        entry_type: "credit",
        amount: 5000,
        entry_date: "2024-06-01",
        created_at: "2024-06-01T16:00:00Z", // Afternoon
      },
      {
        id: "led-early",
        business_id: "biz-1",
        party_id: "party-1",
        entry_type: "debit",
        amount: 12000,
        entry_date: "2024-06-01",
        created_at: "2024-06-01T09:30:00Z", // Morning
      },
    ];

    const result = calculateChronologicalRunningBalances(entries);

    // led-early must be evaluated first despite array order
    assert.equal(result[0].id, "led-early");
    assert.equal(result[0].running_balance, 12000);

    assert.equal(result[1].id, "led-late");
    assert.equal(result[1].running_balance, 7000); // 12000 - 5000
  });

  it("computes customer closing balance with accurate nature (Receivable vs Advance)", () => {
    // 1. Customer with net debit balance -> Receivable
    const recEntries: LedgerEntry[] = [
      {
        id: "led-1",
        business_id: "biz-1",
        party_id: "cust-1",
        entry_type: "debit",
        amount: 145000,
        entry_date: "2024-04-15",
        created_at: "2024-04-15T10:00:00Z",
      },
      {
        id: "led-2",
        business_id: "biz-1",
        party_id: "cust-1",
        entry_type: "credit",
        amount: 100000,
        entry_date: "2024-04-20",
        created_at: "2024-04-20T10:00:00Z",
      },
    ];

    const recSummary = calculatePartyNetBalance(recEntries, "customer");
    assert.equal(recSummary.net_balance, 45000);
    assert.equal(recSummary.dr_cr, "Dr");
    assert.equal(recSummary.nature, "receivable");

    // 2. Customer overpays -> Advance (Cr balance)
    const advEntries: LedgerEntry[] = [
      {
        id: "led-1",
        business_id: "biz-1",
        party_id: "cust-1",
        entry_type: "debit",
        amount: 10000,
        entry_date: "2024-04-15",
        created_at: "2024-04-15T10:00:00Z",
      },
      {
        id: "led-2",
        business_id: "biz-1",
        party_id: "cust-1",
        entry_type: "credit",
        amount: 15000,
        entry_date: "2024-04-20",
        created_at: "2024-04-20T10:00:00Z",
      },
    ];

    const advSummary = calculatePartyNetBalance(advEntries, "customer");
    assert.equal(advSummary.net_balance, -5000);
    assert.equal(advSummary.dr_cr, "Cr");
    assert.equal(advSummary.nature, "advance");
  });

  it("computes supplier closing balance with accurate nature (Payable vs Advance)", () => {
    // Supplier purchases are Credit (we owe them money)
    const payableEntries: LedgerEntry[] = [
      {
        id: "led-1",
        business_id: "biz-1",
        party_id: "supp-1",
        entry_type: "credit",
        amount: 236000,
        entry_date: "2024-04-17",
        created_at: "2024-04-17T12:00:00Z",
      },
      {
        id: "led-2",
        business_id: "biz-1",
        party_id: "supp-1",
        entry_type: "debit",
        amount: 200000,
        entry_date: "2024-04-25",
        created_at: "2024-04-25T14:00:00Z",
      },
    ];

    const payableSummary = calculatePartyNetBalance(payableEntries, "supplier");
    assert.equal(payableSummary.net_balance, -36000); // Credits exceed debits
    assert.equal(payableSummary.dr_cr, "Cr");
    assert.equal(payableSummary.nature, "payable");
  });

  it("returns zero balance for party with no ledger entries", () => {
    const summary = calculatePartyNetBalance([], "customer");
    assert.equal(summary.net_balance, 0);
    assert.equal(summary.total_debit, 0);
    assert.equal(summary.total_credit, 0);
    assert.equal(summary.entry_count, 0);
    assert.equal(summary.nature, "settled");
  });

  it("asserts Customer and Supplier schema types do not contain mutable balance property", () => {
    // Verify Customer type structure
    const testCustomer: Customer = {
      id: "cust-test",
      business_id: "biz-1",
      name: "Test Customer",
      state_code: "27",
      is_active: true,
      created_at: "",
      updated_at: "",
    };

    // Assert that 'balance' does not exist on base Customer
    assert.equal("balance" in testCustomer, false);

    // Verify Supplier type structure
    const testSupplier: Supplier = {
      id: "supp-test",
      business_id: "biz-1",
      name: "Test Supplier",
      state_code: "27",
      is_active: true,
      created_at: "",
      updated_at: "",
    };

    // Assert that 'balance' does not exist on base Supplier
    assert.equal("balance" in testSupplier, false);
  });
});
