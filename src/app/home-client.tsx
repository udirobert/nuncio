"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { AmbientCanvas } from "@/components/landing/ambient-canvas";
import { CardWall } from "@/components/landing/card-wall";
import { LottieIcon } from "@/components/lottie-icon";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ShowcaseStrip } from "@/components/landing/showcase-strip";
import { VideoProof } from "@/components/landing/video-proof";
import { RelationshipJourney } from "@/components/landing/relationship-journey";
import { SHOWCASE_RECIPIENTS, splitShowcase } from "@/lib/showcase";
import { trackViralLanding } from "@/lib/analytics";

const RECONNECT_FLOW: { id: string; label: string; desc: string }[] = [
  { id: "friend", label: "Pick the friend", desc: "Start with someone you actually want to hear from again." },
  { id: "memory", label: "Add your memory", desc: "Share one real detail only you would say. AI does the rest, but it never sends without you." },
  { id: "review", label: "Review before sending", desc: "Read the script, hear it in your voice, and send only when it sounds like you." },
];

export default function HomeClient() {
  const reducedMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const { left, right } = splitShowcase(SHOWCASE_RECIPIENTS);
  const [mode, setMode] = useState<"outreach" | "reconnect">("outreach");

  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!detailsOpen) return;
    const t = setTimeout(() => setActiveStep((s) => (s + 1) % RECONNECT_FLOW.length), 2600);
    return () => clearTimeout(t);
  }, [detailsOpen, activeStep]);

  // Recipient → sender viral loop (STRATEGY S6): capture the share-page ref once.
  // Also detect ?mode=reconnect for a soft consumer experiment without changing the default.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const modeParam = params.get("mode") === "reconnect" ? "reconnect" : "outreach";
    if (ref) trackViralLanding({ ref, mode: modeParam });
    // Sync external URL state into React state for the landing-page experiment.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("mode") === "reconnect") setMode("reconnect");
  }, []);

  return (
    <>
      <Header />

      <AnimatePresence mode="wait">
        <motion.div
          key="input"
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 flex flex-col"
        >
          {mode === "reconnect" ? (
            <section className="relative overflow-hidden">
              <AmbientCanvas />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.7) 0%, rgba(250,249,246,0) 55%)",
                }}
              />

              {/* Drifting recipient card walls — desktop only, ambient depth */}
              <motion.aside
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:block absolute inset-y-0 left-0 px-4 py-12 overflow-hidden"
                style={{ width: "calc((100% - 640px) / 2)" }}
              >
                <CardWall items={left} direction="up" durationSec={75} />
              </motion.aside>
              <motion.aside
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:block absolute inset-y-0 right-0 px-4 py-12 overflow-hidden"
                style={{ width: "calc((100% - 640px) / 2)" }}
              >
                <CardWall items={right} direction="down" durationSec={65} />
              </motion.aside>

              <div className="relative mx-auto flex w-full max-w-[640px] items-start justify-center pt-16 lg:pt-20 pb-12 lg:pb-16 px-6">
                <div className="w-full max-w-[540px]">
                  <div className="mb-8 lg:mb-10">
                    <motion.h1
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-3"
                    >
                      Send a video
                      <br />
                      <span className="text-ink-light">to someone you miss.</span>
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="text-ink-muted text-body-sm leading-relaxed max-w-[380px]"
                    >
                      Paste their public profile, add a memory only you would share, and we&apos;ll help you turn it into a short, warm video. You review every word before it sends.
                    </motion.p>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Link
                      href="/studio?mode=reconnect"
                      className="btn-press w-full rounded-2xl px-6 py-4 text-body-sm font-medium bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:shadow-ink/20 hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 flex items-center justify-center gap-2"
                    >
                      Create a reconnection card
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                    </Link>
                    <p className="text-center text-label-base text-ink-faint mt-3">
                      AI-assisted, but you approve every word
                    </p>
                  </motion.div>

                  {/* Account flow — collapsible on mobile to reduce scroll length */}
                  <details
                    open={detailsOpen}
                    onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
                    className="mt-10 sm:mt-10 group"
                  >
                    <summary className="flex items-center gap-2 cursor-pointer list-none text-label-base text-ink-muted hover:text-ink transition-colors">
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      How it works
                    </summary>
                    <div className="mt-3 space-y-2">
                      {RECONNECT_FLOW.map((step, i) => {
                        const active = activeStep === i;
                        const complete = activeStep > i;
                        return (
                          <div
                            key={step.id}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-[background-color,border-color,opacity,box-shadow] duration-700 ${
                              active
                                ? "border-accent/20 bg-accent-soft shadow-sm"
                                : complete
                                  ? "border-cream-dark bg-cream-soft"
                                  : "border-cream-dark bg-white opacity-40"
                            }`}
                          >
                            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-label-sm font-mono transition-colors duration-700">
                              {complete ? (
                                <LottieIcon name="success-check" className="w-4 h-4" loop={false} autoplay={true} />
                              ) : active ? (
                                <LottieIcon name="spinner" className="w-4 h-4" />
                              ) : (
                                <span className="text-ink-faint">{i + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-body-xs font-medium transition-colors ${
                                  active ? "text-accent" : complete ? "text-ink" : "text-ink-muted"
                                }`}>
                                  {step.label}
                                </span>
                              </div>
                              <p className={`text-label-base mt-px transition-colors ${
                                active || complete ? "text-ink-muted" : "text-ink-faint"
                              }`}>
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>
            </section>
          ) : (
            <section className="px-6 pt-28 lg:pt-32 pb-12 scroll-mt-20">
              <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-5">
                  <motion.p
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-4"
                  >
                    Founder-led conversations · disclosed AI
                  </motion.p>
                  <motion.h1
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-4"
                  >
                    Start the conversation.
                    <br />
                    <span className="text-ink-light">Join when it matters.</span>
                  </motion.h1>
                  <motion.p
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-ink-muted text-body-sm leading-relaxed max-w-[420px] mb-6"
                  >
                    Your SDR opens the relationship. Your disclosed AI representative answers from your playbook.
                    Prospects can request you—and you decide when to join.
                  </motion.p>
                  <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: 0.3 }}
                    className="space-y-3"
                  >
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href="/dashboard?view=setup"
                        className="btn-press rounded-xl bg-ink text-cream px-6 py-3.5 text-body-sm font-medium shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 min-h-[44px] inline-flex items-center gap-2"
                      >
                        Set up your representative
                        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 8h10M9 4l4 4-4 4" />
                        </svg>
                      </Link>
                      <a
                        href="#prospect-experience"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById("prospect-experience")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
                        }}
                        className="btn-press rounded-xl border border-ink/15 text-ink px-6 py-3.5 text-body-sm font-medium hover:bg-white transition-colors min-h-[44px] inline-flex items-center"
                      >
                        See the prospect experience
                      </a>
                    </div>
                    <p className="text-label-base text-ink-faint">
                      Approve the opening. Set the boundaries for live answers.
                    </p>
                    <Link
                      href="/studio"
                      className="inline-block text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
                    >
                      Create a first touch →
                    </Link>
                  </motion.div>
                </div>
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="lg:col-span-7"
                >
                  <RelationshipJourney />
                </motion.div>
              </div>
            </section>
          )}

          <section className="px-6 py-8 max-w-[540px] mx-auto" data-reveal-group>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <div
                data-reveal-item
                data-reveal="scale"
                className="text-center"
              >
                <span className="block font-display text-2xl text-ink">1</span>
                <span className="text-label-sm uppercase tracking-wide sm:tracking-widest text-ink-faint">person at a time</span>
              </div>
              <div className="w-px h-8 bg-cream-dark hidden sm:block" />
              <div
                data-reveal-item
                data-reveal="scale"
                className="text-center"
              >
                <span className="block font-display text-2xl text-ink">Sender-approved</span>
                <span className="text-label-sm uppercase tracking-wide sm:tracking-widest text-ink-faint">opening</span>
              </div>
              <div className="w-px h-8 bg-cream-dark hidden sm:block" />
              <div
                data-reveal-item
                data-reveal="scale"
                className="text-center"
              >
                <span className="block font-display text-2xl text-ink">1</span>
                <span className="text-label-sm uppercase tracking-wide sm:tracking-widest text-ink-faint">clear reason to reach out</span>
              </div>
            </div>
            <p data-reveal="fade-up" className="text-center text-body-xs text-ink-muted mt-5 max-w-[390px] mx-auto leading-relaxed">
              Nuncio is for the one person you&apos;d write to yourself — the message that only works if it actually sounds like you.
            </p>
          </section>

          <VideoProof />
          <details className="max-w-6xl mx-auto w-full" data-reveal="fade-up">
            <summary className="px-6 py-4 cursor-pointer list-none text-center text-label-sm uppercase tracking-widest text-ink-faint font-medium hover:text-ink transition-colors">
              Examples of considered first touches
            </summary>
            <ShowcaseStrip items={SHOWCASE_RECIPIENTS} />
          </details>
          <HowItWorks />

          <section className="px-6 py-16 text-center">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">
              {mode === "reconnect" ? "Send a reconnection card" : "Set up your representative"}
            </h2>
            <p className="text-body-sm text-ink-muted mb-6">
              {mode === "reconnect"
                ? "AI-assisted, but you approve every word."
                : "Approve the opening. Set the boundaries for live answers."}
            </p>
            <Link
              href={mode === "reconnect" ? "/studio?mode=reconnect" : "/dashboard?view=setup"}
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-6 py-3.5 text-body-sm font-medium shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 min-h-[44px]"
            >
              {mode === "reconnect" ? "Create a reconnection card" : "Set up your representative"}
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </section>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
