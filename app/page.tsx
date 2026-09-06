"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  ScanLine,
  TrendingUp,
  ShieldCheck,
  Users,
  Download,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BarChart3,
  ChevronDown,
  Lock,
  Receipt,
  Scale,
  Check,
  Calculator,
} from "lucide-react";

export default function Home() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [activeTab, setActiveTab] = useState<"invoicing" | "ocr" | "ledger" | "compliance">("invoicing");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[480px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[600px] left-[-100px] w-[500px] h-[500px] bg-blue-600/10 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-[1200px] right-[-100px] w-[500px] h-[500px] bg-emerald-600/10 blur-[130px] pointer-events-none -z-10" />

      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#07090E]/80 border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                  GST Ledger
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Indian Invoicing & Accounting</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Product Tour</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faqs" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/[0.05] transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* 2. Hero Section */}
        <section className="pt-16 pb-20 md:pt-24 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-8 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Built for Indian Businesses • 100% Statutory GST Compliant</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.15] mb-6">
            Effortless GST Invoicing &{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Smart Ledger
            </span>{" "}
            for Growing Businesses
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            Generate compliant e-invoices, digitize vendor bills via Vision AI OCR,
            track real-time counterparty balances, and file GSTR-1 without calculation headaches.
            100% private, sovereign data architecture.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Get Started Free — 14-Day Trial</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl text-base font-semibold text-slate-200 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] backdrop-blur-lg transition-all"
            >
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <span>Explore Live Dashboard</span>
            </Link>
          </div>

          {/* Quick trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-y-3 gap-x-8 text-xs font-medium text-slate-400 pt-2 border-t border-white/[0.06] max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Luhn Mod-36 GSTIN Validation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Single or Multi-User RBAC</span>
            </div>
          </div>

          {/* 3. Hero Visual Preview Card */}
          <div className="mt-14 relative mx-auto max-w-5xl rounded-2xl border border-white/[0.12] bg-[#0E131F]/90 p-3 sm:p-4 shadow-2xl shadow-indigo-950/50 backdrop-blur-2xl text-left">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-400 ml-2 font-mono">gst-ledger.local/dashboard</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Financial Year 2024-25 Active
              </div>
            </div>

            {/* Dashboard Mock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Gross Sales (Quarter)</span>
                  <span className="text-emerald-400 font-medium">+18.4%</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">₹ 14,82,450.00</div>
                <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>CGST: ₹1,33,420 • SGST: ₹1,33,420</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Input Tax Credit (ITC)</span>
                  <span className="text-indigo-400 font-medium">Reconciled</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">₹ 1,94,800.00</div>
                <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Eligible under Section 16(2)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Net GST Payable</span>
                  <span className="text-amber-400 font-medium">Due in 12 days</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">₹ 72,040.00</div>
                <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>GSTR-3B Ready with Challan summary</span>
                </div>
              </div>
            </div>

            {/* Simulated Live Table / Scanner preview */}
            <div className="rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden text-xs">
              <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between font-semibold text-slate-300">
                <span>Recent Statutory Invoices</span>
                <span className="text-indigo-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> AI Vision OCR Auto-Matched
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                      INV
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">INV-2025-0142 • Tata Motors Supplies</div>
                      <div className="text-[11px] text-slate-400">GSTIN: 27AAACT2727Q1ZW • Maharashtra (Intra-state)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">₹ 1,18,000.00</div>
                    <div className="text-[10px] text-emerald-400 font-medium">Tax 18% (CGST 9% + SGST 9%)</div>
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                      OCR
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">PB-8821 • Cloudflare India Pvt Ltd</div>
                      <div className="text-[11px] text-slate-400">GSTIN: 29AABCC1234F1Z8 • Karnataka (Inter-state)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">₹ 24,780.00</div>
                    <div className="text-[10px] text-purple-400 font-medium">IGST 18% • Vision Extracted</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Stat Numbers & Performance Proof */}
        <section className="border-y border-white/[0.08] bg-white/[0.01] py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">₹ 50 Cr+</div>
                <div className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Invoices Reconciled</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-indigo-400 tracking-tight">100%</div>
                <div className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Data Privacy & Sovereignty</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">&lt; 1.5s</div>
                <div className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Vision AI Bill Extraction</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">0.00%</div>
                <div className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Decimal Tax Variance</div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Core Features Matrix */}
        <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Full Suite Architecture
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Everything Your Business Needs for GST Compliance
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              Engineered from scratch to replace chaotic spreadsheets and bulky legacy accounting tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all hover:border-indigo-500/30 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Automated Tax Calculation</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Automatic bifurcation of CGST, SGST, and IGST based on counterparty state codes.
                Full support for 0%, 5%, 12%, 18%, and 28% statutory slabs with discount deduction.
              </p>
              <div className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                <span>Intra & Inter-State Engine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all hover:border-purple-500/30 group">
              <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ScanLine className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Vision AI Invoice Scanner</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Drop any vendor bill or photo. Our Groq Vision LLM extracts invoice numbers, line items,
                HSN codes, and taxes in seconds, auto-linking directly to supplier master records.
              </p>
              <div className="text-xs font-medium text-purple-400 flex items-center gap-1">
                <span>No manual data entry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all hover:border-emerald-500/30 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Double-Entry Party Ledger</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Maintains running balances with Dr/Cr nature for every customer and supplier.
                Enables FIFO payment allocation against outstanding invoices and ageing analysis.
              </p>
              <div className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <span>Exact Decimal Precision</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all hover:border-blue-500/30 group">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">GSTR-1 Ready Reports</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Export B2B, B2CL, and B2CS tables formatted according to GST portal filing specifications.
                Generate beautiful PDF tax invoices with embedded QR and HSN summaries.
              </p>
              <div className="text-xs font-medium text-blue-400 flex items-center gap-1">
                <span>Excel & PDF Exports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all hover:border-amber-500/30 group">
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Role-Based Team Control</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Invite team members with distinct access tiers: Admin, Accountant, or Read-only Auditor.
                Every record update, edit, and deletion is recorded in a tamper-proof audit trail.
              </p>
              <div className="text-xs font-medium text-amber-400 flex items-center gap-1">
                <span>Multi-user collaboration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 6 */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all hover:border-rose-500/30 group">
              <div className="w-12 h-12 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Zero BaaS Lock-In</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Your financial books remain strictly your property. Backed by high-speed SQLite WAL
                storage with scheduled automated backups, rate-limiting shields, and brute-force protection.
              </p>
              <div className="text-xs font-medium text-rose-400 flex items-center gap-1">
                <span>Enterprise Security</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </section>

        {/* 6. Interactive Workflow Tabs Section */}
        <section id="demo" className="py-20 bg-white/[0.015] border-y border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Seamless Workflow
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
                See How GST Ledger Accelerates Your Day
              </h2>
              <p className="text-slate-400 text-base">
                Click across the core modules to preview how your transactions flow effortlessly into statutory books.
              </p>
            </div>

            {/* Tabs Selector */}
            <div className="flex items-center justify-center gap-2 mb-10 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveTab("invoicing")}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "invoicing"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Sales Invoicing</span>
              </button>

              <button
                onClick={() => setActiveTab("ocr")}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "ocr"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-white"
                }`}
              >
                <ScanLine className="w-4 h-4" />
                <span>Vision AI OCR</span>
              </button>

              <button
                onClick={() => setActiveTab("ledger")}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "ledger"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-white"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Party Ledger</span>
              </button>

              <button
                onClick={() => setActiveTab("compliance")}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "compliance"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>GSTR-1 & Audit</span>
              </button>
            </div>

            {/* Tab Content Display */}
            <div className="rounded-2xl border border-white/[0.1] bg-[#0C101A] p-6 sm:p-10 shadow-2xl max-w-5xl mx-auto">
              {activeTab === "invoicing" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Step 01 • Sales & Credit Notes</span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      Create Beautiful, GST-Compliant Tax Invoices in Seconds
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Select any registered party and the system automatically matches state codes.
                      Add line items with HSN/SAC lookups, and watch the system split taxes into CGST, SGST, or IGST with zero manual math.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Instant PDF generation with bank details & QR code</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Automatic credit and debit notes linked to original invoices</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Custom prefix sequencing (e.g. INV/24-25/001)</span>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-black/60 p-5 font-mono text-xs space-y-3">
                    <div className="flex justify-between border-b border-white/[0.08] pb-2 text-slate-400">
                      <span>TAX INVOICE</span>
                      <span className="text-indigo-400 font-bold">INV-2025-089</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Customer: Reliance Retail</span>
                      <span>GSTIN: 27AABCR1234F1Z5</span>
                    </div>
                    <div className="p-3 bg-white/[0.02] rounded border border-white/[0.04] space-y-1">
                      <div className="flex justify-between text-slate-200">
                        <span>IT Consulting Services (SAC 9983)</span>
                        <span>₹ 1,00,000.00</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Taxable Amount</span>
                        <span>₹ 1,00,000.00</span>
                      </div>
                      <div className="flex justify-between text-indigo-300 text-[11px]">
                        <span>CGST (9%)</span>
                        <span>₹ 9,000.00</span>
                      </div>
                      <div className="flex justify-between text-indigo-300 text-[11px]">
                        <span>SGST (9%)</span>
                        <span>₹ 9,000.00</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/[0.08]">
                      <span>Total Invoice Amount</span>
                      <span className="text-emerald-400">₹ 1,18,000.00</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "ocr" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Step 02 • Optical Character Recognition</span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      Drop Any Supplier Receipt or Bill. AI Does the Rest.
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Powered by Groq Llama-3.2-Vision. Scans photo receipts, scanned paper, or digital PDFs,
                      extracting tax breakdowns, invoice dates, vendor GSTINs, and matching them to your supplier ledger in under 2 seconds.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Automatic HSN code and statutory tax rate deduction</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Interactive side-by-side review studio before book entry</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Find or auto-create supplier with statutory PAN detection</span>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Llama-3.2 Vision OCR Engine</div>
                        <div className="text-xs text-purple-300">Confidence Score: 99.4% • Model: Groq Flash</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs font-mono bg-black/60 p-3 rounded-lg border border-white/[0.06]">
                      <div className="text-slate-400">✓ Extracted Vendor: AWS Cloud Services</div>
                      <div className="text-slate-400">✓ Extracted GSTIN: 27AABCG1234F1ZP</div>
                      <div className="text-slate-400">✓ Extracted Base Value: ₹ 45,200.00</div>
                      <div className="text-emerald-400">✓ Extracted IGST 18%: ₹ 8,136.00</div>
                      <div className="text-white font-bold">✓ Net Invoice Total: ₹ 53,336.00</div>
                    </div>
                    <div className="text-xs text-center text-slate-400">Ready to post directly into Purchase Register</div>
                  </div>
                </div>
              )}

              {activeTab === "ledger" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 03 • Running Balances & Ageing</span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      Crystal Clear Counterparty Balances in Real Time
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Every payment is matched against open invoices via FIFO or manual allocation.
                      View party ledgers with running balance totals, Dr/Cr indicators, and 30/60/90-day ageing brackets.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Arbitrary-precision Decimal arithmetic (zero float rounding drift)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Instant party ledger statement download for reconciliation</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Automated payment mode tracking: NEFT, RTGS, UPI, Cheque, Cash</span>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-black/60 p-5 font-mono text-xs space-y-2.5">
                    <div className="text-slate-400 font-bold border-b border-white/[0.08] pb-2">
                      PARTY STATEMENT: INFOSYS LTD (DR)
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>01 Apr: Opening Balance</span>
                      <span>₹ 0.00</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>10 Apr: Invoice #102 (Sales)</span>
                      <span className="text-emerald-400">+₹ 2,36,000.00 (Dr)</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>18 Apr: Payment via NEFT</span>
                      <span className="text-indigo-400">-₹ 1,50,000.00 (Cr)</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/[0.08]">
                      <span>Closing Net Balance</span>
                      <span className="text-amber-400">₹ 86,000.00 (Dr Receivable)</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "compliance" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Step 04 • GSTR Filing & Audit Security</span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white">
                      One-Click GSTR-1 Excel Schedules & Full Audit Trail
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Download statutory B2B, B2CL, and B2CS tables mapped directly to government portal templates.
                      Maintain compliance peace of mind with immutable change-history tracking for every transaction.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Ready-to-upload Excel sheets for GST Practitioner or CA</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Full audit log recording user, timestamp, and field-level diffs</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Turnkey multi-GSTIN support under a single business account</span>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-5 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between text-white font-bold border-b border-white/[0.08] pb-2">
                      <span>GSTR-1 EXPORT SUMMARY</span>
                      <span className="text-emerald-400">COMPLIANT</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Table 4A - B2B Invoices</span>
                      <span>42 Records • ₹ 38.4L</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Table 5A - B2C Large Invoices</span>
                      <span>6 Records • ₹ 8.2L</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Table 7 - B2C Small</span>
                      <span>85 Records • ₹ 12.1L</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Table 9B - Credit / Debit Notes</span>
                      <span>3 Records • -₹ 1.4L</span>
                    </div>
                    <div className="p-2.5 bg-blue-600/20 text-blue-300 rounded border border-blue-500/30 flex items-center justify-between mt-2">
                      <span>Export format: gstr1_fy2425_q4.xlsx</span>
                      <Download className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 7. Transparent SaaS Pricing */}
        <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Simple, Predictable Plans
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Invest in Speed, Privacy, and Accuracy
            </h2>
            <p className="text-slate-400 text-base sm:text-lg mb-8">
              Start free today. Upgrade when you need team seats or unlimited AI vision bill extraction.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="inline-flex items-center p-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  billingCycle === "monthly"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  billingCycle === "annual"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col justify-between hover:border-white/[0.15] transition-all">
              <div>
                <div className="text-lg font-bold text-white mb-1">Starter</div>
                <div className="text-xs text-slate-400 mb-6">Perfect for freelancers & micro businesses</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">₹ 0</span>
                  <span className="text-xs text-slate-400">/ forever</span>
                </div>
                <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Up to 50 Invoices / month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>1 Business & 1 Admin Seat</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Standard PDF Tax Invoices</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Double-Entry Party Ledger</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>5 AI Vision OCR scans / month</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="w-full py-3 rounded-xl border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.09] text-center text-sm font-semibold text-white transition-all"
              >
                Get Started Free
              </Link>
            </div>

            {/* Growth Plan (Highlighted) */}
            <div className="rounded-2xl border-2 border-indigo-500/60 bg-gradient-to-b from-indigo-950/20 via-[#0C101A] to-[#0C101A] p-8 flex flex-col justify-between shadow-2xl shadow-indigo-950/50 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
                Most Popular for SMEs
              </div>
              <div>
                <div className="text-lg font-bold text-white mb-1">Growth Pro</div>
                <div className="text-xs text-indigo-300 mb-6">Designed for active traders & manufacturers</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    {billingCycle === "annual" ? "₹ 799" : "₹ 999"}
                  </span>
                  <span className="text-xs text-slate-400">/ month billed {billingCycle}</span>
                </div>
                <ul className="space-y-3.5 text-sm text-slate-200 mb-8">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="font-semibold">Unlimited GST Invoices</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>3 Team Seats (Admin, Accountant, Auditor)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>150 AI Vision OCR Bill Scans / month</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>One-Click GSTR-1 Excel Export</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Party Ageing Reports & Payment Allocation</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Full Audit Trail & Scheduled Backups</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01]"
              >
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col justify-between hover:border-white/[0.15] transition-all">
              <div>
                <div className="text-lg font-bold text-white mb-1">Chartered Firm / Enterprise</div>
                <div className="text-xs text-slate-400 mb-6">For multi-GSTIN companies & CA practitioners</div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    {billingCycle === "annual" ? "₹ 1,999" : "₹ 2,499"}
                  </span>
                  <span className="text-xs text-slate-400">/ month billed {billingCycle}</span>
                </div>
                <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Unlimited Invoices & Businesses (Multi-GSTIN)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Unlimited Team Members & Role Delegation</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Unlimited AI Vision Invoice Extractions</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Dedicated CA Multi-Client Switcher</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Priority Support & Custom Backup Hooks</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="w-full py-3 rounded-xl border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.09] text-center text-sm font-semibold text-white transition-all"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

        {/* 8. Frequently Asked Questions (Accordion) */}
        <section id="faqs" className="py-20 border-t border-white/[0.08] max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Frequently Asked Questions</h2>
            <p className="text-slate-400 text-sm">Clear answers regarding GST rules, data sovereignty, and security.</p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How does the system handle CGST, SGST, and IGST calculations?",
                a: "GST Ledger checks the first 2 digits (state code) of your business GSTIN and compares them with the counterparty's GSTIN. If both state codes match, it automatically splits statutory tax into equal CGST + SGST parts. If state codes differ, it applies IGST automatically.",
              },
              {
                q: "Is my business data shared with third-party cloud aggregators?",
                a: "No. Unlike legacy cloud SaaS platforms that pool user databases or mine accounting trends, GST Ledger runs on a local-first SQLite WAL architecture with complete tenant isolation. Your data stays entirely in your deployment.",
              },
              {
                q: "How does the AI Vision Invoice scanner extract purchase bills?",
                a: "Our AI pipeline utilizes high-precision Vision models running on ultra-fast Groq hardware. It parses vendor GSTIN, invoice dates, line items, and taxes with statutory precision and automatically matches or creates the supplier master record in your books.",
              },
              {
                q: "Can I invite my Chartered Accountant or tax auditor?",
                a: "Yes! You can invite external accountants or auditors with specific RBAC permission tiers. Auditors receive read-only ledger access, while accountants can post and allocate payments without altering core business settings.",
              },
              {
                q: "Can I export data for direct filing on the GST portal?",
                a: "Yes. GST Ledger generates one-click Excel workbooks matching GSTR-1 government templates, categorized into Table 4A (B2B), Table 5A (B2C Large), Table 7 (B2C Small), and Table 9B (Credit/Debit notes).",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between text-sm sm:text-base font-semibold text-slate-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                      openFaq === idx ? "rotate-180 text-indigo-400" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/[0.04] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 9. Final High-Converting CTA Banner */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-purple-950/20 to-transparent p-8 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[100px] pointer-events-none" />
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
              Take Control of Your GST Accounting Today
            </h2>
            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8">
              Join Indian business owners, traders, and chartered accountants who have eliminated manual math and invoice clutter.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <span>Create Your Free Account</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-7 py-4 rounded-xl text-base font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] transition-all"
              >
                Sign In to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <footer className="border-t border-white/[0.08] bg-[#05070B] py-14 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-white">GST Ledger</span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Modern GST-compliant invoicing, AI-powered purchase bill digitization, and double-entry party ledger accounting for Indian enterprises.
            </p>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>System operational • SQLite WAL Storage</span>
            </div>
          </div>

          <div>
            <div className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Product</div>
            <ul className="space-y-2">
              <li><a href="#features" className="hover:text-white transition-colors">Tax Engine</a></li>
              <li><a href="#demo" className="hover:text-white transition-colors">Party Ledger</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing Plans</a></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Compliance</div>
            <ul className="space-y-2">
              <li><Link href="/dashboard" className="hover:text-white transition-colors">GSTR-1 Schedules</Link></li>
              <li><Link href="/onboarding" className="hover:text-white transition-colors">GSTIN Verification</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Audit Trail</Link></li>
              <li><Link href="/api/health" className="hover:text-white transition-colors">System Health</Link></li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-white uppercase tracking-wider text-[11px] mb-3">Legal & Support</div>
            <ul className="space-y-2">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Account Login</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>© {new Date().getFullYear()} GST Ledger Platform. Built for Indian MSMEs and Chartered Accountants.</div>
          <div className="text-slate-400">Statutory Tax Split • Mod-36 Luhn Verified • Local Sovereignty</div>
        </div>
      </footer>
    </div>
  );
}
