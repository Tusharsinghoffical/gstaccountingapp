import React from "react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    onClick?: () => void;
  };
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries to display at this time.",
  emptyAction,
  className = "",
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-card">
        <div className="animate-pulse p-6 space-y-4">
          <div className="h-6 bg-neutral-100 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-neutral-50 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              {columns.map((col, idx) => {
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left";

                return (
                  <th
                    key={idx}
                    scope="col"
                    style={{ width: col.width }}
                    className={`px-4 py-3.5 select-none ${alignClass} ${col.className || ""}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((item, rowIndex) => (
              <tr
                key={keyExtractor(item, rowIndex)}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors duration-100 ${
                  onRowClick
                    ? "cursor-pointer hover:bg-neutral-50/80 active:bg-neutral-100/60"
                    : "hover:bg-neutral-50/40"
                }`}
              >
                {columns.map((col, colIndex) => {
                  const alignClass =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left";

                  const content = col.render
                    ? col.render(item, rowIndex)
                    : col.accessorKey
                    ? (item[col.accessorKey] as React.ReactNode)
                    : null;

                  return (
                    <td
                      key={colIndex}
                      className={`px-4 py-3.5 text-neutral-800 ${alignClass} ${
                        col.className || ""
                      }`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
