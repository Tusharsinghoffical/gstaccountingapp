"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions/onboarding";
import { validateGSTIN } from "@/lib/validation/gstin";
import { STATE_CODE_MAP } from "@/lib/constants/states";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanGstin = gstin.trim().toUpperCase();
  const gstinValidation = cleanGstin.length === 15 ? validateGSTIN(cleanGstin) : null;
  const detectedState = gstinValidation?.stateCode
    ? STATE_CODE_MAP[gstinValidation.stateCode] || `State Code: ${gstinValidation.stateCode}`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cleanGstin.length !== 15) {
      setError("GSTIN must be exactly 15 alphanumeric characters.");
      return;
    }

    if (!gstinValidation?.isValid) {
      setError(gstinValidation?.error || "Invalid GSTIN format or checksum mismatch.");
      return;
    }

    setLoading(true);

    try {
      const res = await completeOnboarding({
        name,
        gstin: cleanGstin,
        address,
      });

      if (!res.success) {
        setError(res.error || "Failed to setup business.");
      } else {
        // Refresh session and push to dashboard
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 shadow-inner">
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Set Up Your Business
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Enter your registered business and GST details to activate your accounting ledger.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 bg-red-950/50 border border-red-800/60 rounded-xl p-4 text-sm text-red-300 flex items-start space-x-3">
              <svg
                className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Business / Legal Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Enterprises Pvt Ltd"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                GSTIN (15-Character GST Number)
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27AAPFU0939F1ZV"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm uppercase tracking-wider"
                />
              </div>

              {cleanGstin.length > 0 && cleanGstin.length < 15 && (
                <p className="mt-1 text-xs text-amber-400">
                  {cleanGstin.length} / 15 characters entered
                </p>
              )}

              {gstinValidation && (
                <div className="mt-2 text-xs">
                  {gstinValidation.isValid ? (
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Valid GSTIN (Mod-36 Verified) - {detectedState}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-red-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{gstinValidation.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                Principal Place of Business (Address)
              </label>
              <div className="mt-1">
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, PIN Code"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (cleanGstin.length === 15 && !gstinValidation?.isValid)}
              className="w-full mt-2 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "Creating Business..." : "Complete Setup & Open Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
