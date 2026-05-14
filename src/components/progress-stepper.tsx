"use client";

import { motion, AnimatePresence } from "motion/react";
import type { StepState } from "@/lib/pipeline";

interface ProgressStepperProps {
  steps: StepState[];
}

const STEP_META: Record<string, { description: string; icon: React.ReactNode }> = {
  enrich: {
    description: "Gathering intelligence from their public profiles",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
    ),
  },
  script: {
    description: "Crafting a message that speaks to who they are",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  canvas: {
    description: "Composing the visual narrative",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  video: {
    description: "Rendering your personalised video",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
};

export function ProgressStepper({ steps }: ProgressStepperProps) {
  const activeStep = steps.find((s) => s.status === "active");
  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[540px]"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[0.9] mb-4">
            Composing your
            <br />
            <span className="italic">message</span>
          </h1>
          <AnimatePresence mode="wait">
            {activeStep && (
              <motion.p
                key={activeStep.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-ink-muted text-[15px]"
              >
                {STEP_META[activeStep.id]?.description}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Progress bar — thin, elegant */}
        <div className="mb-10">
          <div className="h-[3px] w-full bg-cream-dark rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-ink"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2" role="status" aria-live="polite">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: i * 0.1,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`
                flex items-center gap-4 rounded-2xl px-5 py-4
                transition-all duration-500
                ${step.status === "active" ? "bg-white shadow-md shadow-ink/5 scale-[1.02]" : ""}
                ${step.status === "complete" ? "opacity-60" : ""}
              `}
            >
              {/* Step icon */}
              <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
                {step.status === "complete" && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-10 h-10 rounded-full bg-ink flex items-center justify-center"
                  >
                    <svg viewBox="0 0 16 16" className="w-4 h-4 text-cream" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                  </motion.div>
                )}
                {step.status === "active" && (
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <motion.span
                      className="absolute inset-0 rounded-full bg-accent/10"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="relative text-accent">
                      {STEP_META[step.id]?.icon}
                    </span>
                  </div>
                )}
                {step.status === "pending" && (
                  <div className="w-10 h-10 rounded-full border-2 border-cream-dark flex items-center justify-center text-ink-faint/40">
                    {STEP_META[step.id]?.icon}
                  </div>
                )}
                {step.status === "failed" && (
                  <div className="w-10 h-10 rounded-full bg-error-soft flex items-center justify-center">
                    <span className="text-error text-sm font-bold">✕</span>
                  </div>
                )}
              </div>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm block transition-colors duration-300 ${
                    step.status === "active"
                      ? "text-ink font-medium"
                      : step.status === "pending"
                        ? "text-ink-faint"
                        : "text-ink-light"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Elapsed time */}
              {step.status === "complete" && step.elapsed !== undefined && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs text-ink-faint font-[family-name:var(--font-mono)] tabular-nums"
                >
                  {step.elapsed.toFixed(1)}s
                </motion.span>
              )}

              {/* Active indicator */}
              {step.status === "active" && (
                <motion.div
                  className="flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="w-1 h-1 rounded-full bg-accent"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.2,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-ink-faint mt-12"
        >
          This usually takes about 90 seconds
        </motion.p>
      </motion.div>
    </main>
  );
}
