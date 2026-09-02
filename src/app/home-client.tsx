"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { CardWall } from "@/components/landing/card-wall";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ShowcaseStrip } from "@/components/landing/showcase-strip";
import { VideoProof } from "@/components/landing/video-proof";
import { SHOWCASE_RECIPIENTS, splitShowcase } from "@/lib/showcase";
import { trackViralLanding } from "@/lib/analytics";

const ACCOUNT_FLOW: { id: string; label: string; desc: string }[] = [
  { id: "account", label: "Pick the account", desc: "Start with the person or company you genuinely want to reach." },
  { id: "reason", label: "Make your case", desc: "Give Nuncio the reason this conversation should happen now." },
  { id: "review", label: "Review before sending", desc: "Approve the research, hook, and every word in your name." },
];

export default function HomeClient() {
  const [activeStep, setActiveStep] = useState(0);
  const { left, right } = splitShowcase(SHOWCASE_RECIPIENTS);

  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!detailsOpen) return;
    const t = setTimeout(() => setActiveStep((s) => (s + 1) % ACCOUNT_FLOW.length), 2600);
    return () => clearTimeout(t);
  }, [detailsOpen, activeStep]);

  // Recipient → sender viral loop (STRATEGY S6): capture the share-page ref once.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) trackViralLanding({ ref });
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
          <section className="relative">
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
                    Open the accounts
                    <br />
                    <span className="text-ink-light">that matter most.</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-ink-muted text-body-sm leading-relaxed max-w-[380px]"
                  >
                    For founders and small B2B teams pursuing high-value accounts.
                    Your AI twin researches them, writes the approach, and takes the
                    first meeting live — disclosed as AI, on your playbook, at any hour.
                  </motion.p>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/studio"
                    className="btn-press w-full rounded-2xl px-6 py-4 text-body-sm font-medium bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:shadow-ink/20 hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 flex items-center justify-center gap-2"
                  >
                    Build your twin&apos;s first touch
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </Link>
                  <p className="text-center text-label-base text-ink-faint mt-3">
                    Review every word before it leaves your name
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
                  {ACCOUNT_FLOW.map((step, i) => {
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
                            <svg className="w-3.5 h-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : active ? (
                            <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
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
                <span className="block font-display text-2xl text-ink">100%</span>
                <span className="text-label-sm uppercase tracking-wide sm:tracking-widest text-ink-faint">human reviewed</span>
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
              Nuncio is for the account you would research properly yourself—the
              one where a thoughtful first message can change the relationship.
            </p>
          </section>

          <VideoProof />
          <ShowcaseStrip items={SHOWCASE_RECIPIENTS} />
          <HowItWorks />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
