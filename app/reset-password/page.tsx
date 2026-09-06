"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/app/actions/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Criteria
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing or invalid password reset token.");
      return;
    }

    if (!isPasswordValid) {
      setError("Please ensure your password meets all strength criteria.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await resetPassword({ token, password });
      if (!res.success) {
        setError(res.error || "Failed to reset password.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-4 text-center">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl">
          ⚠️
        </div>
        <h1 className="text-lg font-bold text-slate-900">Invalid Reset Link</h1>
        <p className="text-xs text-slate-500">
          This password reset link is missing a valid token. Please request a new link.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block py-2 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
        >
          Request Reset Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 text-center">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-3xl">
          ✅
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Password Reset Successfully!
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your password has been updated and all other active sessions have been safely invalidated.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition-all"
          >
            Sign In with New Password →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
          Security Update
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Set New Password
        </h1>
        <p className="text-xs text-slate-500">
          Please enter your new 10+ character secure password below.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            placeholder="••••••••••••"
          />

          <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-2xs space-y-1.5">
            <span className="font-semibold text-slate-600 block">Password Requirements:</span>
            <div className="grid grid-cols-2 gap-1.5 text-slate-600">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-700 font-semibold" : ""}`}>
                <span>{hasMinLength ? "✓" : "○"}</span> 10+ characters
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-emerald-700 font-semibold" : ""}`}>
                <span>{hasUppercase ? "✓" : "○"}</span> 1 uppercase (A-Z)
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-700 font-semibold" : ""}`}>
                <span>{hasNumber ? "✓" : "○"}</span> 1 number (0-9)
              </div>
              <div className={`flex items-center gap-1.5 ${hasSymbol ? "text-emerald-700 font-semibold" : ""}`}>
                <span>{hasSymbol ? "✓" : "○"}</span> 1 symbol (!@#$)
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
            placeholder="••••••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !isPasswordValid || password !== confirmPassword}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? "Updating Password..." : "Update Password & Invalidate Sessions →"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading reset form...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
