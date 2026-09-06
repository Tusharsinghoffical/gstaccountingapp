"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  getCurrentUserRole,
  getBusinessMembers,
  inviteBusinessUser,
  revokeBusinessUser,
  switchDemoRole,
} from "@/app/actions/users";
import type { BusinessMember, UserRole } from "@/types";
import { AdminRouteGuard } from "@/components/auth/AdminRouteGuard";
import { Button, Input } from "@/components/ui";

export default function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState<{
    role: UserRole;
    isAdmin: boolean;
    email: string;
    userId: string;
  }>({
    role: "admin",
    isAdmin: true,
    email: "accountant@alpha-retailers.in",
    userId: "usr-admin-1",
  });

  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Form State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"accountant" | "auditor">("accountant");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revocation State
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [roleInfo, memberList] = await Promise.all([
        getCurrentUserRole(),
        getBusinessMembers(),
      ]);
      setCurrentUser(roleInfo);
      setMembers(memberList);
    } catch (err) {
      console.error("Failed to load user management data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      loadData();
    });
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await inviteBusinessUser({
        email: inviteEmail,
        role: inviteRole,
      });

      if (!res.success) {
        setInviteError(res.error || "Failed to send invitation.");
      } else {
        setInviteSuccess(`Invitation recorded for ${inviteEmail}.`);
        setInviteEmail("");
        // Refresh member list
        const updated = await getBusinessMembers();
        setMembers(updated);
        setTimeout(() => {
          setIsInviteOpen(false);
          setInviteSuccess(null);
        }, 1500);
      }
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (member: BusinessMember) => {
    if (
      !window.confirm(
        `Are you sure you want to revoke access for ${member.email}? They will immediately lose access to this business.`
      )
    ) {
      return;
    }

    setRevokingId(member.id);
    try {
      const res = await revokeBusinessUser(member.id);
      if (!res.success) {
        alert(res.error || "Failed to revoke access.");
      } else {
        const updated = await getBusinessMembers();
        setMembers(updated);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to revoke user.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleSimulateRole = async (newRole: UserRole) => {
    await switchDemoRole(newRole);
    loadData();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
            <Link href="/settings" className="hover:text-neutral-700 transition-colors">
              Settings
            </Link>
            <span>/</span>
            <span className="text-neutral-700">User Management</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Team & Role Management</span>
            <span className="text-2xs font-mono font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
              Admin Only
            </span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Invite users by email, assign roles (Accountant / Auditor), and manage business access.
          </p>
        </div>

        {/* Action Button & Role Simulator */}
        <div className="flex items-center gap-3">
          {/* Quick Role Simulator for Testing Route Guard */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white shadow-sm text-xs">
            <span className="text-neutral-400 font-semibold">Active Role:</span>
            <select
              value={currentUser.role}
              onChange={(e) => handleSimulateRole(e.target.value as UserRole)}
              className="font-bold text-neutral-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="admin">Admin (Full Access)</option>
              <option value="accountant">Accountant</option>
              <option value="auditor">Auditor</option>
            </select>
          </div>

          {currentUser.isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Invite Member</span>
            </Button>
          )}
        </div>
      </div>

      {/* Settings Tab Navigation */}
      <div className="border-b border-neutral-200 flex items-center gap-6 text-sm font-semibold">
        <Link
          href="/settings"
          className="pb-3 text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Business Profile
        </Link>
        <Link
          href="/settings/users"
          className="pb-3 text-brand-700 border-b-2 border-brand-700 font-bold flex items-center gap-2"
        >
          <span>User Management</span>
          <span className="text-3xs font-mono font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">
            Admin
          </span>
        </Link>
        <Link
          href="/settings/audit-log"
          className="pb-3 text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-2"
        >
          <span>Financial Audit Log</span>
          <span className="text-3xs font-mono font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">
            Admin
          </span>
        </Link>
      </div>

      {/* UI ROUTE GUARD: Intercepts Non-Admins */}
      <AdminRouteGuard userRole={currentUser.role}>
        {/* Members Table Card */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-card overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/60">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Current Business Members</h3>
              <p className="text-xs text-neutral-500">
                Team members authorized to access this GST business entity.
              </p>
            </div>
            <span className="text-xs font-semibold text-neutral-400">
              {members.length} Member{members.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-900 text-white text-2xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Invited / Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-400">
                      <span className="animate-spin inline-block mr-2">🔄</span>
                      Loading business members...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-400">
                      No members found.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const isCurrentAdmin =
                      member.email.toLowerCase() === currentUser.email.toLowerCase() ||
                      member.id === currentUser.userId;

                    return (
                      <tr key={member.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center text-xs">
                              {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-neutral-900">
                                {member.name || member.email.split("@")[0]}
                                {isCurrentAdmin && (
                                  <span className="ml-2 text-3xs font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-2xs text-neutral-500 font-mono">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-wider ${
                              member.role === "admin"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : member.role === "accountant"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold ${
                              member.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                member.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            <span className="capitalize">{member.status}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-neutral-600 text-2xs">
                          {new Date(member.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isCurrentAdmin ? (
                            <span className="text-2xs text-neutral-400 italic">
                              Owner
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevoke(member)}
                              disabled={revokingId === member.id}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline transition-colors disabled:opacity-50"
                            >
                              {revokingId === member.id ? "Revoking..." : "Revoke Access"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite Member Modal */}
        {isInviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-neutral-200 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Invite Team Member
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Send an invitation to join this business entity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {inviteError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">
                  {inviteSuccess}
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    User Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Assign Role
                  </label>
                  <div className="space-y-2.5">
                    {/* Accountant Card */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        inviteRole === "accountant"
                          ? "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500"
                          : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="accountant"
                        checked={inviteRole === "accountant"}
                        onChange={() => setInviteRole("accountant")}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-neutral-900">
                          Accountant
                        </div>
                        <p className="text-2xs text-neutral-500 leading-relaxed mt-0.5">
                          Create & finalize sales/purchase invoices, allocate payments, and run GSTR & ageing reports.
                        </p>
                      </div>
                    </label>

                    {/* Auditor Card */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        inviteRole === "auditor"
                          ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500"
                          : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="auditor"
                        checked={inviteRole === "auditor"}
                        onChange={() => setInviteRole("auditor")}
                        className="mt-1 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-neutral-900">
                          Auditor
                        </div>
                        <p className="text-2xs text-neutral-500 leading-relaxed mt-0.5">
                          Read-only compliance access to view invoices, double-entry ledger entries, and audit logs.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Notice banner */}
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-2xs text-neutral-600 flex items-start gap-2">
                  <span className="text-xs">⚡</span>
                  <span>
                    Sending the invite registers the membership in the <strong>local business directory</strong> with role-based access control.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInviteOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending Invite..." : "Send Invite"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AdminRouteGuard>
    </div>
  );
}
