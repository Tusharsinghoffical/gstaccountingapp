import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | GST Ledger",
  description: "Terms and conditions governing the use of the GST Ledger accounting platform.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-slate-400 mb-10">
          Last updated: September 2026 &bull; Effective for all registered organizations
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By creating an account, accessing, or utilizing the GST Ledger platform (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company, business, or other legal entity, you represent that you possess the authority to bind such entity.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">2. Accounting & Statutory GST Compliance</h2>
            <p>
              GST Ledger provides automated computational engines for Indian Goods & Services Tax (CGST, SGST, IGST) invoicing, double-entry ledgers, and credit/debit adjustments. While calculations follow statutory guidelines (including Luhn Mod-36 GSTIN validation), you remain solely responsible for the legal accuracy, tax filing, and reconciliation submitted to the GSTN or tax authorities.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Security & Authentication</h2>
            <p>
              You are responsible for safeguarding your credentials. Passwords must meet our high-entropy complexity requirements (minimum 10 characters, uppercase, numeric, and symbol characters). We implement automatic lockout protocols following consecutive failed login attempts to safeguard your ledger against unauthorized intrusion.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Ownership & Storage</h2>
            <p>
              All proprietary accounting records, customer lists, invoice registries, and transactional documents remain the exclusive property of your organization. GST Ledger stores data using robust local database volumes and transactional SQLite architectures with automated backup utilities.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white mb-3">5. Termination</h2>
            <p>
              You may terminate your account at any time. Upon termination, administrators can export complete accounting ledgers and data backups in accordance with standard data retention policies.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} GST Ledger Inc. All rights reserved.</p>
          <div className="space-x-4">
            <Link href="/privacy" className="hover:text-slate-400">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-slate-400">Support</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
