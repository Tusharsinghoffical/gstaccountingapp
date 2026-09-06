/**
 * Validates critical environment variables at startup.
 * Throws loud, clear errors in production if required secrets are absent.
 */
export function validateEnvironment(): { isValid: boolean; warnings: string[] } {
  const isProduction = process.env.NODE_ENV === "production";
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. NextAuth Secret
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (isProduction) {
      errors.push("CRITICAL: NEXTAUTH_SECRET is missing. Generate a 32+ char secret in production.");
    } else {
      warnings.push("NEXTAUTH_SECRET is not set, falling back to local development secret.");
    }
  } else if (secret.length < 32) {
    if (isProduction) {
      errors.push("CRITICAL: NEXTAUTH_SECRET must be at least 32 characters in production.");
    } else {
      warnings.push("NEXTAUTH_SECRET is shorter than 32 characters.");
    }
  }

  // 2. NextAuth URL
  const url = process.env.NEXTAUTH_URL;
  if (!url) {
    if (isProduction) {
      errors.push("CRITICAL: NEXTAUTH_URL is missing in production.");
    } else {
      warnings.push("NEXTAUTH_URL is not set, defaulting to http://localhost:3000.");
    }
  } else {
    try {
      new URL(url);
    } catch {
      errors.push(`CRITICAL: NEXTAUTH_URL "${url}" is not a valid URL format.`);
    }
  }

  // 3. Database URL
  if (!process.env.DATABASE_URL) {
    warnings.push("DATABASE_URL is not explicitly set; defaulting to SQLite local path file:../data/app.db.");
  }

  // 4. Email Transport in Production
  if (isProduction && !process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    warnings.push(
      "WARNING: No production email provider configured (RESEND_API_KEY or SMTP_HOST). Verification emails will fall back to stdout console logs."
    );
  }

  if (errors.length > 0) {
    console.error("❌ ENVIRONMENT STARTUP VALIDATION FAILED:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    throw new Error(`Environment validation failed: ${errors.join("; ")}`);
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`⚠️  ${w}`);
    }
  }

  return { isValid: true, warnings };
}

// Auto-run validation once when module loads in server environment
if (typeof window === "undefined") {
  try {
    validateEnvironment();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
  }
}
