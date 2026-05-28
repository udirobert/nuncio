"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type QuickProgressStep = "enrich" | "script" | "build" | "render";

interface QuickProgressProps {
  showDetails: boolean;
  onToggleDetails: () => void;
  currentStep: QuickProgressStep;
  elapsedSeconds: number;
  videoRendering?: "idle" | "rendering" | "done" | "failed";
}

const STEPS = [
  { id: "enrich", label: "Reading profile" },
  { id: "script", label: "Writing script" },
  { id: "build", label: "Building creative" },
  { id: "render", label: "Rendering video" },
];

const MOMENTS = [
  "Finding the sharpest personal hook",
  "Trimming the script so it feels human",
  "Choosing a clean creative direction",
  "Sending the render job to HeyGen",
  "Checking the video room lights",
  "Waiting for the final MP4 to land",
];

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function QuickProgress({
  showDetails,
  onToggleDetails,
  currentStep,
  elapsedSeconds,
  videoRendering = "idle",
}: QuickProgressProps) {
  const [momentIndex, setMomentIndex] = useState(0);
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.id === currentStep));
  const progress = useMemo(() => {
    const base = (activeIndex / STEPS.length) * 100;
    const activeBoost = videoRendering === "rendering" ? 18 : 12;
    return Math.min(96, Math.round(base + activeBoost));
  }, [activeIndex, videoRendering]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMomentIndex((index) => (index + 1) % MOMENTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex items-center justify-center px-6"
    >
      <div className="w-full max-w-md mx-auto space-y-6">
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
            Usually takes about 90 seconds. You have waited {formatElapsed(elapsedSeconds)}.
          </p>
        </div>

        <div className="rounded-2xl border border-cream-dark bg-white p-4 shadow-sm space-y-3 overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-ink-faint">
            <span>Live build</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent via-warm to-success"
              initial={{ width: "8%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={momentIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-ink-light"
            >
              {MOMENTS[momentIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const isActive = i === activeIndex;
            const isComplete = i < activeIndex || (videoRendering === "done" && step.id === "render");
            const isFailed = videoRendering === "failed" && step.id === currentStep;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-white border transition-colors ${
                  isActive ? "border-accent/30 shadow-sm" : "border-cream-dark"
                }`}
              >
                {isFailed ? (
                  <span className="w-4 h-4 rounded-full bg-error-soft flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  </span>
                ) : isActive ? (
                  <span className="relative flex h-4 w-4 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-30" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-accent/20 border-2 border-accent" />
                  </span>
                ) : isComplete ? (
                  <span className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
                      <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-cream-dark shrink-0" />
                )}
                <span className={`text-sm ${
                  isActive ? "text-ink font-medium" : isComplete ? "text-ink-muted" : "text-ink-faint"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-cream-dark bg-cream/60 p-4 space-y-2"
          >
            <p className="text-xs font-medium text-ink">What is happening now</p>
            <p className="text-xs leading-relaxed text-ink-muted">
              The agent has prepared the profile and script, then starts a HeyGen render job. We check every few seconds and will move you forward automatically when the MP4 is ready.
            </p>
          </motion.div>
        )}

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
