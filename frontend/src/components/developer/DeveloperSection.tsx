import { MLEvaluation } from '../authority/MLAnalytics';

export function DeveloperSection() {
  return <section aria-label="Developer section" className="w-full max-w-6xl self-start overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 text-slate-100">
    <header className="border-b border-slate-700 p-5">
      <h1 className="text-xl font-bold">Developer</h1>
      <p className="mt-2 text-sm text-slate-300">Project evaluation and model diagnostics. Incident analysis runs automatically during reporting.</p>
    </header>
    <MLEvaluation />
  </section>;
}
