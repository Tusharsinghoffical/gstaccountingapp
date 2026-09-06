import React from "react";
import { Button, ButtonProps } from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: ButtonProps["variant"];
    leftIcon?: React.ReactNode;
  };
  children?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  children,
  className = "",
}) => {
  const defaultIcon = (
    <svg
      className="w-8 h-8 text-brand-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4 shadow-sm">
        {icon || defaultIcon}
      </div>

      <h3 className="text-base md:text-lg font-bold text-neutral-900 mb-1">
        {title}
      </h3>

      <p className="text-sm text-neutral-500 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {action && (
        <Button
          variant={action.variant || "primary"}
          onClick={action.onClick}
          leftIcon={action.leftIcon}
        >
          {action.label}
        </Button>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
