"use client";

import { motion, AnimatePresence } from "motion/react";
import type { StepState } from "@/lib/pipeline";

interface ProgressStepperProps {
  steps: StepState[];
}

const STEP_DESCRIPTIONS: Record<string, string> = {
  enrich: "Gathering intelligence from their public profiles",
  script: "Crafting a message that speaks to who they are",
  canvas: "Composing the visual narrative",
  video: "Rendering your personalised video",
};

export function ProgressStepper({ steps }: ProgressStepperProps) {
  const activeStep = steps.find((s) => s.status === "active");
  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
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
          className="mb-10"
        >
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-none mb-3">
            Composing...
          </h1>
          <AnimatePresence mode="wait">
            {activeStep && (
              <motion.p
                key={activeStep.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-ink-muted text-sm"
              >
                {STEP_DESCRIPTIONS[activeStep.id]}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Progress bar */}
        <div className="mb-10">
          <div className="h-[2px] w-full bg-cream-dark rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-ink rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-1" role="status" aria-live="polite">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: i * 0.1,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`
                flex items-center gap-4 rounded-lg px-4 py-3
                transition-colors duration-300
                ${step.status === "active" ? "bg-white shadow-sm" : ""}
              `}
            >
              {/* Icon */}
              <div className="relative flex-shrink-0">
                {step.status === "complete" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                    }}
                    className="w-7 h-7 rounded-full bg-ink flex items-center justify-center"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5 text-cream"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                  </motion.div>
                )}
                {step.status === "active" && (
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-accent/20 animate-pulse-ring" />
                    <span className="w-3 h-3 rounded-full bg-accent" />
                  </div>
                )}
                {step.status === "pending" && (
                  <div className="w-7 h-7 rounded-full border-2 border-cream-dark" />
                )}
                {step.status === "failed" && (
                  <div className="w-7 h-7 rounded-full bg-error-soft flex items-center justify-center">
                    <span className="text-error text-xs font-bold">✕</span>
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm flex-1 transition-colors duration-300 ${
                  step.status === "pending"
                    ? "text-ink-faint"
                    : step.status === "active"
                      ? "text-ink font-medium"
                      : "text-ink-light"
                }`}
              >
                {step.label}
              </span>

              {/* Elapsed */}
              {step.status === "complete" && step.elapsed !== undefined && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-ink-faint font-[family-name:var(--font-mono)]"
                >
                  {step.elapsed.toFixed(1)}s
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-ink-faint mt-10"
        >
          Usually takes about 90 seconds
        </motion.p>
      </motion.div>
    </main>
  );
}
