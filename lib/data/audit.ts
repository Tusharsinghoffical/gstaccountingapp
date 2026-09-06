import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertRole,
  getSessionUserId,
} from "@/lib/auth/authorize";

export async function getAuditLogs(
  session: AuthSession,
  businessId: string,
  filter?: { tableName?: string; recordId?: string }
) {
  const userId = getSessionUserId(session);
  // Audit logs are admin-only
  await assertRole(userId, businessId, ["admin"]);

  return prisma.auditLog.findMany({
    where: {
      businessId,
      ...(filter?.tableName ? { tableName: filter.tableName } : {}),
      ...(filter?.recordId ? { recordId: filter.recordId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function logAuditEvent(
  businessId: string,
  userId: string | null,
  action: string,
  tableName: string,
  recordId: string,
  diff: unknown
) {
  return prisma.auditLog.create({
    data: {
      businessId,
      userId,
      action,
      tableName,
      recordId,
      diff: typeof diff === "string" ? diff : JSON.stringify(diff),
    },
  });
}
