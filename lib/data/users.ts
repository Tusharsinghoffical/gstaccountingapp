import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertBusinessMembership,
  assertRole,
  getSessionUserId,
  ForbiddenError,
} from "@/lib/auth/authorize";
import type { BusinessRole } from "@/lib/auth/authorize";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export interface BusinessMemberRecord {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  status: string;
  invitedEmail?: string | null;
  createdAt: Date;
  user?: {
    email: string;
    name?: string | null;
  };
}

export async function getBusinessMembers(
  session: AuthSession,
  businessId: string
): Promise<BusinessMemberRecord[]> {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.businessUser.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteUserToBusiness(
  session: AuthSession,
  businessId: string,
  email: string,
  role: "accountant" | "auditor"
): Promise<{ membership: BusinessMemberRecord; tempPassword?: string }> {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin"]);

  const cleanEmail = email.toLowerCase().trim();

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  let tempPassword: string | undefined;

  if (!user) {
    tempPassword = crypto.randomBytes(8).toString("hex") + "A1!";
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        name: cleanEmail.split("@")[0],
        emailVerified: true, // Invited users bypass email verification
      },
    });
  }

  // Check if already member
  const existingMembership = await prisma.businessUser.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: user.id,
      },
    },
  });

  if (existingMembership) {
    if (existingMembership.status === "active") {
      throw new Error("This user is already an active member of this business.");
    }

    const updated = await prisma.businessUser.update({
      where: { id: existingMembership.id },
      data: { role, status: "active" },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: "STATUS_CHANGE",
        tableName: "business_users",
        recordId: updated.id,
        diff: JSON.stringify({ action: "reactivate", role, email: cleanEmail }),
      },
    });

    return { membership: updated, tempPassword };
  }

  const membership = await prisma.businessUser.create({
    data: {
      businessId,
      userId: user.id,
      role,
      status: "active",
      invitedEmail: cleanEmail,
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      userId,
      action: "INSERT",
      tableName: "business_users",
      recordId: membership.id,
      diff: JSON.stringify({ role, email: cleanEmail }),
    },
  });

  return { membership, tempPassword };
}

export async function revokeBusinessMember(
  session: AuthSession,
  businessId: string,
  membershipId: string
): Promise<void> {
  const currentUserId = getSessionUserId(session);
  await assertRole(currentUserId, businessId, ["admin"]);

  const target = await prisma.businessUser.findUnique({
    where: { id: membershipId },
  });

  if (!target || target.businessId !== businessId) {
    throw new Error("Member not found in this business.");
  }

  if (target.userId === currentUserId) {
    throw new ForbiddenError("403: Forbidden - You cannot revoke your own admin account.");
  }

  await prisma.businessUser.delete({
    where: { id: membershipId },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: currentUserId,
      action: "DELETE",
      tableName: "business_users",
      recordId: membershipId,
      diff: JSON.stringify({ revokedUserId: target.userId, role: target.role }),
    },
  });
}
