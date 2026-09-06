"use server";

import { getCurrentUserRole } from "./users";
import {
  type AuditLogEntry,
  filterAuditLogs,
  generateHumanReadableDiff,
  type HumanReadableAuditSummary,
} from "@/lib/audit/diff";
import type { UserRole } from "@/types";
import { prisma } from "@/lib/prisma";

export type AuditLogFilters = {
  table?: string;
  action?: string;
  query?: string;
};

export async function getAuditTrail(
  businessIdOrFilters?: string | AuditLogFilters,
  filters?: AuditLogFilters
): Promise<{
  success: boolean;
  data?: {
    logs: (AuditLogEntry & { summary: HumanReadableAuditSummary })[];
    totalCount: number;
    currentUserRole: UserRole;
  };
  error?: string;
}> {
  let businessId = "biz-1";
  let activeFilters: AuditLogFilters | undefined = filters;

  if (typeof businessIdOrFilters === "object" && businessIdOrFilters !== null) {
    activeFilters = businessIdOrFilters;
  } else if (typeof businessIdOrFilters === "string") {
    businessId = businessIdOrFilters;
  }

  // 1. Enforce RBAC permission: Admin Only
  const userInfo = await getCurrentUserRole(businessId);
  if (!userInfo.isAdmin) {
    return {
      success: false,
      error: "Access Denied: Only business administrators are authorized to inspect the financial audit trail.",
    };
  }

  // 2. Query Prisma auditLog table directly
  const logs = await prisma.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rawLogs: AuditLogEntry[] = await Promise.all(
    logs.map(async (row) => {
      let parsedDiff = {};
      try {
        parsedDiff = typeof row.diff === "string" ? JSON.parse(row.diff) : (row.diff || {});
      } catch {
        parsedDiff = {};
      }

      let userEmail = "System / Trigger";
      let userName = "System";
      if (row.userId) {
        const u = await prisma.user.findUnique({
          where: { id: row.userId },
          select: { email: true, name: true },
        });
        if (u) {
          userEmail = u.email;
          userName = u.name || u.email.split("@")[0];
        }
      }

      return {
        id: row.id,
        business_id: row.businessId,
        user_id: row.userId || null,
        user_email: userEmail,
        user_name: userName,
        action: (row.action as import("@/lib/audit/diff").AuditAction) || "SYSTEM",
        table_name: row.tableName,
        record_id: row.recordId,
        record_identifier: row.recordId.slice(0, 8),
        diff: parsedDiff as Record<string, unknown>,
        created_at: row.createdAt.toISOString(),
      };
    })
  );

  // 3. Apply filters
  const filtered = filterAuditLogs(rawLogs, {
    table: activeFilters?.table,
    action: activeFilters?.action,
    query: activeFilters?.query,
  });

  // 4. Enrich with human-readable diff breakdown
  const enriched = filtered.map((log) => ({
    ...log,
    summary: generateHumanReadableDiff(log),
  }));

  return {
    success: true,
    data: {
      logs: enriched,
      totalCount: enriched.length,
      currentUserRole: userInfo.role,
    },
  };
}

export const getFinancialAuditLogs = getAuditTrail;
