import React from "react";

export type StatusType =
  | "draft"
  | "final"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled"
  | "active"
  | "inactive"
  | "pending_review"
  | "pending";

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  showDot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  defaultLabel: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  draft: {
    bg: "bg-neutral-100",
    text: "text-neutral-700",
    border: "border-neutral-200",
    dot: "bg-neutral-400",
    defaultLabel: "Draft",
  },
  final: {
    bg: "bg-income-50",
    text: "text-income-700",
    border: "border-income-200",
    dot: "bg-income-500",
    defaultLabel: "Finalized",
  },
  paid: {
    bg: "bg-income-50",
    text: "text-income-700",
    border: "border-income-200",
    dot: "bg-income-500",
    defaultLabel: "Paid",
  },
  active: {
    bg: "bg-income-50",
    text: "text-income-700",
    border: "border-income-200",
    dot: "bg-income-500",
    defaultLabel: "Active",
  },
  partial: {
    bg: "bg-warning-50",
    text: "text-warning-700",
    border: "border-warning-200",
    dot: "bg-warning-500",
    defaultLabel: "Partially Paid",
  },
  pending: {
    bg: "bg-warning-50",
    text: "text-warning-700",
    border: "border-warning-200",
    dot: "bg-warning-500",
    defaultLabel: "Pending",
  },
  pending_review: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-500",
    defaultLabel: "Review Extracted Data",
  },
  overdue: {
    bg: "bg-expense-50",
    text: "text-expense-700",
    border: "border-expense-200",
    dot: "bg-expense-500",
    defaultLabel: "Overdue",
  },
  cancelled: {
    bg: "bg-expense-50",
    text: "text-expense-700",
    border: "border-expense-200",
    dot: "bg-expense-500",
    defaultLabel: "Cancelled",
  },
  inactive: {
    bg: "bg-neutral-100",
    text: "text-neutral-500",
    border: "border-neutral-200",
    dot: "bg-neutral-400",
    defaultLabel: "Inactive",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showDot = true,
  size = "sm",
  className = "",
}) => {
  const normalizedStatus = status.toLowerCase();
  const config =
    statusConfigs[normalizedStatus] || {
      bg: "bg-neutral-100",
      text: "text-neutral-700",
      border: "border-neutral-200",
      dot: "bg-neutral-400",
      defaultLabel: status,
    };

  const displayText = label || config.defaultLabel;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-xs gap-1.5"
      : "px-2.5 py-1 text-xs gap-2 font-semibold";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
};
