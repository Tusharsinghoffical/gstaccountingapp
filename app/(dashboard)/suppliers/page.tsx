"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Supplier } from "@/types";
import { getSuppliers } from "@/app/actions/parties";
import { DataTable, Column, Button, Input } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { INDIAN_STATES, STATE_CODE_MAP } from "@/lib/constants/states";

type SupplierWithBalance = Supplier & { balance: number };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSuppliers();
        setSuppliers(data);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filtered = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search)) ||
      (s.pan && s.pan.toLowerCase().includes(search.toLowerCase()));

    const matchesState = stateFilter === "all" || s.state_code === stateFilter;

    return matchesSearch && matchesState;
  });

  const columns: Column<SupplierWithBalance>[] = [
    {
      header: "Supplier Name",
      accessorKey: "name",
      render: (row) => (
        <div>
          <Link
            href={`/suppliers/${row.id}`}
            className="font-bold text-neutral-900 hover:text-brand-600 transition-colors"
          >
            {row.name}
          </Link>
          {row.pan && (
            <div className="text-[11px] font-mono text-neutral-500">
              PAN: {row.pan}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "GSTIN",
      accessorKey: "gstin",
      render: (row) =>
        row.gstin ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-neutral-800">
              {row.gstin}
            </span>
            <span
              title="Checksum Verified"
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            />
          </div>
        ) : (
          <span className="text-xs text-neutral-400 italic">Unregistered Vendor</span>
        ),
    },
    {
      header: "Place of Supply",
      accessorKey: "state_code",
      render: (row) => (
        <span className="text-xs text-neutral-700">
          <span className="font-mono font-bold text-neutral-900">
            {row.state_code}
          </span>{" "}
          - {STATE_CODE_MAP[row.state_code] || "State"}
        </span>
      ),
    },
    {
      header: "Contact",
      render: (row) => (
        <div className="text-xs text-neutral-600 space-y-0.5">
          {row.phone && <div>{row.phone}</div>}
          {row.email && (
            <div className="text-neutral-400 truncate max-w-[150px]">
              {row.email}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Payable (ITC)",
      align: "right",
      accessorKey: "balance",
      render: (row) => (
        <span
          className={`font-mono font-bold text-xs ${
            row.balance > 0 ? "text-expense-700" : "text-neutral-700"
          }`}
        >
          {formatINR(row.balance)}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Link href={`/suppliers/${row.id}`}>
            <Button variant="ghost" size="sm">
              Ledger
            </Button>
          </Link>
          <Link href={`/suppliers/${row.id}/edit`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Suppliers Directory
          </h1>
          <p className="text-sm text-neutral-500">
            Vendor master, purchase registers, and input tax credit (ITC) tracking.
          </p>
        </div>

        <Link href="/suppliers/new">
          <Button
            variant="primary"
            size="sm"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Supplier
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-card flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by vendor name, GSTIN, PAN or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftPrefix={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <label className="text-xs font-semibold text-neutral-500 whitespace-nowrap">
            Filter State:
          </label>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All States & Territories</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No suppliers match your criteria"
        emptyDescription={
          search || stateFilter !== "all"
            ? "Try resetting your search query or state filter."
            : "Add your suppliers and vendors to record purchase bills and track ITC."
        }
        emptyAction={
          search || stateFilter !== "all"
            ? undefined
            : {
                label: "Add Supplier",
                onClick: () => (window.location.href = "/suppliers/new"),
              }
        }
      />
    </div>
  );
}
