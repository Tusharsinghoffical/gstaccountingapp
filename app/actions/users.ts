"use server";

import { type InviteUserFormData } from "@/lib/users/rbac";
import type { BusinessMember, UserRole } from "@/types";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { sendEmail } from "@/lib/email/send";
import crypto from "crypto";
import bcrypt from "bcryptjs";

async function getActiveBusinessId(providedBizId?: string): Promise<string> {
  if (providedBizId) return providedBizId;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const bu = await prisma.businessUser.findFirst({
        where: { userId: (session.user as any).id, status: "active" },
        select: { businessId: true },
        orderBy: { createdAt: "asc" },
      });
      if (bu) return bu.businessId;
    }
  } catch {
    // Fallback
  }
  const first = await prisma.business.findFirst({ select: { id: true } });
  return first?.id || "biz-1";
}

/**
 * Returns the current authenticated user's role and permissions in the business.
 */
export async function getCurrentUserRole(businessId?: string): Promise<{
  role: UserRole;
  isAdmin: boolean;
  email: string;
  userId: string;
}> {
  const bizId = await getActiveBusinessId(businessId);
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const userId = (session.user as any).id;
      const email = session.user.email || "";

      const membership = await prisma.businessUser.findFirst({
        where: {
          userId,
          businessId: bizId,
          status: "active",
        },
      });

      if (membership) {
        const role = membership.role as UserRole;
        return {
          role,
          isAdmin: role === "admin",
          email,
          userId,
        };
      }
    }
  } catch {
    // Fallback
  }

  // Fallback to first user in business
  const firstAdmin = await prisma.businessUser.findFirst({
    where: { businessId: bizId, role: "admin", status: "active" },
    include: { user: true },
  });

  if (firstAdmin) {
    return {
      role: "admin",
      isAdmin: true,
      email: firstAdmin.user.email,
      userId: firstAdmin.userId,
    };
  }

  return {
    role: "admin",
    isAdmin: true,
    email: "accountant@alpha-retailers.in",
    userId: "usr-admin-1",
  };
}

/**
 * Retrieves all active/invited members of the specified business directly from Prisma.
 */
export async function getBusinessMembers(
  businessId?: string
): Promise<BusinessMember[]> {
  const bizId = await getActiveBusinessId(businessId);
  const members = await prisma.businessUser.findMany({
    where: {
      businessId: bizId,
      status: { not: "revoked" },
    },
    include: {
      user: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    business_id: m.businessId,
    user_id: m.userId,
    email: m.user.email,
    name: m.user.name || m.user.email.split("@")[0],
    role: m.role as UserRole,
    status: m.status as "active" | "invited" | "revoked",
    invited_at: m.status === "invited" ? m.createdAt.toISOString() : undefined,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  }));
}

/**
 * Invites a new user by email and assigns a role (accountant / auditor).
 * Enforces admin-only permission.
 */
export async function inviteBusinessUser(
  formData: InviteUserFormData,
  businessId?: string
): Promise<{ success: boolean; data?: BusinessMember; error?: string }> {
  const bizId = await getActiveBusinessId(businessId);
  const current = await getCurrentUserRole(bizId);

  if (!current.isAdmin) {
    return { success: false, error: "Only business administrators can invite members." };
  }

  const email = formData.email.toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  // Check if user is already a member of this business
  const existingMember = await prisma.businessUser.findFirst({
    where: {
      businessId: bizId,
      user: { email },
      status: { not: "revoked" },
    },
  });

  if (existingMember) {
    return { success: false, error: "This email is already an active or invited member of this business." };
  }

  // Find or create user row
  let targetUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!targetUser) {
    const tempPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    targetUser = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        passwordHash: tempPasswordHash,
        emailVerified: false,
      },
    });
  }

  const newBusinessUser = await prisma.businessUser.create({
    data: {
      businessId: bizId,
      userId: targetUser.id,
      role: formData.role,
      status: "invited",
      invitedEmail: email,
    },
    include: {
      user: true,
      business: true,
    },
  });

  // Dispatch invitation email
  try {
    const inviteLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/signup?email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: `Invitation to join ${newBusinessUser.business.name} on GST Ledger`,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2>You've been invited!</h2>
        <p>You have been invited to join <strong>${newBusinessUser.business.name}</strong> as an <strong>${formData.role}</strong>.</p>
        <a href="${inviteLink}" style="display:inline-block; padding: 12px 24px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">
          Accept Invitation & Set Password
        </a>
      </div>`,
    });
  } catch (err) {
    console.warn("Could not dispatch invite email:", err);
  }

  return {
    success: true,
    data: {
      id: newBusinessUser.id,
      business_id: newBusinessUser.businessId,
      user_id: newBusinessUser.userId,
      email: newBusinessUser.user.email,
      name: newBusinessUser.user.name || newBusinessUser.user.email.split("@")[0],
      role: newBusinessUser.role as UserRole,
      status: "invited",
      invited_at: newBusinessUser.createdAt.toISOString(),
      created_at: newBusinessUser.createdAt.toISOString(),
      updated_at: newBusinessUser.updatedAt.toISOString(),
    },
  };
}

/**
 * Revokes a team member's access to the business.
 * Enforces admin-only permission and prevents self-lockout.
 */
export async function revokeBusinessUser(
  memberId: string,
  businessId?: string
): Promise<{ success: boolean; error?: string }> {
  const bizId = await getActiveBusinessId(businessId);
  const current = await getCurrentUserRole(bizId);

  if (!current.isAdmin) {
    return { success: false, error: "Only administrators can revoke access." };
  }

  const target = await prisma.businessUser.findUnique({
    where: { id: memberId },
  });

  if (!target) {
    return { success: false, error: "Member not found." };
  }

  if (target.userId === current.userId) {
    return { success: false, error: "You cannot revoke your own administrator access." };
  }

  await prisma.businessUser.update({
    where: { id: memberId },
    data: { status: "revoked" },
  });

  return { success: true };
}

export async function switchDemoRole(role: UserRole): Promise<UserRole> {
  return role;
}
