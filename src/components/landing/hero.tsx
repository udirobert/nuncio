"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { SHOWCASE_RECIPIENTS, splitShowcase } from "@/lib/showcase";
import { CardWall } from "./card-wall";

interface HeroProps {
  /** The conversion path — UrlForm slots in here. */
  children: ReactNode;
}

/**
 * Above-the-fold landing hero.
 *
 * Desktop (≥ lg): three-column composition — drifting card wall on the
 * left, the centred form, drifting card wall on the right. The walls
 * scroll in opposite directions at slightly different speeds to create
 * a sense of depth without WebGL.
 *
 * Mobile / tablet: cards collapse out; the form takes the full width.
 * The horizontal ShowcaseStrip below the hero replaces the wall on
 * mobile (rendered separately by the page).
 */
export function Hero({ children }: HeroProps) {
  const { left, right } = splitShowcase(SHOWCASE_RECIPIENTS);

  return (
    <section className="relative flex items-stretch">
      {/* Cream wash radial spotlight behind the form */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.7) 0%, rgba(250,249,246,0) 55%)",
        }}
      />

      <div className="relative w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(540px,640px)_minmax(0,1fr)] gap-0">
        {/* Left card wall — desktop only */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block px-4 py-12"
        >
          <CardWall items={left} direction="up" durationSec={75} />
        </motion.aside>

        {/* Centre stage — the form. Anchored toward the top so the URL
            input stays above the fold on shorter viewports. */}
        <div className="relative flex items-start justify-center pt-16 lg:pt-20 pb-8">
          {children}
        </div>

        {/* Right card wall — desktop only, opposite direction & slightly faster */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block px-4 py-12"
        >
          <CardWall items={right} direction="down" durationSec={65} />
        </motion.aside>
      </div>
    </section>
  );
}
