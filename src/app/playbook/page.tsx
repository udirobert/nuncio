import type { Metadata } from "next";
import Link from "next/link";
import { PLAYBOOK } from "@/lib/playbook";
import { PlaybookList } from "@/components/playbook-list";

export const metadata: Metadata = {
  title: "The nuncio playbook — worked examples of great personalised outreach",
  description:
    "Six teardowns showing what makes outreach land: founder-to-founder, investor pitch, recruiting, conference follow-up, and product feedback. Each shows the brief, the generated script, and what was deliberately skipped.",
  openGraph: {
    title: "The nuncio playbook",
    description:
      "Worked examples of personalised video outreach — with teardowns of what made each one land.",
  },
};

export default function PlaybookPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-dark/60">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-4 py-2 text-xs font-medium"
        >
          Generate a video
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 max-w-[720px] mx-auto">
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[0.9] mb-4">
          The nuncio
          <br />
          <span className="italic">playbook</span>
        </h1>
        <p className="text-ink-muted text-[15px] leading-relaxed max-w-[480px] mb-2">
          Worked examples of great personalised outreach. Each one shows the
          recipient, the brief, the generated script, and a teardown of what
          made it land — and what was deliberately left out.
        </p>
        <p className="text-[11px] text-ink-faint">
          Composite examples for illustration. Names and details may be fictionalised.
        </p>
      </section>

      {/* Playbook entries — client component for expand/collapse */}
      <section className="px-6 pb-20 max-w-[720px] mx-auto">
        <PlaybookList entries={PLAYBOOK} />
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 max-w-[720px] mx-auto text-center">
        <div className="rounded-2xl border border-cream-dark bg-white/80 px-8 py-8">
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight mb-2">
            Ready to send yours?
          </h2>
          <p className="text-sm text-ink-muted mb-5">
            Paste a profile URL. Get a personalised video in 90 seconds.
          </p>
          <Link
            href="/"
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-6 py-3.5 text-sm font-medium shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            Generate a video
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 text-center border-t border-cream-dark/60">
        <p className="text-[11px] text-ink-faint">
          nuncio — your intelligent emissary
        </p>
      </footer>
    </div>
  );
}
