import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 text-slate-100">
      <div className="max-w-md w-full text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-6 shadow-inner">
          <span className="text-3xl font-extrabold tracking-tight">404</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          The page or financial resource you are searching for does not exist, has been moved, or is restricted.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
