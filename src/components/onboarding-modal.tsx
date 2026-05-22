"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "nuncio_onboarding_done";

const TIPS = [
  {
    title: "Paste a social URL",
    description:
      "LinkedIn, Twitter, or any profile link. Nuncio enriches public context to personalise your video.",
  },
  {
    title: "Review before rendering",
    description:
      "Read the generated script, edit it to match your voice, then click render.",
  },
  {
    title: "Share the link",
    description:
      "Send the video link to your recipient. No download needed — it plays right in the browser.",
  },
];

export function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Delay showing so the page renders first
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  }

  function handleNext() {
    if (step < TIPS.length - 1) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
        >
          <div
            className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.25, type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-sm rounded-2xl border border-cream-dark bg-white p-6 shadow-xl"
          >
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5 mb-5">
              {TIPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i === step ? "bg-accent" : "bg-cream-dark"
                  }`}
                />
              ))}
            </div>

            <div className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-ink">
                    {TIPS[step].title}
                  </h2>
                  <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                    {TIPS[step].description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleDismiss}
                  className="text-[11px] uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleNext}
                  className="btn-press rounded-xl bg-ink px-5 py-2.5 text-[11px] uppercase tracking-widest font-medium text-cream hover:bg-ink-light transition-colors"
                >
                  {step < TIPS.length - 1 ? "Next" : "Got it"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
