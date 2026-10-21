"use client";

import { Face } from "@/components/face";

/**
 * The promises, each proved by a real artefact from the product.
 *
 * We have no customer testimonials yet, and inventing them would be the
 * easiest possible lie on a page whose whole subject is disclosure. So the
 * cards make the product's promises and show the thing that makes each one
 * true — the line the representative actually says, the choice the recipient
 * actually gets.
 */
const PROMISES = [
  {
    tint: "bg-accent-soft/50 border-accent/15",
    eyebrow: "The playbook",
    statement: "It answers from your playbook.",
    artifact: (
      <p className="text-body-xs leading-relaxed text-ink">
        &ldquo;We map your handoffs and show you where work gets stuck, then fix the worst
        one first.&rdquo;
      </p>
    ),
  },
  {
    tint: "bg-warm-soft/60 border-warm/20",
    eyebrow: "The boundaries",
    statement: "It never promises what you wouldn’t.",
    artifact: (
      <p className="text-body-xs leading-relaxed text-ink">
        &ldquo;I don&rsquo;t quote pricing &mdash; that&rsquo;s the one thing I leave to them.&rdquo;
      </p>
    ),
  },
  {
    tint: "bg-cream-soft border-cream-dark",
    eyebrow: "The escalation",
    statement: "It hands you the conversation.",
    artifact: (
      <p className="text-body-xs leading-relaxed text-ink">
        They ask for you. You decide whether to join &mdash; availability is a switch you
        control, and it expires on its own.
      </p>
    ),
  },
  {
    tint: "bg-success-soft/50 border-success/20",
    eyebrow: "The disclosure",
    statement: "It is always disclosed.",
    artifact: (
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-label-xs font-medium text-cream">
          AI
        </span>
        <span className="text-label-xs text-ink-faint">
          AI representative &middot; guided by their playbook
        </span>
      </div>
    ),
  },
] as const;

export function PromiseCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {PROMISES.map((promise) => (
        <div
          key={promise.eyebrow}
          className={`rounded-2xl border p-5 sm:p-6 flex flex-col gap-3 ${promise.tint}`}
        >
          <p className="text-label-xs uppercase tracking-widest text-ink-faint font-medium">
            {promise.eyebrow}
          </p>
          <h3 className="font-display text-2xl sm:text-[28px] leading-[1.05] tracking-tight text-ink">
            {promise.statement}
          </h3>
          <div className="mt-auto pt-1">{promise.artifact}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * The row of faces.
 *
 * The product has exactly two honest ways to have a face, and the page
 * should say so before anyone clicks: your own, or a disclosed persona that
 * stands in for you.
 */
export function FaceRow() {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-1">
      <div className="flex items-center -space-x-2">
        <span className="w-9 h-9 rounded-full border-2 border-cream bg-white flex items-center justify-center text-label-xs text-ink-faint overflow-hidden">
          <span className="sr-only">Your photo</span>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="9" r="3.5" />
            <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
          </svg>
        </span>
        <span className="w-9 h-9 rounded-full border-2 border-cream overflow-hidden bg-cream-dark">
          <Face src="/representative.webp" name="A disclosed persona" size="xs" alt="" className="w-full h-full border-0" />
        </span>
      </div>
      <p className="text-body-xs text-ink-faint max-w-[340px] leading-relaxed">
        Two honest ways to have a face &mdash; your own, or a disclosed persona that stands
        in for you. Either way the prospect is told which one they&rsquo;re talking to.
      </p>
    </div>
  );
}
