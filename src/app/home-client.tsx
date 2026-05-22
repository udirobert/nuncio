"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Header } from "@/components/header";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ShowcaseStrip } from "@/components/landing/showcase-strip";
import { VideoProof } from "@/components/landing/video-proof";
import { SHOWCASE_RECIPIENTS } from "@/lib/showcase";

export default function HomeClient() {
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
            <div className="relative mx-auto flex w-full max-w-[640px] items-start justify-center pt-16 lg:pt-20 pb-12 lg:pb-16 px-6">
              <div className="w-full max-w-[540px]">
                <div className="mb-8 lg:mb-10">
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="font-[family-name:var(--font-display)] text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-3"
                  >
                    Send a video
                    <br />
                    <span className="italic">they&apos;ll actually watch</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-ink-muted text-[14px] leading-relaxed max-w-[380px]"
                  >
                    Paste their profile. We&apos;ll research them, write a personalised
                    script, and build a creative canvas — in ~5 minutes.
                  </motion.p>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/studio"
                    className="btn-press w-full rounded-2xl px-6 py-4 text-sm font-medium bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:shadow-ink/20 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    Build a video
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </Link>
                  <p className="text-center text-[11px] text-ink-faint mt-3">
                    No account needed · ~5 minutes
                  </p>
                </motion.div>
              </div>
            </div>
          </section>
          <VideoProof />
          <ShowcaseStrip items={SHOWCASE_RECIPIENTS} />
          <HowItWorks />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
