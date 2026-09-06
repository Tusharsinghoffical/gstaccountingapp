import { z } from "zod";

export const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Official 15-character GSTIN regex
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validates a 15-character Indian GSTIN using format regex and the official Mod-36 Luhn algorithm.
 * No external GSTN API call is made.
 */
export function validateGSTIN(gstin?: string | null): {
  isValid: boolean;
  stateCode?: string;
  pan?: string;
  error?: string;
} {
  if (!gstin) {
    return { isValid: false, error: "GSTIN is required" };
  }

  const clean = gstin.trim().toUpperCase();

  if (clean.length !== 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters (currently ${clean.length})`,
    };
  }

  if (!GSTIN_REGEX.test(clean)) {
    return {
      isValid: false,
      error:
        "Invalid GSTIN structure. Expected format: 2-digit state code + 10-char PAN + 1-char entity + 'Z' + 1 checksum character (e.g. 27AAPFU0939F1ZV)",
    };
  }

  const stateCode = clean.slice(0, 2);
  const stateNum = parseInt(stateCode, 10);
  if (stateNum < 1 || (stateNum > 38 && stateNum !== 97 && stateNum !== 99)) {
    return {
      isValid: false,
      error: `Invalid GST state code: ${stateCode}`,
    };
  }

  // Calculate Checksum using Luhn Mod-36 algorithm
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = clean[i];
    const code = GSTIN_CHARS.indexOf(char);
    if (code === -1) {
      return { isValid: false, error: `Invalid character '${char}' in GSTIN` };
    }

    const multiplier = i % 2 === 0 ? 1 : 2;
    const product = code * multiplier;
    sum += Math.floor(product / 36) + (product % 36);
  }

  const remainder = sum % 36;
  const checkCode = (36 - remainder) % 36;
  const expectedCheckChar = GSTIN_CHARS[checkCode];
  const actualCheckChar = clean[14];

  if (actualCheckChar !== expectedCheckChar) {
    return {
      isValid: false,
      error: `GSTIN checksum mismatch. Calculated check digit is '${expectedCheckChar}', but found '${actualCheckChar}'`,
    };
  }

  return {
    isValid: true,
    stateCode,
    pan: clean.slice(2, 12),
  };
}

/**
 * Zod refinement schema for GSTIN strings.
 */
export const gstinSchema = z
  .string()
  .transform((val) => val.trim().toUpperCase())
  .refine(
    (val) => {
      if (!val) return true; // allow empty if optional wrapper is used
      return validateGSTIN(val).isValid;
    },
    (val) => ({
      message: validateGSTIN(val).error || "Invalid GSTIN checksum or format",
    })
  );

export const optionalGstinSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((val) => (val ? val.trim().toUpperCase() : ""))
  .refine(
    (val) => {
      if (!val) return true;
      return validateGSTIN(val).isValid;
    },
    (val) => ({
      message: validateGSTIN(val).error || "Invalid GSTIN checksum or format",
    })
  );
