"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { UserRole } from "@/types";

export interface AdminRouteGuardProps {
  userRole?: UserRole;
  children: React.ReactNode;
}

/**
 * UI Route Guard enforcing admin-only access on sensitive routes.
 * Intercepts non-admin users (Accountant, Auditor) and renders an Access Denied view.
 */
export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  userRole = "admin",
  children,
}) => {
  if (userRole !== "admin") {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-2xl border border-rose-200 bg-white shadow-card text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Shield Alert Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800">
            Admin Only Route
          </div>
          <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
            Access Denied: Administrator Permission Required
          </h2>
          <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
            You are currently signed in with the role of{" "}
            <strong className="capitalize text-neutral-900 font-bold bg-neutral-100 px-1.5 py-0.5 rounded">
              {userRole}
            </strong>
            . Only business administrators can access User Management, invite team members, and modify roles.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="primary" size="sm">
              Return to Dashboard
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm">
              View Business Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
