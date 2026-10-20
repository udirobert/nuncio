"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  APP_ROUTES,
  GETTING_STARTED_STEPS,
  PRODUCT_EXPLAINER,
  PRODUCT_ONELINER,
} from "@/lib/navigation";
import {
  ONBOARDING_OPEN_EVENT,
  hasSeenOnboarding,
  markOnboardingDone,
} from "@/lib/onboarding";

/**
 * The tour auto-opens only on member surfaces, and only for signed-in
 * members — an anonymous explorer has nothing to set up yet, so a tour that
 * sells a page behind the login wall is noise.
 */
const AUTO_OPEN_PATHS = new Set<string>([
  APP_ROUTES.inbox,
  APP_ROUTES.representative,
  APP_ROUTES.create,
]);

interface Panel {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

/**
 * The tour answers one question first — "what is this app?" — and only then
 * walks through the three steps. Previously it opened with "Set up your
 * representative" and "create a first touch", which assumes the user already
 * knows what they are being set up for.
 */
const PANELS: Panel[] = [
  {
    title: "What nuncio does",
    body: PRODUCT_ONELINER,
  },
  {
    title: "1. Set up your representative",
    body:
      "Tell nuncio who it speaks for and what it may promise: your offer, your wiggle room, and the lines it must never cross. It reads from this every time it replies.",
    href: APP_ROUTES.representative,
    linkLabel: "Set up your representative",
  },
  {
    title: "2. Create a first touch",
    body:
      "Paste a prospect's profile. nuncio researches them, drafts the opening, and you approve it. You get a link — that link is the front door.",
    href: APP_ROUTES.create,
    linkLabel: "Create a first touch",
  },
  {
    title: "3. They choose how to continue",
    body:
      "On your link, the prospect can talk to your AI representative, ask for you live, or pick a time. Human calls only happen when you accept them.",
  },
];

export function OnboardingModal() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  const open = useCallback((atStep = 0) => {
    setStep(atStep);
    setShow(true);
  }, []);

  const dismiss = useCallback(() => {
    markOnboardingDone();
    setShow(false);
  }, []);

  useEffect(() => {
    if (!AUTO_OPEN_PATHS.has(pathname)) return;
    if (hasSeenOnboarding()) return;
    let cancelled = false;
    // Delay showing so the page renders first.
    const timer = setTimeout(() => {
      fetch("/api/account/session")
        .then((r) => r.json())
        .then((s) => {
          if (!cancelled && s?.authenticated) open(0);
        })
        .catch(() => {});
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, pathname]);

  // "Show tips" in the account menu re-opens the tour wherever you are.
  useEffect(() => {
    function handleOpen() {
      open(0);
    }
    window.addEventListener(ONBOARDING_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(ONBOARDING_OPEN_EVENT, handleOpen);
  }, [open]);

  function handleNext() {
    if (step < PANELS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
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
            onClick={dismiss}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Getting started with nuncio"
            className="relative w-full max-w-sm rounded-2xl border border-cream-dark bg-white p-6 shadow-xl"
          >
            <motion.button
              onClick={dismiss}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </motion.button>

            <div className="flex items-center gap-1.5 mb-5">
              {PANELS.map((_, i) => (
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
                    {PANELS[step].title}
                  </h2>
                  <p className="text-body-sm text-ink-muted mt-2 leading-relaxed">
                    {PANELS[step].body}
                  </p>

                  {step === 0 && (
                    <>
                      <p className="text-body-xs text-ink-faint mt-3 leading-relaxed">
                        {PRODUCT_EXPLAINER}
                      </p>
                      <ol className="mt-4 space-y-2">
                        {GETTING_STARTED_STEPS.map((s, i) => (
                          <li key={s.label} className="flex items-start gap-2.5">
                            <span
                              aria-hidden
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-label-xs font-medium"
                            >
                              {i + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-body-xs font-medium text-ink">
                                {s.label}
                              </span>
                              <span className="block text-label-base text-ink-faint">
                                {s.desc}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}

                  {PANELS[step].href && (
                    <Link
                      href={PANELS[step].href!}
                      onClick={dismiss}
                      className="inline-block mt-3 text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
                    >
                      {PANELS[step].linkLabel} →
                    </Link>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <motion.button
                  onClick={dismiss}
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
                  {step < PANELS.length - 1 ? "Next" : "Got it"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
