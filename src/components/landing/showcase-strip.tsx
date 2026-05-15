"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseRecipient } from "@/lib/showcase";
import { RecipientCard } from "./recipient-card";

interface ShowcaseStripProps {
  items: ShowcaseRecipient[];
}

/**
 * Horizontal scroll-snap strip of recipient cards. Used as the
 * mobile equivalent of the desktop card-wall — surfaces the same
 * proof points without burning GPU on a phone.
 *
 * Affordances:
 * - Right-edge cream gradient hints at more cards beyond the fold;
 *   it fades out as the user scrolls.
 * - "Swipe →" label gently pulses on first render, then settles, and
 *   disappears once the user has actually scrolled.
 */
export function ShowcaseStrip({ items }: ShowcaseStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function onScroll() {
      if (el && el.scrollLeft > 24) setHasScrolled(true);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="md:hidden border-t border-cream-dark/60 py-6">
      <div className="px-6 mb-4 flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Recent nuncios
        </p>
        <motion.span
          animate={hasScrolled ? { opacity: 0 } : { opacity: [0.5, 1, 0.5] }}
          transition={
            hasScrolled
              ? { duration: 0.3 }
              : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
          }
          className="text-[11px] text-ink-faint/80"
        >
          Swipe →
        </motion.span>
      </div>

      <div className="relative">
        <motion.div
          ref={scrollerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex gap-3 px-6 overflow-x-auto snap-x snap-mandatory pb-2"
          style={{
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="snap-start shrink-0 w-[78%] max-w-[320px]"
            >
              <RecipientCard item={item} size="md" />
            </div>
          ))}
          {/* Trailing spacer keeps the last card centred when snapped */}
          <div className="shrink-0 w-2" aria-hidden />
        </motion.div>

        {/* Right-edge fade — hints at more content; fades out once scrolled */}
        <motion.div
          aria-hidden
          animate={{ opacity: hasScrolled ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute top-0 right-0 bottom-0 w-12"
          style={{
            background:
              "linear-gradient(to left, var(--color-cream) 0%, transparent 100%)",
          }}
        />
      </div>
    </section>
  );
}
