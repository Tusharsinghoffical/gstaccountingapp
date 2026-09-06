import React, { forwardRef } from "react";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
  currencySymbol?: string;
  required?: boolean;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      label,
      error,
      helperText,
      currencySymbol = "₹",
      required,
      className = "",
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-neutral-700 tracking-wide"
          >
            {label}
            {required && <span className="text-expense-500 ml-1">*</span>}
          </label>
        )}

        <div
          className={`relative flex items-center rounded-lg border bg-white transition-all duration-150 shadow-sm focus-within:ring-2 focus-within:ring-offset-0 ${
            error
              ? "border-expense-500 focus-within:border-expense-500 focus-within:ring-expense-200"
              : "border-neutral-300 focus-within:border-brand-500 focus-within:ring-brand-100"
          } ${disabled ? "bg-neutral-50 cursor-not-allowed opacity-75" : ""}`}
        >
          <div className="pl-3.5 pr-2 text-neutral-500 font-semibold select-none text-sm">
            {currencySymbol}
          </div>

          <input
            ref={ref}
            id={inputId}
            type="number"
            step="0.01"
            min="0"
            disabled={disabled}
            placeholder="0.00"
            className={`w-full bg-transparent pr-3.5 py-2 text-sm font-mono tabular-nums text-right text-neutral-900 placeholder:text-neutral-300 outline-none disabled:cursor-not-allowed ${className}`}
            {...props}
          />
        </div>

        {error ? (
          <p className="text-xs font-medium text-expense-600 animate-fadeIn">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-neutral-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
