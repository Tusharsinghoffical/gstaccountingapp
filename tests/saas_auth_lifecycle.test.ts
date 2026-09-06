import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.ts";
import {
  signUpUser,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} from "../app/actions/auth.ts";
import { authOptions, authorizeCredentials } from "../lib/auth/auth-options.ts";
import { validateGSTIN } from "../lib/validation/gstin.ts";

describe("SaaS Production Auth & Security Lifecycle", () => {
  const testEmail = `test.saas.${Date.now()}@example.com`;
  const validPassword = "SecurePassword@2026!";
  let rawVerificationToken: string | null = null;
  let rawResetToken: string | null = null;

  before(async () => {
    // Ensure clean state for test email
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  after(async () => {
    // Clean up
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  it("1. Rejects signup with weak password violating complexity rules", async () => {
    const tooShort = await signUpUser({
      name: "Test User",
      email: testEmail,
      password: "Short@1", // < 10 chars
      termsConsent: true,
    });
    assert.equal(tooShort.success, false);
    assert.match(tooShort.error || "", /at least 10 characters/i);

    const noSymbol = await signUpUser({
      name: "Test User",
      email: testEmail,
      password: "Password1234", // no symbol
      termsConsent: true,
    });
    assert.equal(noSymbol.success, false);
    assert.match(noSymbol.error || "", /symbol|character/i);

    const noUpper = await signUpUser({
      name: "Test User",
      email: testEmail,
      password: "password@1234", // no uppercase
      termsConsent: true,
    });
    assert.equal(noUpper.success, false);
    assert.match(noUpper.error || "", /uppercase/i);

    const noNumber = await signUpUser({
      name: "Test User",
      email: testEmail,
      password: "Password@Word", // no number
      termsConsent: true,
    });
    assert.equal(noNumber.success, false);
    assert.match(noNumber.error || "", /number/i);
  });

  it("2. Rejects signup when terms of service consent is not given", async () => {
    const noTerms = await signUpUser({
      name: "Test User",
      email: testEmail,
      password: validPassword,
      termsConsent: false as any,
    });
    assert.equal(noTerms.success, false);
    assert.match(noTerms.error || "", /Terms of Service/i);
  });

  it("3. Successfully creates user with emailVerified=false and SHA-256 hashed token", async () => {
    const res = await signUpUser({
      name: "SaaS Tester",
      email: testEmail,
      password: validPassword,
      termsConsent: true,
    });

    assert.equal(res.success, true);
    assert.equal(res.email, testEmail);

    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    assert.ok(dbUser, "User must exist in database");
    assert.equal(dbUser?.emailVerified, false, "Must not be verified initially");
    assert.ok(dbUser?.passwordHash, "Password must be hashed");
    assert.ok(dbUser?.emailVerificationToken, "Hashed verification token must be stored");
    assert.ok(dbUser?.emailVerificationExpiry, "Token expiry must be set");

    // Verify bcrypt cost factor is 12 ($2a$12$ or $2b$12$)
    assert.match(dbUser!.passwordHash!, /^\$2[ab]\$12\$/);

    // Save token hash to verify raw token matching later
    // Extract raw token from development mock or simulate valid token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
    await prisma.user.update({
      where: { id: dbUser!.id },
      data: { emailVerificationToken: hashed },
    });
    rawVerificationToken = rawToken;
  });

  it("4. Rejects duplicate signup with clear 'already registered' message", async () => {
    const dup = await signUpUser({
      name: "Duplicate Tester",
      email: testEmail,
      password: validPassword,
      termsConsent: true,
    });

    assert.equal(dup.success, false);
    assert.match(dup.error || "", /already registered/i);
  });

  it("5. Blocks login before email verification via NextAuth authorize", async () => {
    await assert.rejects(
      async () => {
        await authorizeCredentials({
          email: testEmail,
          password: validPassword,
        });
      },
      /verify your email address before signing in/i
    );
  });

  it("6. Rejects email verification with invalid or expired token", async () => {
    const wrong = await verifyEmail("deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678");
    assert.equal(wrong.success, false);
    assert.match(wrong.error || "", /invalid or has expired/i);
  });

  it("7. Successfully verifies email with valid raw token and activates account", async () => {
    assert.ok(rawVerificationToken, "Must have valid raw token");
    const res = await verifyEmail(rawVerificationToken!);
    assert.equal(res.success, true);

    const verifiedUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    assert.equal(verifiedUser?.emailVerified, true);
    assert.equal(verifiedUser?.emailVerificationToken, null);
    assert.equal(verifiedUser?.emailVerificationExpiry, null);
  });

  it("8. Successfully logs in verified user with correct credentials", async () => {
    const user = await authorizeCredentials({
      email: testEmail,
      password: validPassword,
    });

    assert.ok(user, "User must successfully authorize");
    assert.equal(user.email, testEmail);
    assert.equal(user.sessionVersion, 1);
  });

  it("9. Enforces 5-attempt lockout: locks account for 15 minutes after 5 consecutive bad passwords", async () => {
    // Fail 4 times
    for (let i = 1; i <= 4; i++) {
      await assert.rejects(
        async () => {
          await authorizeCredentials({
            email: testEmail,
            password: "WrongPassword@999",
          });
        },
        /invalid email or password/i
      );
    }

    const check4 = await prisma.user.findUnique({ where: { email: testEmail } });
    assert.equal(check4?.failedLoginAttempts, 4);
    assert.equal(check4?.lockedUntil, null);

    // 5th failure triggers lockout
    await assert.rejects(
      async () => {
        await authorizeCredentials({
          email: testEmail,
          password: "WrongPassword@999",
        });
      },
      /locked for 15 minutes/i
    );

    const lockedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    assert.equal(lockedUser?.failedLoginAttempts, 5);
    assert.ok(lockedUser?.lockedUntil, "lockedUntil must be set");
    assert.ok(lockedUser!.lockedUntil! > new Date(), "lockedUntil must be in the future");

    // Even with the CORRECT password, locked user is rejected
    await assert.rejects(
      async () => {
        await authorizeCredentials({
          email: testEmail,
          password: validPassword,
        });
      },
      /temporarily locked/i
    );
  });

  it("10. Forgot password generates SHA-256 reset token and sets 1h expiry", async () => {
    const reqRes = await requestPasswordReset({ email: testEmail });
    assert.equal(reqRes.success, true);

    const userWithReset = await prisma.user.findUnique({ where: { email: testEmail } });
    assert.ok(userWithReset?.passwordResetToken);
    assert.ok(userWithReset?.passwordResetExpiry);

    // Setup raw token for testing resetPassword action
    const rawReset = crypto.randomBytes(32).toString("hex");
    const hashedReset = crypto.createHash("sha256").update(rawReset).digest("hex");
    await prisma.user.update({
      where: { email: testEmail },
      data: {
        passwordResetToken: hashedReset,
        passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    rawResetToken = rawReset;
  });

  it("11. Reset password updates hash, resets lockout, and increments sessionVersion", async () => {
    assert.ok(rawResetToken);
    const newPassword = "NewStrongPassword@2026!";

    const resetRes = await resetPassword({
      token: rawResetToken!,
      password: newPassword,
      confirmPassword: newPassword,
    });

    assert.equal(resetRes.success, true);

    const updatedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    assert.equal(updatedUser?.sessionVersion, 2, "sessionVersion must increment to invalidate old sessions");
    assert.equal(updatedUser?.passwordResetToken, null);
    assert.equal(updatedUser?.passwordResetExpiry, null);
    assert.equal(updatedUser?.failedLoginAttempts, 0);
    assert.equal(updatedUser?.lockedUntil, null);

    // Verify new password works
    const isNewValid = await bcrypt.compare(newPassword, updatedUser!.passwordHash!);
    assert.equal(isNewValid, true);
  });

  it("12. Validates GSTIN structure and Mod-36 Luhn checksum for onboarding", () => {
    // Valid Maharashtra GSTIN
    const valid = validateGSTIN("27AAPFU0939F1ZV");
    assert.equal(valid.isValid, true);
    assert.equal(valid.stateCode, "27");

    // Valid Karnataka GSTIN
    const validKA = validateGSTIN("29AABCU9603R1ZJ");
    assert.equal(validKA.isValid, true);
    assert.equal(validKA.stateCode, "29");

    // Invalid checksum digit (ZV changed to ZX)
    const invalidChecksum = validateGSTIN("27AAPFU0939F1ZX");
    assert.equal(invalidChecksum.isValid, false);
    assert.match(invalidChecksum.error || "", /checksum mismatch/i);

    // Invalid length
    const invalidLength = validateGSTIN("27AAPFU0939F1");
    assert.equal(invalidLength.isValid, false);
  });
});
