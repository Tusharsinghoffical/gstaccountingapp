import React, { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftPrefix?: React.ReactNode;
  rightSuffix?: React.ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftPrefix,
      rightSuffix,
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
          {leftPrefix && (
            <div className="pl-3 pr-1 text-neutral-400 flex items-center select-none text-sm">
              {leftPrefix}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none disabled:cursor-not-allowed ${
              leftPrefix ? "pl-2" : ""
            } ${rightSuffix ? "pr-2" : ""} ${className}`}
            {...props}
          />

          {rightSuffix && (
            <div className="pr-3 pl-1 text-neutral-400 flex items-center select-none text-sm">
              {rightSuffix}
            </div>
          )}
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

Input.displayName = "Input";
