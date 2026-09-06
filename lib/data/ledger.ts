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

  let running = new Prisma.Decimal(0);
  return entries.map((e) => {
    const amt = new Prisma.Decimal(e.amount);
    const isDebit = e.entryType === "debit";
    const debit = isDebit ? amt : new Prisma.Decimal(0);
    const credit = !isDebit ? amt : new Prisma.Decimal(0);

    // Debit increases balance (receivable), credit decreases balance
    running = running.add(debit).sub(credit);
    const isDr = running.gte(0);

    return {
      ...e,
      amount: e.amount.toString(),
      debit: debit.toNumber(),
      credit: credit.toNumber(),
      runningBalance: running.abs().toNumber(),
      drCr: isDr ? "Dr" : "Cr",
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

  let totalDebit = new Prisma.Decimal(0);
  let totalCredit = new Prisma.Decimal(0);

  for (const e of entries) {
    const amt = new Prisma.Decimal(e.amount);
    if (e.entryType === "debit") {
      totalDebit = totalDebit.add(amt);
    } else {
      totalCredit = totalCredit.add(amt);
    }
  }

  const net = totalDebit.sub(totalCredit);
  return {
    balance: net.abs().toNumber(),
    drCr: net.gte(0) ? "Dr" : "Cr",
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
