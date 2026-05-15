"use client";

import { motion } from "motion/react";
import type { ShowcaseRecipient } from "@/lib/showcase";
import { RecipientCard } from "./recipient-card";

interface ShowcaseStripProps {
  items: ShowcaseRecipient[];
}

/**
 * Horizontal scroll-snap strip of recipient cards. Used as the
 * mobile equivalent of the desktop card-wall — surfaces the same
 * proof points without burning GPU on a phone.
 */
export function ShowcaseStrip({ items }: ShowcaseStripProps) {
  return (
    <section className="md:hidden border-t border-cream-dark/60 py-10">
      <div className="px-6 mb-4 flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Recent nuncios
        </p>
        <span className="text-[11px] text-ink-faint/70">Swipe →</span>
      </div>
      <motion.div
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
      </motion.div>
    </section>
  );
}
