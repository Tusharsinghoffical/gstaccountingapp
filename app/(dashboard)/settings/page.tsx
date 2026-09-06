import React from "react";
import Link from "next/link";
import { Input, Button } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
          Business Profile & Settings
        </h1>
        <p className="text-sm text-neutral-500">
          Configure business details, GSTIN, place of supply, and fiscal year numbering.
        </p>
      </div>

      {/* Settings Tab Navigation */}
      <div className="border-b border-neutral-200 flex items-center gap-6 text-sm font-semibold">
        <Link
          href="/settings"
          className="pb-3 text-brand-700 border-b-2 border-brand-700 font-bold"
        >
          Business Profile
        </Link>
        <Link
          href="/settings/users"
          className="pb-3 text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-2"
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

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-2">
          GST Entity Details
        </h3>

        <Input
          label="Legal Business Name"
          defaultValue="Alpha Retailers Pvt Ltd"
          disabled
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="GSTIN"
            defaultValue="27AABCU9603R1ZM"
            disabled
          />
          <Input
            label="State Code (POS)"
            defaultValue="27 - Maharashtra"
            disabled
          />
        </div>

        <Input
          label="Registered Billing Address"
          defaultValue="102, Commercial Arcade, Bandra Kurla Complex, Mumbai, Maharashtra 400051"
        />

        <div className="pt-2">
          <Button variant="primary" size="sm">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
