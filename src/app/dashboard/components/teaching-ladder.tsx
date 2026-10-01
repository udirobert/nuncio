"use client";

import Link from "next/link";

const STEPS = [
  { label: "First link", desc: "Create a first touch in the studio" },
  { label: "First conversation", desc: "A prospect talks with your AI representative" },
  { label: "First booking", desc: "They choose a time or request you live" },
] as const;

export function TeachingLadder({
  activeStep,
  compact = false,
}: {
  /** 0 = first link, 1 = first conversation, 2 = first booking */
  activeStep: 0 | 1 | 2;
  compact?: boolean;
}) {
  return (
    <ol
      aria-label="Getting started steps"
      className={`text-left space-y-2 ${compact ? "" : "mt-4"}`}
    >
      {STEPS.map((step, i) => {
        const done = i < activeStep;
        const current = i === activeStep;
        return (
          <li key={step.label} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-label-xs font-medium transition-[color,background-color,border-color,opacity] ${
                done
                  ? "bg-success/15 text-success"
                  : current
                    ? "bg-accent text-white"
                    : "border border-cream-dark bg-white text-ink-faint"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
                  <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0">
              <p
                className={`text-body-xs font-medium ${current ? "text-ink" : "text-ink-muted"}`}
                aria-current={current ? "step" : undefined}
              >
                {step.label}
              </p>
              <p className="text-label-base text-ink-faint">{step.desc}</p>
            </div>
          </li>
        );
      })}
      <li className="pt-1">
        <Link
          href="/studio"
          className="inline-block text-label-sm uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Create a first touch →
        </Link>
      </li>
    </ol>
  );
}
