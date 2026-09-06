"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  type SignUpFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
} from "@/lib/validation/auth";
import { sendEmail, getEmailTemplate } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/rate-limit";

const SITE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Real SaaS Signup:
 * 1. Zod validation (min 10 chars, 1 uppercase, 1 number, 1 symbol, terms consent)
 * 2. Duplicate check returning explicit "An account with this email is already registered."
 * 3. Bcrypt cost factor 12
 * 4. Generates 32-byte hex emailVerificationToken (stored as sha256 hash, 24h expiry)
 * 5. Creates user with emailVerified: false
 * 6. Sends verification email with raw token
 */
export async function signUpUser(data: unknown) {
  const parsed = signUpSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid registration data.",
    };
  }

  const { email, password, name } = parsed.data;

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return {
      success: false,
      error: "An account with this email is already registered.",
    };
  }

  // Generate 32-byte token & SHA-256 hash
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Hash password with bcrypt cost factor 12
  const passwordHash = await bcrypt.hash(password, 12);

  // Create User
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: expiry,
      sessionVersion: 1,
    },
  });

  // Verification URL
  const verifyUrl = `${SITE_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

  // Send verification email
  const html = getEmailTemplate(
    "Verify your GST Ledger account",
    `<p>Hi ${name || "there"},</p>
     <p>Welcome to GST Ledger! Please confirm your email address to activate your workspace and start managing your invoices and GST compliance.</p>
     <p>This verification link is valid for <strong>24 hours</strong>.</p>`,
    "Verify Email Address",
    verifyUrl
  );

  await sendEmail({
    to: email,
    subject: "Verify your GST Ledger account",
    html,
  });

  return {
    success: true,
    message: "Registration successful! Please check your email to verify your account.",
    email,
  };
}

/**
 * Verify Email Action:
 * Hashes incoming raw token, matches against stored hash, checks expiry, sets emailVerified: true
 */
export async function verifyEmail(rawToken: string, email?: string) {
  if (!rawToken) {
    return { success: false, error: "Missing verification token." };
  }

  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  let user = null;
  if (email) {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  } else {
    user = await prisma.user.findFirst({
      where: { emailVerificationToken: hashedToken },
    });
  }

  if (!user || !user.emailVerificationToken) {
    return { success: false, error: "Verification link is invalid or has expired." };
  }

  if (user.emailVerified) {
    return { success: true, message: "Your email is already verified! You can now sign in." };
  }

  if (user.emailVerificationToken !== hashedToken) {
    return { success: false, error: "Verification link is invalid or has expired." };
  }

  if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
    return {
      success: false,
      error: "Verification link has expired. Please request a new verification email.",
      isExpired: true,
    };
  }

  // Activate account
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });

  return {
    success: true,
    message: "Your email has been verified successfully! You can now sign in.",
  };
}

/**
 * Resend Verification Email Action:
 * Rate-limited to 1 per 60 seconds per email
 */
export async function resendVerificationEmail(email: string) {
  const parsed = resendVerificationSchema.safeParse({ email });
  if (!parsed.success) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const cleanEmail = parsed.data.email;

  // Rate limit: 1 per 60 seconds
  const rateLimit = checkRateLimit(`resend-verify:${cleanEmail}`, {
    limit: 1,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.success) {
    return {
      success: false,
      error: `Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another verification email.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user) {
    // Return friendly generic message so we don't leak user existence
    return {
      success: true,
      message: "If an unverified account exists with this email, a new verification link has been sent.",
    };
  }

  if (user.emailVerified) {
    return {
      success: true,
      message: "Your email is already verified. Please sign in directly.",
    };
  }

  // Generate new token & expiry
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: expiry,
    },
  });

  const verifyUrl = `${SITE_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(cleanEmail)}`;

  const html = getEmailTemplate(
    "Verify your GST Ledger account",
    `<p>Hi ${user.name || "there"},</p>
     <p>Here is your new verification link to activate your GST Ledger account.</p>
     <p>This verification link is valid for <strong>24 hours</strong>.</p>`,
    "Verify Email Address",
    verifyUrl
  );

  await sendEmail({
    to: cleanEmail,
    subject: "New verification link for GST Ledger",
    html,
  });

  return {
    success: true,
    message: "A new verification email has been dispatched. Please check your inbox.",
  };
}

/**
 * Forgot Password Flow:
 * Generates passwordResetToken (SHA-256 stored, 1h expiry) and emails link
 */
export async function requestPasswordReset(data: unknown) {
  const parsed = forgotPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const { email } = parsed.data;

  // Rate limit: 3 per 5 minutes
  const rateLimit = checkRateLimit(`pwd-reset-req:${email}`, {
    limit: 3,
    windowMs: 5 * 60 * 1000,
  });

  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many password reset requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success message to prevent user enumeration
  if (!user) {
    return {
      success: true,
      message: "If an account exists with this email, a password reset link has been dispatched.",
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpiry: expiry,
    },
  });

  const resetUrl = `${SITE_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  const html = getEmailTemplate(
    "Reset your GST Ledger password",
    `<p>Hi ${user.name || "there"},</p>
     <p>We received a request to reset your password. Click the button below to choose a new password.</p>
     <p>This password reset link is valid for <strong>1 hour</strong>. If you did not make this request, you can safely ignore this email.</p>`,
    "Reset Password",
    resetUrl
  );

  await sendEmail({
    to: email,
    subject: "Reset your GST Ledger password",
    html,
  });

  return {
    success: true,
    message: "If an account exists with this email, a password reset link has been dispatched.",
  };
}

/**
 * Reset Password Action:
 * 1. Hashes incoming raw token & checks 1h expiry
 * 2. Enforces same 10-char strength rule
 * 3. Updates passwordHash (cost factor 12)
 * 4. Clears reset token and unlocks account if locked
 * 5. Increments sessionVersion to immediately invalidate all existing active sessions
 */
export async function resetPassword(data: unknown) {
  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid password reset data.",
    };
  }

  const { token, password } = parsed.data;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return {
      success: false,
      error: "Password reset link is invalid or has expired. Please request a new one.",
    };
  }

  const newPasswordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: {
        increment: 1, // Invalidates all previously issued JWT tokens!
      },
    },
  });

  return {
    success: true,
    message: "Your password has been reset successfully! You can now sign in with your new password.",
  };
}
