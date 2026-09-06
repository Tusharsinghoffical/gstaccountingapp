"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signUpUser } from "@/app/actions/auth";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsConsent, setTermsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // Password criteria indicators
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Please ensure your password meets all strength criteria.");
      return;
    }

    if (!termsConsent) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const res = await signUpUser({
        name,
        email,
        password,
        termsConsent: true,
      });

      if (!res.success) {
        setError(res.error || "Failed to create account.");
      } else {
        setRegisteredEmail(res.email || email);
      }
    } catch {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (registeredEmail) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto text-2xl">
            📬
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Check Your Email
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              We have dispatched an activation link to:
              <br />
              <strong className="text-indigo-600 font-mono">{registeredEmail}</strong>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed text-left">
            <span className="font-semibold text-slate-800 block mb-1">Next steps:</span>
            1. Open your inbox and click the verification link.<br />
            2. The link is valid for <strong>24 hours</strong>.<br />
            3. Once verified, you will be able to log in to your workspace.
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all"
            >
              Go to Sign In →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
            GST Ledger SaaS • Create Account
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Start Your Accounting Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Professional Indian GST billing, double-entry ledger & compliance
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
              placeholder="Rajesh Sharma"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Work Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
              placeholder="name@company.in"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
              placeholder="••••••••••••"
            />

            {/* Real-time criteria checklist */}
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

          {/* Terms & Privacy explicit consent */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-relaxed select-none">
              <input
                type="checkbox"
                checked={termsConsent}
                onChange={(e) => setTermsConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-indigo-600 underline hover:text-indigo-800">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="text-indigo-600 underline hover:text-indigo-800">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid || !termsConsent}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? "Creating Account..." : "Create Free Account →"}
          </button>
        </form>

        <div className="text-center pt-2 text-xs text-slate-500 border-t border-slate-100">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-800">
            Sign In here
          </Link>
        </div>
      </div>
    </main>
  );
}
