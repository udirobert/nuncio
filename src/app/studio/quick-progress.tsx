"use client";

import { motion } from "motion/react";

interface QuickProgressProps {
  showDetails: boolean;
  onToggleDetails: () => void;
}

const STEPS = [
  { id: "enrich", label: "Reading profile" },
  { id: "script", label: "Writing script" },
  { id: "build", label: "Building creative" },
  { id: "render", label: "Rendering video" },
];

export function QuickProgress({ showDetails, onToggleDetails }: QuickProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex items-center justify-center px-6"
    >
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
              Generating
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Building your video
          </h2>
          <p className="text-sm text-ink-muted">
            Usually takes about 90 seconds.
          </p>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={step.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-cream-dark"
            >
              {i === 1 ? (
                <span className="relative flex h-4 w-4 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-30" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-accent/20 border-2 border-accent" />
                </span>
              ) : i < 1 ? (
                <span className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
                    <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                  </svg>
                </span>
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-cream-dark shrink-0" />
              )}
              <span className={`text-sm ${
                i === 1 ? "text-ink font-medium" : i < 1 ? "text-ink-muted" : "text-ink-faint"
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={onToggleDetails}
            className="text-[11px] text-ink-faint hover:text-accent transition-colors flex items-center gap-1 mx-auto"
          >
            <svg
              viewBox="0 0 16 16"
              className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
