"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { getFinancialAuditLogs } from "@/app/actions/audit";
import { switchDemoRole, getCurrentUserRole } from "@/app/actions/users";
import { AdminRouteGuard } from "@/components/auth/AdminRouteGuard";
import { Button, Input } from "@/components/ui";
import type { AuditLogEntry, HumanReadableAuditSummary } from "@/lib/audit/diff";
import type { UserRole } from "@/types";

type EnrichedAuditLog = AuditLogEntry & { summary: HumanReadableAuditSummary };

export default function AuditLogPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("admin");
  const [logs, setLogs] = useState<EnrichedAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTable, setSelectedTable] = useState<string>("ALL");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI state for expanded diff rows & raw JSON modals
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [viewingRawJson, setViewingRawJson] = useState<EnrichedAuditLog | null>(null);

  const [, startTransition] = useTransition();

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await getCurrentUserRole();
      setCurrentUserRole(user.role);

      const res = await getFinancialAuditLogs({
        table: selectedTable,
        action: selectedAction,
        query: searchQuery,
      });

      if (!res.success) {
        setError(res.error || "Failed to load audit logs.");
        setLogs([]);
      } else if (res.data) {
        setLogs(res.data.logs);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      fetchLogs();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, selectedAction, searchQuery]);

  const handleSimulateRole = async (newRole: UserRole) => {
    await switchDemoRole(newRole);
    fetchLogs();
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return {
        dateStr: date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        timeStr: date.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      };
    } catch {
      return { dateStr: iso, timeStr: "" };
    }
  };

  const getTableBadgeColor = (table: string) => {
    switch (table) {
      case "invoices":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "payments":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "ledger_entries":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  const getActionBadge = (action: string) => {
    if (action === "INSERT") {
      return (
        <span className="inline-flex items-center gap-1 text-2xs font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
          INSERT
        </span>
      );
    }
    if (action === "UPDATE") {
      return (
        <span className="inline-flex items-center gap-1 text-2xs font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          UPDATE
        </span>
      );
    }
    return (
      <span className="text-2xs font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200">
        {action}
      </span>
    );
  };

  // Metrics
  const invoiceCount = logs.filter((l) => l.table_name === "invoices").length;
  const paymentCount = logs.filter((l) => l.table_name === "payments").length;
  const ledgerCount = logs.filter((l) => l.table_name === "ledger_entries").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
            <Link href="/settings" className="hover:text-neutral-700 transition-colors">
              Settings
            </Link>
            <span>/</span>
            <span className="text-neutral-700">Audit Log</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <span>Financial Audit Trail</span>
            <span className="text-2xs font-mono font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full">
              Admin Only
            </span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Chronological audit trail of all financial mutations populated automatically via Postgres triggers on invoices, payments, and ledger entries.
          </p>
        </div>

        {/* Live Role Switcher to Test Route Guard & RLS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white shadow-sm text-xs">
            <span className="text-neutral-400 font-semibold">Active Role:</span>
            <select
              value={currentUserRole}
              onChange={(e) => handleSimulateRole(e.target.value as UserRole)}
              className="font-bold text-neutral-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="admin">Admin (Full Access)</option>
              <option value="accountant">Accountant (Restricted)</option>
              <option value="auditor">Auditor (Restricted)</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
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
          className="pb-3 text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-2"
        >
          <span>User Management</span>
          <span className="text-3xs font-mono font-bold uppercase bg-neutral-100 text-neutral-600 border border-neutral-200 px-1.5 py-0.5 rounded-full">
            Admin
          </span>
        </Link>
        <Link
          href="/settings/audit-log"
          className="pb-3 text-brand-700 border-b-2 border-brand-700 font-bold flex items-center gap-2"
        >
          <span>Financial Audit Log</span>
          <span className="text-3xs font-mono font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">
            Admin
          </span>
        </Link>
      </div>

      {/* UI ROUTE GUARD: Intercepts Non-Admins */}
      <AdminRouteGuard userRole={currentUserRole}>
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500">Total Logged Mutations</div>
            <div className="text-2xl font-black text-neutral-900 mt-1">{logs.length}</div>
            <div className="text-3xs text-neutral-400 mt-1">Populated via DB triggers</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500">Invoice Events</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{invoiceCount}</div>
            <div className="text-3xs text-neutral-400 mt-1">Creation & status updates</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500">Payment Events</div>
            <div className="text-2xl font-black text-purple-700 mt-1">{paymentCount}</div>
            <div className="text-3xs text-neutral-400 mt-1">Receipts & bank transfers</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-neutral-500">Ledger Postings</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{ledgerCount}</div>
            <div className="text-3xs text-neutral-400 mt-1">Double-entry debits/credits</div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card space-y-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-80">
              <Input
                placeholder="Search by user, invoice #, ref, or changes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Table Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-neutral-500 font-semibold">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="ALL">All Tables</option>
                  <option value="invoices">invoices</option>
                  <option value="payments">payments</option>
                  <option value="ledger_entries">ledger_entries</option>
                </select>
              </div>

              {/* Action Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-neutral-500 font-semibold">Action:</span>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="ALL">All Actions</option>
                  <option value="INSERT">INSERT</option>
                  <option value="UPDATE">UPDATE</option>
                </select>
              </div>

              {(selectedTable !== "ALL" || selectedAction !== "ALL" || searchQuery) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTable("ALL");
                    setSelectedAction("ALL");
                    setSearchQuery("");
                  }}
                  className="text-xs text-neutral-600 hover:text-neutral-900"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Audit Log Table Card */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-card overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-sm font-bold text-neutral-900">Financial Mutation Audit Records</h3>
            </div>
            <span className="text-xs font-semibold text-neutral-500">
              Showing {logs.length} mutation{logs.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-100/70 text-neutral-600 font-bold uppercase tracking-wider text-3xs">
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-4 w-48">User</th>
                  <th className="py-3 px-4 w-28">Action</th>
                  <th className="py-3 px-4 w-32">Table</th>
                  <th className="py-3 px-4">Diff / Mutation Summary</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-neutral-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-brand-600 border-t-transparent animate-spin"></div>
                        <span>Loading audit records...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-neutral-500">
                      <div className="space-y-1">
                        <p className="font-bold text-neutral-700">No matching audit logs found</p>
                        <p className="text-3xs text-neutral-400">
                          Try adjusting your table, action, or search filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((entry) => {
                    const ts = formatTimestamp(entry.created_at);
                    const isExpanded = expandedRows[entry.id];
                    const hasFieldDetails = entry.summary.fieldChanges.length > 0;

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`hover:bg-neutral-50/80 transition-colors ${
                            isExpanded ? "bg-neutral-50/60" : ""
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-neutral-900">{ts.dateStr}</div>
                            <div className="text-3xs text-neutral-400 font-mono">{ts.timeStr}</div>
                          </td>

                          {/* User */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-3xs uppercase">
                                {(entry.user_name || entry.user_email || "S")[0]}
                              </div>
                              <div className="truncate max-w-[150px]">
                                <div className="font-bold text-neutral-900 truncate">
                                  {entry.user_name || "System"}
                                </div>
                                <div className="text-3xs text-neutral-400 truncate">
                                  {entry.user_email || "Postgres Trigger"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {getActionBadge(entry.action)}
                          </td>

                          {/* Table & Record Identifier */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span
                                className={`inline-block text-3xs font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${getTableBadgeColor(
                                  entry.table_name
                                )}`}
                              >
                                {entry.table_name}
                              </span>
                              <div className="font-mono text-3xs text-neutral-500 truncate">
                                #{entry.record_identifier || entry.record_id.slice(0, 8)}
                              </div>
                            </div>
                          </td>

                          {/* Human-Readable Diff Headline */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <p className="font-semibold text-neutral-900 leading-snug">
                                {entry.summary.headline}
                              </p>
                              {entry.summary.fieldChanges.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {entry.summary.fieldChanges.slice(0, 3).map((f, i) => (
                                    <span
                                      key={i}
                                      className="text-3xs px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-mono"
                                    >
                                      {f.label}
                                    </span>
                                  ))}
                                  {entry.summary.fieldChanges.length > 3 && (
                                    <span className="text-3xs text-neutral-400 font-mono">
                                      +{entry.summary.fieldChanges.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions: View Details / JSON */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasFieldDetails && (
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpand(entry.id)}
                                  className="px-2 py-1 text-3xs font-bold rounded border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
                                >
                                  {isExpanded ? "Hide" : "Diff"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setViewingRawJson(entry)}
                                className="px-2 py-1 text-3xs font-bold rounded border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                                title="View Raw JSONB Diff"
                              >
                                JSON
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Diff Viewer Drawer */}
                        {isExpanded && (
                          <tr className="bg-neutral-50/80">
                            <td colSpan={6} className="p-4 border-b border-neutral-200">
                              <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3 shadow-inner">
                                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-neutral-900">
                                      Detailed Field Mutation Breakdown
                                    </span>
                                    <span className="text-3xs font-mono text-neutral-400">
                                      Target: {entry.table_name} [UUID: {entry.record_id}]
                                    </span>
                                  </div>
                                  <span className="text-3xs font-bold text-neutral-500 uppercase font-mono">
                                    {entry.action} Diff
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 divide-y divide-neutral-100 text-xs">
                                  {entry.summary.fieldChanges.map((change, idx) => (
                                    <div
                                      key={idx}
                                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                    >
                                      <div className="w-48 font-bold text-neutral-800">
                                        {change.label}
                                        <div className="text-3xs font-mono font-normal text-neutral-400">
                                          {change.field}
                                        </div>
                                      </div>

                                      <div className="flex-1 flex items-center gap-3 font-mono text-xs">
                                        {/* Old value */}
                                        {entry.action === "UPDATE" && (
                                          <>
                                            <div className="flex-1 p-2 rounded bg-rose-50 border border-rose-100 text-rose-800 line-through">
                                              {change.oldValue === null || change.oldValue === undefined
                                                ? "(empty)"
                                                : typeof change.oldValue === "object"
                                                ? JSON.stringify(change.oldValue)
                                                : String(change.oldValue)}
                                            </div>
                                            <svg
                                              className="w-4 h-4 text-neutral-400 flex-shrink-0"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                                              />
                                            </svg>
                                          </>
                                        )}

                                        {/* New value */}
                                        <div className="flex-1 p-2 rounded bg-emerald-50 border border-emerald-100 text-emerald-800 font-semibold">
                                          {change.newValue === null || change.newValue === undefined
                                            ? "(empty)"
                                            : typeof change.newValue === "object"
                                            ? JSON.stringify(change.newValue)
                                            : String(change.newValue)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Security Note */}
          <div className="p-3 bg-neutral-50/80 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-3xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>
                <strong>Append-Only Security:</strong> Audit entries are automatically recorded by Postgres database triggers. Direct modifications or deletions on <code>audit_log</code> are blocked at the database engine level.
              </span>
            </div>
            <span className="font-mono">RLS Policy: admin_only_select</span>
          </div>
        </div>
      </AdminRouteGuard>

      {/* Raw JSON Modal */}
      {viewingRawJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-neutral-900">Raw JSONB Payload</span>
                <span className="text-3xs font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-700">
                  {viewingRawJson.table_name} #{viewingRawJson.record_identifier}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingRawJson(null)}
                className="w-7 h-7 rounded-lg hover:bg-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <pre className="p-3 rounded-xl bg-neutral-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
                {JSON.stringify(
                  {
                    id: viewingRawJson.id,
                    business_id: viewingRawJson.business_id,
                    user_id: viewingRawJson.user_id,
                    action: viewingRawJson.action,
                    table_name: viewingRawJson.table_name,
                    record_id: viewingRawJson.record_id,
                    diff: viewingRawJson.diff,
                    created_at: viewingRawJson.created_at,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="p-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setViewingRawJson(null)}
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
