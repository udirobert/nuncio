"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";

const STORAGE_KEY = "nuncio_onboarding_done_v2";

const TIPS: { title: string; description: string; href?: string; linkLabel?: string }[] = [
  {
    title: "Set up your representative",
    description:
      "In Setup, tell Nuncio who your AI representative speaks for and set its playbook boundaries — what it offers, what it must never promise. Do that before you create any link.",
    href: "/dashboard?view=setup",
    linkLabel: "Open setup",
  },
  {
    title: "Create a first touch",
    description:
      "In the studio, paste a profile and approve the opening message. The link you share is the prospect's front door — the SDR opens the relationship, the twin keeps it warm.",
  },
  {
    title: "The recipient chooses",
    description:
      "On your link they can ask your disclosed AI representative, request you live, or choose a time if you add a scheduling link. Human calls need your acceptance; AI conversations start only when the prospect chooses them.",
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
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm rounded-2xl border border-cream-dark bg-white p-6 shadow-xl"
          >            <motion.button
                  onClick={handleDismiss}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors"
                  aria-label="Close"
                >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>                </motion.button>

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
                  <h2 className="font-display text-xl text-ink">
                    {TIPS[step].title}
                  </h2>
                  <p className="text-body-sm text-ink-muted mt-2 leading-relaxed">
                    {TIPS[step].description}
                  </p>
                  {TIPS[step].href && (
                    <Link
                      href={TIPS[step].href!}
                      onClick={handleDismiss}
                      className="inline-block mt-3 text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
                    >
                      {TIPS[step].linkLabel} →
                    </Link>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <motion.button
                  onClick={handleDismiss}
                  whileHover={{ x: -2 }}
                  className="text-label-base uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
                >
                  Skip
                </motion.button>
                <motion.button
                  onClick={handleNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl bg-ink px-5 py-2.5 text-label-base uppercase tracking-widest font-medium text-cream hover:bg-ink-light transition-colors"
                >
                  {step < TIPS.length - 1 ? "Next" : "Got it"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
