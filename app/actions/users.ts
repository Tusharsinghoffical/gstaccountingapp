"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  processUserInvitation,
  processUserRevocation,
  type InviteUserFormData,
} from "@/lib/users/rbac";
import type { BusinessMember, UserRole } from "@/types";

// In-memory demo store for business members
let demoMembers: BusinessMember[] = [
  {
    id: "usr-admin-1",
    business_id: "biz-1",
    user_id: "auth-admin-1",
    email: "accountant@alpha-retailers.in",
    name: "Rajesh Sharma",
    role: "admin",
    status: "active",
    created_at: "2024-01-01T09:00:00Z",
    updated_at: "2024-01-01T09:00:00Z",
  },
  {
    id: "usr-acc-1",
    business_id: "biz-1",
    user_id: "auth-acc-1",
    email: "priya.patel@alpha-retailers.in",
    name: "Priya Patel",
    role: "accountant",
    status: "active",
    created_at: "2024-02-15T11:30:00Z",
    updated_at: "2024-02-15T11:30:00Z",
  },
  {
    id: "usr-aud-1",
    business_id: "biz-1",
    user_id: "auth-aud-1",
    email: "audit.team@deloitte-affiliate.in",
    name: "Suresh Menon",
    role: "auditor",
    status: "invited",
    invited_at: "2024-04-10T14:20:00Z",
    created_at: "2024-04-10T14:20:00Z",
    updated_at: "2024-04-10T14:20:00Z",
  },
];

let demoActiveRole: UserRole = "admin";
let demoActiveEmail = "accountant@alpha-retailers.in";

/**
 * Returns the current authenticated user's role and permissions in the business.
 */
export async function getCurrentUserRole(businessId: string = "biz-1"): Promise<{
  role: UserRole;
  isAdmin: boolean;
  email: string;
  userId: string;
}> {
  return {
    role: demoActiveRole,
    isAdmin: demoActiveRole === "admin",
    email: demoActiveEmail,
    userId: "usr-admin-1",
  };
}

/**
 * Switches the active simulated role (useful for verifying the admin-only UI route guard).
 */
export async function switchDemoRole(role: UserRole): Promise<UserRole> {
  demoActiveRole = role;
  if (role === "accountant") {
    demoActiveEmail = "priya.patel@alpha-retailers.in";
  } else if (role === "auditor") {
    demoActiveEmail = "audit.team@deloitte-affiliate.in";
  } else {
    demoActiveEmail = "accountant@alpha-retailers.in";
  }
  return demoActiveRole;
}

/**
 * Retrieves all members of the specified business.
 */
export async function getBusinessMembers(
  businessId: string = "biz-1"
): Promise<BusinessMember[]> {
  return [...demoMembers.filter((m) => m.business_id === businessId && m.status !== "revoked")];
}

/**
 * Invites a new user by email and assigns a role (accountant / auditor).
 * Triggers Supabase Auth's native inviteUserByEmail flow (NOT custom email/SMTP).
 * Enforces admin-only permission.
 */
export async function inviteBusinessUser(
  formData: InviteUserFormData,
  businessId: string = "biz-1"
): Promise<{ success: boolean; data?: BusinessMember; error?: string }> {
  const current = await getCurrentUserRole(businessId);

  // Run pure domain validation and RBAC checks
  const result = processUserInvitation(
    current,
    formData,
    demoMembers,
    businessId
  );

  if (!result.success || !result.data) {
    return result;
  }

  // If Supabase Admin Client is available, trigger native invite flow
  try {
    const adminClient = createAdminClient();
    if (adminClient) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const { data: authData, error: authError } =
        await adminClient.auth.admin.inviteUserByEmail(formData.email, {
          data: {
            business_id: businessId,
            role: formData.role,
          },
          redirectTo: `${siteUrl}/auth/callback`,
        });

      if (authError) {
        return {
          success: false,
          error: `Supabase Auth invite failed: ${authError.message}`,
        };
      }

      const newUserId = authData?.user?.id;
      if (newUserId) {
        await adminClient.from("business_users").insert({
          business_id: businessId,
          user_id: newUserId,
          role: formData.role,
          status: "invited",
          invited_email: formData.email,
        });
      }
    }
  } catch (err: unknown) {
    console.warn("Supabase Auth admin invite call failed, proceeding in demo store:", err);
  }

  demoMembers.push(result.data);
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Revokes a team member's access to the business.
 * Enforces admin-only permission and prevents self-lockout.
 */
export async function revokeBusinessUser(
  memberId: string,
  businessId: string = "biz-1"
): Promise<{ success: boolean; error?: string }> {
  const current = await getCurrentUserRole(businessId);

  // Run pure domain validation and RBAC checks
  const result = processUserRevocation(current, memberId, demoMembers);
  if (!result.success) {
    return result;
  }

  try {
    const adminClient = createAdminClient();
    if (adminClient) {
      await adminClient
        .from("business_users")
        .delete()
        .eq("id", memberId)
        .eq("business_id", businessId);
    }
  } catch {
    // Fall back to demo store
  }

  const idx = demoMembers.findIndex((m) => m.id === memberId);
  if (idx !== -1) {
    demoMembers[idx].status = "revoked";
  }

  return { success: true };
}
