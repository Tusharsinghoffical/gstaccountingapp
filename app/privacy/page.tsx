import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | GST Ledger",
  description: "Privacy policy describing how GST Ledger protects your financial and organizational data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/login"
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center space-x-1"
          >
            <span>&larr; Back to sign in</span>
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: September 2026 &bull; Committed to financial privacy and zero data leakage
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              We collect information strictly necessary to provide double-entry accounting and GST compliance services:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li>Account credentials (name, email address, salted bcrypt password hashes).</li>
              <li>Business entities and tax registration numbers (GSTIN, PAN, registered addresses).</li>
              <li>Customer, supplier, and financial transactions (invoices, vouchers, payments, ledger records).</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">2. How Information is Used</h2>
            <p>
              Your data is utilized solely for:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li>Executing double-entry accounting computations and running balance derivations.</li>
              <li>Generating GST-compliant tax invoices, credit/debit notes, and GSTR summaries.</li>
              <li>Authenticating users, verifying email ownership, and mitigating brute-force abuse.</li>
            </ul>
            <p className="mt-3">
              We do not sell, rent, monetize, or disclose your corporate accounting data to third-party advertisers.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Security & Encryption</h2>
            <p>
              Authentication tokens and password reset hashes utilize industry-standard SHA-256 and bcrypt cost factor 12 implementations. Session tokens are transmitted over TLS-encrypted HTTPS connections and stored in secure, HTTP-only, SameSite cookies.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">4. User Rights & Data Portability</h2>
            <p>
              You have the right to request export or complete deletion of your organizational records at any time by contacting your assigned business administrator or reaching out through our support channels.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} GST Ledger Inc. All rights reserved.</p>
          <div className="space-x-4">
            <Link href="/terms" className="hover:text-slate-400">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-400">Support</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
