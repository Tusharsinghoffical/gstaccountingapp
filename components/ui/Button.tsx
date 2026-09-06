import React, { forwardRef } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-sm border border-transparent focus-visible:ring-brand-500",
  secondary:
    "bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 border border-neutral-200 focus-visible:ring-neutral-400",
  outline:
    "bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-700 border border-neutral-300 shadow-sm focus-visible:ring-brand-500",
  ghost:
    "bg-transparent hover:bg-neutral-100 active:bg-neutral-200 text-neutral-700 border border-transparent focus-visible:ring-neutral-400",
  danger:
    "bg-expense-600 hover:bg-expense-700 active:bg-expense-800 text-white shadow-sm border border-transparent focus-visible:ring-expense-500",
  success:
    "bg-income-600 hover:bg-income-700 active:bg-income-800 text-white shadow-sm border border-transparent focus-visible:ring-income-500",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md font-medium",
  md: "h-10 px-4 text-sm gap-2 rounded-lg font-medium",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl font-semibold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${
          isDisabled ? "opacity-60 cursor-not-allowed pointer-events-none" : "cursor-pointer"
        } ${className}`}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
