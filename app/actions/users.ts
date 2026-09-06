"use server";

import { type InviteUserFormData } from "@/lib/users/rbac";
import type { BusinessMember, UserRole } from "@/types";
import { getAuthenticatedSessionAndBusiness } from "@/lib/auth/authorize";
import {
  getBusinessMembers as dataGetBusinessMembers,
  inviteUserToBusiness as dataInviteUserToBusiness,
  revokeBusinessMember as dataRevokeBusinessMember,
} from "@/lib/data/users";
import { prisma } from "@/lib/prisma";
import { sendEmail, getEmailTemplate } from "@/lib/email/send";

/**
 * Returns the current authenticated user's role and permissions in the business.
 */
export async function getCurrentUserRole(businessId?: string): Promise<{
  role: UserRole;
  isAdmin: boolean;
  email: string;
  userId: string;
}> {
  try {
    const { session, userId, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
    const email = session.user?.email || "";

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

    return {
      role: "accountant",
      isAdmin: false,
      email,
      userId,
    };
  } catch {
    // If not authenticated, return default unprivileged state
    return {
      role: "accountant",
      isAdmin: false,
      email: "",
      userId: "",
    };
  }
}

/**
 * Retrieves all active/invited members of the specified business through lib/data/users.
 */
export async function getBusinessMembers(
  businessId?: string
): Promise<BusinessMember[]> {
  const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
  const members = await dataGetBusinessMembers(session, bizId);

  return members.map((m) => ({
    id: m.id,
    business_id: m.businessId,
    user_id: m.userId,
    email: m.user?.email || m.invitedEmail || "",
    name: m.user?.name || m.user?.email?.split("@")[0] || "User",
    role: m.role as UserRole,
    status: m.status as "active" | "invited" | "revoked",
    invited_at: m.status === "invited" ? m.createdAt.toISOString() : undefined,
    created_at: m.createdAt.toISOString(),
    updated_at: m.createdAt.toISOString(),
  }));
}

/**
 * Invites a new user by email and assigns a role (accountant / auditor).
 * Enforces admin-only permission through lib/data/users.
 */
export async function inviteBusinessUser(
  formData: InviteUserFormData,
  businessId?: string
): Promise<{ success: boolean; data?: BusinessMember; error?: string }> {
  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);

    const email = formData.email.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const { membership, tempPassword } = await dataInviteUserToBusiness(
      session,
      bizId,
      email,
      formData.role
    );

    // Dispatch invitation email
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const loginLink = `${appUrl}/login`;

    try {
      await sendEmail({
        to: email,
        subject: `You have been invited to GST Ledger as ${formData.role}`,
        html: getEmailTemplate(
          "Team Invitation",
          `<p>You have been invited to join the GST Ledger workspace as an <strong>${formData.role}</strong>.</p>
           ${tempPassword ? `<p>Your temporary password is: <code style="background:#eee;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>` : "<p>You can sign in using your existing GST Ledger credentials.</p>"}`,
          "Sign In to Workspace",
          loginLink
        ),
      });
    } catch (emailErr) {
      console.warn("Could not dispatch invite email:", emailErr);
    }

    return {
      success: true,
      data: {
        id: membership.id,
        business_id: membership.businessId,
        user_id: membership.userId,
        email: membership.user?.email || email,
        name: membership.user?.name || email.split("@")[0],
        role: membership.role as UserRole,
        status: membership.status as "active" | "invited" | "revoked",
        invited_at: membership.createdAt.toISOString(),
        created_at: membership.createdAt.toISOString(),
        updated_at: membership.createdAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to invite user.",
    };
  }
}

/**
 * Revokes a team member's access to the business through lib/data/users.
 * Enforces admin-only permission and prevents self-lockout.
 */
export async function revokeBusinessUser(
  memberId: string,
  businessId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, businessId: bizId } = await getAuthenticatedSessionAndBusiness(businessId);
    await dataRevokeBusinessMember(session, bizId, memberId);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to revoke member.",
    };
  }
}

export async function switchDemoRole(role: UserRole): Promise<UserRole> {
  return role;
}
