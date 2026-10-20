"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Face } from "@/components/face";

/**
 * The hero scene.
 *
 * A diagram of a conversation is not a conversation. The landing used to
 * lead with a wireframe — a labelled four-stage illustration of the flow —
 * which for a product whose entire claim is *a face that talks* showed no
 * face at all.
 *
 * This is the product instead: the representative, moving, in the frame the
 * session actually uses, with the disclosure and its first line in the house
 * conversation language (the disclosed AI is the soft accent bubble).
 */
export function RepresentativeScene() {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <div className="relative">
      {/* The frame — the same shape the prospect meets in the session. */}
      <div className="relative overflow-hidden rounded-2xl border border-cream-dark bg-ink shadow-xl shadow-ink/10">
        <div className="relative aspect-[3/2]">
          {reducedMotion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/representative.webp"
              alt="The AI representative a prospect meets"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              src="/representative-loop.mp4"
              autoPlay
              muted
              loop
              playsInline
              aria-label="The AI representative a prospect meets"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {/* A soft scrim so the disclosure below always has something to sit on. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent"
            aria-hidden
          />
        </div>
      </div>

      {/* The disclosure, and the first thing it says. */}
      <div className="mt-4 flex items-start gap-3">
        <Face
          src="/representative.webp"
          name="Alex's AI representative"
          size="sm"
          alt="The AI representative"
        />
        <div className="min-w-0">
          <p className="text-body-xs font-medium text-ink">A disclosed AI representative</p>
          <p className="text-body-xs text-ink-muted mt-1 leading-relaxed">
            It is not Alex &mdash; it stands in for him, and answers only from Alex&rsquo;s notes.
          </p>
        </div>
      </div>

      {/* The AI's voice, in the house language: accent-soft, always. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 max-w-[85%] rounded-2xl border border-accent/20 bg-accent-soft/60 px-4 py-2.5"
      >
        <p className="text-label-sm uppercase tracking-widest opacity-60 mb-0.5">
          Alex&rsquo;s AI representative
        </p>
        <p className="text-body-sm leading-relaxed text-ink">
          I&rsquo;m Alex&rsquo;s AI representative — I can answer from his playbook, or you can
          ask for Alex himself on this link.
        </p>
      </motion.div>
    </div>
  );
}
