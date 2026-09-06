// ==============================================================================
// Role-Based Access Control (RBAC) & User Management Engine
// Reference: 05-BUILD-PROMPTS.md (Prompt 23)
// Enforces admin-only permission for invitations and revocations.
// Protects against self-lockout.
// ==============================================================================

import { inviteUserSchema } from "../validation/user.ts";
import type { InviteUserFormData } from "../validation/user.ts";
import type { BusinessMember, UserRole } from "../../types/index.ts";

export { inviteUserSchema, type InviteUserFormData };

/**
 * Validates whether the given role has administrative privileges.
 */
export function isUserAdmin(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Checks if the caller has admin permissions, returning an error response if denied.
 */
export function checkAdminPermission(role: UserRole): {
  allowed: boolean;
  error?: string;
} {
  if (!isUserAdmin(role)) {
    return {
      allowed: false,
      error: "Access Denied: Only business administrators can manage users and roles.",
    };
  }
  return { allowed: true };
}

/**
 * Validates and executes an invitation to a business.
 */
export function processUserInvitation(
  currentUser: { role: UserRole; email: string },
  formData: InviteUserFormData,
  existingMembers: BusinessMember[],
  businessId: string = "biz-1"
): { success: boolean; data?: BusinessMember; error?: string } {
  // 1. Enforce Admin-only
  const authCheck = checkAdminPermission(currentUser.role);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  // 2. Validate input schema
  const parsed = inviteUserSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid invitation input",
    };
  }

  const { email, role } = parsed.data;

  // 3. Duplicate member check
  const duplicate = existingMembers.find(
    (m) =>
      m.business_id === businessId &&
      m.email.toLowerCase() === email.toLowerCase() &&
      m.status !== "revoked"
  );
  if (duplicate) {
    return {
      success: false,
      error: `A member with email "${email}" already belongs to this business (${duplicate.status}).`,
    };
  }

  const newMember: BusinessMember = {
    id: `usr-${Date.now()}`,
    business_id: businessId,
    user_id: `auth-${Date.now()}`,
    email,
    name: email
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    role,
    status: "invited",
    invited_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    success: true,
    data: newMember,
  };
}

/**
 * Validates and executes membership revocation.
 */
export function processUserRevocation(
  currentUser: { role: UserRole; email: string; userId?: string },
  targetMemberId: string,
  existingMembers: BusinessMember[]
): { success: boolean; error?: string } {
  // 1. Enforce Admin-only
  const authCheck = checkAdminPermission(currentUser.role);
  if (!authCheck.allowed) {
    return { success: false, error: authCheck.error };
  }

  // 2. Locate target member
  const targetMember = existingMembers.find((m) => m.id === targetMemberId);
  if (!targetMember) {
    return { success: false, error: "Target member not found." };
  }

  // 3. Safety Lockout Protection: Admin cannot revoke their own account
  if (
    targetMember.email.toLowerCase() === currentUser.email.toLowerCase() ||
    (currentUser.userId && targetMember.id === currentUser.userId)
  ) {
    return {
      success: false,
      error: "Safety Error: You cannot revoke your own administrative access.",
    };
  }

  return { success: true };
}
