"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmail, resendVerificationEmail } from "@/app/actions/auth";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email") || "";

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Resend state
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !emailParam) {
      setLoading(false);
      setError("Invalid or missing verification parameters.");
      return;
    }

    async function executeVerification() {
      try {
        const res = await verifyEmail(token as string, emailParam);
        if (res.success) {
          setSuccess(true);
        } else {
          setError(res.error || "Verification failed.");
          if (res.isExpired) {
            setIsExpired(true);
          }
        }
      } catch {
        setError("An unexpected network error occurred while verifying.");
      } finally {
        setLoading(false);
      }
    }

    executeVerification();
  }, [token, emailParam]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    setResendMessage(null);

    try {
      const res = await resendVerificationEmail(resendEmail);
      if (res.success) {
        setResendMessage(res.message || "A new verification link has been sent!");
      } else {
        setResendMessage(res.error || "Failed to resend.");
      }
    } catch {
      setResendMessage("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6 text-center">
      {loading ? (
        <div className="space-y-4 py-8">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h1 className="text-xl font-bold text-slate-800">Verifying Your Email...</h1>
          <p className="text-xs text-slate-500">Please wait while we activate your workspace.</p>
        </div>
      ) : success ? (
        <div className="space-y-6">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-3xl">
            🎉
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Email Verified Successfully!
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your account is now activated. You can sign in and set up your GST accounting workspace.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all"
            >
              Proceed to Sign In →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto text-3xl">
            ⚠️
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Verification Failed
            </h1>
            <p className="text-xs text-red-600 leading-relaxed font-medium">
              {error}
            </p>
          </div>

          {/* Resend box */}
          <div className="border-t border-slate-100 pt-4 text-left space-y-3">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Request New Verification Link
            </h3>
            {resendMessage && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                {resendMessage}
              </div>
            )}
            <form onSubmit={handleResend} className="space-y-2.5">
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                placeholder="name@company.in"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
              />
              <button
                type="submit"
                disabled={resending}
                className="w-full py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold transition-colors"
              >
                {resending ? "Sending..." : "Resend Activation Email"}
              </button>
            </form>
          </div>

          <div className="pt-2 text-center">
            <Link href="/login" className="text-xs text-slate-500 hover:text-slate-800">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading verification...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
