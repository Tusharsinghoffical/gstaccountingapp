export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50 text-slate-900">
      <div className="max-w-3xl w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 md:p-12 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            Next.js 14 App Router
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            GST Ledger
          </h1>
          <p className="text-slate-600 text-base leading-relaxed">
            Indian Invoicing and Ledger Management Platform scaffolded with Supabase,
            Tailwind CSS, Zod, and React Hook Form. AWS-free architecture.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Framework
            </div>
            <div className="text-base font-semibold text-slate-900 mt-1">
              Next.js 14 (App Router)
            </div>
            <p className="text-xs text-slate-600 mt-1">TypeScript 5 & Server Components</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Database & Auth
            </div>
            <div className="text-base font-semibold text-slate-900 mt-1">
              Supabase SSR & Client
            </div>
            <p className="text-xs text-slate-600 mt-1">@supabase/supabase-js & @supabase/ssr</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Validation & Forms
            </div>
            <div className="text-base font-semibold text-slate-900 mt-1">
              Zod & React Hook Form
            </div>
            <p className="text-xs text-slate-600 mt-1">Type-safe schema validation</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Styling
            </div>
            <div className="text-base font-semibold text-slate-900 mt-1">
              Tailwind CSS
            </div>
            <p className="text-xs text-slate-600 mt-1">Utility-first design system</p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Launch Dashboard App Shell</span>
            <span>→</span>
          </a>
          <span className="text-xs text-slate-500 font-medium">Desktop & Mobile Responsive</span>
        </div>

        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>Folder structure: /app, /components, /lib/supabase, /lib/validation, /types</span>
          <span className="text-emerald-700 font-medium">AWS-Free Verified</span>
        </div>
      </div>
    </main>
  );
}
