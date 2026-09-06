import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertBusinessMembership,
  assertRole,
  getSessionUserId,
} from "@/lib/auth/authorize";
import { Prisma } from "@prisma/client";

export interface LedgerEntryWithBalance {
  id: string;
  businessId: string;
  partyId: string;
  entryType: string;
  amount: string;
  refInvoiceId?: string | null;
  refPaymentId?: string | null;
  description?: string | null;
  entryDate: string;
  createdAt: Date;
  debit: number;
  credit: number;
  runningBalance: number;
  drCr: "Dr" | "Cr";
}

export async function getPartyLedger(
  session: AuthSession,
  businessId: string,
  partyId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<LedgerEntryWithBalance[]> {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      businessId,
      partyId,
      ...(dateFrom || dateTo
        ? {
            entryDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [
      { entryDate: "asc" },
      { createdAt: "asc" },
    ],
  });

  let running = 0;
  return entries.map((e) => {
    const amt = parseFloat(e.amount.toString());
    const isDebit = e.entryType === "debit";
    const debit = isDebit ? amt : 0;
    const credit = !isDebit ? amt : 0;

    // Debit increases balance (receivable), credit decreases balance
    running = running + debit - credit;

    return {
      ...e,
      amount: e.amount.toString(),
      debit,
      credit,
      runningBalance: Math.abs(running),
      drCr: running >= 0 ? "Dr" : "Cr",
    };
  });
}

export async function getPartyRunningBalance(
  session: AuthSession,
  businessId: string,
  partyId: string
): Promise<{ balance: number; drCr: "Dr" | "Cr" }> {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      businessId,
      partyId,
    },
    select: {
      entryType: true,
      amount: true,
    },
  });

  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of entries) {
    const amt = parseFloat(e.amount.toString());
    if (e.entryType === "debit") {
      totalDebit += amt;
    } else {
      totalCredit += amt;
    }
  }

  const net = totalDebit - totalCredit;
  return {
    balance: Math.abs(net),
    drCr: net >= 0 ? "Dr" : "Cr",
  };
}

export async function createLedgerEntry(
  session: AuthSession,
  businessId: string,
  data: {
    partyId: string;
    entryType: "debit" | "credit";
    amount: number | string;
    entryDate: string;
    description?: string | null;
    refInvoiceId?: string | null;
    refPaymentId?: string | null;
  }
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  const amount = new Prisma.Decimal(data.amount);

  return prisma.ledgerEntry.create({
    data: {
      businessId,
      partyId: data.partyId,
      entryType: data.entryType,
      amount,
      entryDate: data.entryDate,
      description: data.description || null,
      refInvoiceId: data.refInvoiceId || null,
      refPaymentId: data.refPaymentId || null,
    },
  });
}
