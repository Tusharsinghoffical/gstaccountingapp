/**
 * Formatting utilities for Indian SME Accounting & GST compliance.
 * Adheres to Indian numbering system and DD/MM/YYYY date standards.
 */

export interface FormatINROptions {
  /**
   * Whether to explicitly show decimals (.00) even for whole numbers.
   * If omitted, decimals are shown only when non-zero or specified.
   */
  showDecimals?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * Formats a numeric amount in the Indian numbering system (Lakhs and Crores).
 * Example:
 *   formatINR(100000) => "₹1,00,000"
 *   formatINR(10000000) => "₹1,00,00,000" (1 Crore)
 *   formatINR(-50000) => "-₹50,000"
 *   formatINR(0) => "₹0"
 */
export function formatINR(amount: number, options?: FormatINROptions): string {
  if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) {
    return "₹0";
  }

  // Handle -0 normalization
  const normalizedAmount = Object.is(amount, -0) ? 0 : amount;

  const hasFractions = normalizedAmount % 1 !== 0;
  const showDecimals = options?.showDecimals ?? hasFractions;

  const minFraction =
    options?.minimumFractionDigits ?? (showDecimals ? 2 : 0);
  const maxFraction =
    options?.maximumFractionDigits ?? (showDecimals ? 2 : 0);

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  });

  return formatter.format(normalizedAmount);
}

/**
 * Formats a Date object to the standard Indian format: DD/MM/YYYY.
 * Example:
 *   formatDateIN(new Date(2024, 3, 15)) => "15/04/2024"
 *   formatDateIN(new Date(2024, 0, 5)) => "05/01/2024"
 */
export function formatDateIN(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("Invalid date provided to formatDateIN");
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}
