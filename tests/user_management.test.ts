import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inviteUserSchema,
  isUserAdmin,
  checkAdminPermission,
  processUserInvitation,
  processUserRevocation,
} from "../lib/users/rbac.ts";
import type { BusinessMember } from "../types/index.ts";

describe("User Management & Admin-Only RBAC Engine (Prompt 23)", () => {
  const adminUser = {
    role: "admin" as const,
    email: "accountant@alpha-retailers.in",
    userId: "usr-admin-1",
  };

  const accountantUser = {
    role: "accountant" as const,
    email: "priya.patel@alpha-retailers.in",
    userId: "usr-acc-1",
  };

  const auditorUser = {
    role: "auditor" as const,
    email: "audit.team@deloitte-affiliate.in",
    userId: "usr-aud-1",
  };

  const mockMembers: BusinessMember[] = [
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

  describe("Validation Schema (inviteUserSchema)", () => {
    it("accepts valid email with role 'accountant'", () => {
      const result = inviteUserSchema.safeParse({
        email: "accountant.new@example.com",
        role: "accountant",
      });
      assert.equal(result.success, true);
    });

    it("accepts valid email with role 'auditor'", () => {
      const result = inviteUserSchema.safeParse({
        email: "auditor.external@auditfirm.in",
        role: "auditor",
      });
      assert.equal(result.success, true);
    });

    it("rejects invalid or missing email addresses", () => {
      const emptyEmail = inviteUserSchema.safeParse({
        email: "",
        role: "accountant",
      });
      assert.equal(emptyEmail.success, false);

      const invalidEmail = inviteUserSchema.safeParse({
        email: "not-a-valid-email",
        role: "auditor",
      });
      assert.equal(invalidEmail.success, false);
    });

    it("rejects unauthorized role assignments (only accountant & auditor permitted)", () => {
      // Trying to assign another admin via member invite form
      const adminRole = inviteUserSchema.safeParse({
        email: "someone@example.com",
        role: "admin",
      });
      assert.equal(adminRole.success, false);

      // Arbitrary string
      const randomRole = inviteUserSchema.safeParse({
        email: "someone@example.com",
        role: "manager",
      });
      assert.equal(randomRole.success, false);
    });
  });

  describe("Admin-Only Permission Checking", () => {
    it("identifies admin role accurately", () => {
      assert.equal(isUserAdmin("admin"), true);
      assert.equal(isUserAdmin("accountant"), false);
      assert.equal(isUserAdmin("auditor"), false);

      assert.equal(checkAdminPermission("admin").allowed, true);
      assert.equal(checkAdminPermission("accountant").allowed, false);
      assert.equal(checkAdminPermission("auditor").allowed, false);
    });

    it("allows an admin to invite a new accountant or auditor", () => {
      const res = processUserInvitation(
        adminUser,
        { email: "vikram.singh@example.com", role: "accountant" },
        mockMembers
      );

      assert.equal(res.success, true);
      assert.ok(res.data);
      assert.equal(res.data.email, "vikram.singh@example.com");
      assert.equal(res.data.role, "accountant");
      assert.equal(res.data.status, "invited");
    });

    it("strictly DENIES invite action when current user is an accountant", () => {
      const res = processUserInvitation(
        accountantUser,
        { email: "test.fail@example.com", role: "accountant" },
        mockMembers
      );

      assert.equal(res.success, false);
      assert.match(res.error || "", /Access Denied/i);
    });

    it("strictly DENIES invite action when current user is an auditor", () => {
      const res = processUserInvitation(
        auditorUser,
        { email: "test.auditor.fail@example.com", role: "auditor" },
        mockMembers
      );

      assert.equal(res.success, false);
      assert.match(res.error || "", /Access Denied/i);
    });

    it("strictly DENIES revoke action when current user is not an admin", () => {
      const res = processUserRevocation(accountantUser, "usr-aud-1", mockMembers);
      assert.equal(res.success, false);
      assert.match(res.error || "", /Access Denied/i);
    });
  });

  describe("Access Revocation & Safety Protection", () => {
    it("prevents an admin from revoking their own account (safety lockout)", () => {
      const res = processUserRevocation(adminUser, "usr-admin-1", mockMembers);
      assert.equal(res.success, false);
      assert.match(res.error || "", /cannot revoke your own administrative access/i);
    });

    it("allows an admin to revoke an accountant or auditor access", () => {
      const res = processUserRevocation(adminUser, "usr-acc-1", mockMembers);
      assert.equal(res.success, true);
    });

    it("rejects duplicate invite for already existing member", () => {
      const res = processUserInvitation(
        adminUser,
        { email: "priya.patel@alpha-retailers.in", role: "accountant" },
        mockMembers
      );

      assert.equal(res.success, false);
      assert.match(res.error || "", /already belongs/i);
    });
  });
});
