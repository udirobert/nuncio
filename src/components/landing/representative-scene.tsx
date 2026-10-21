"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Face } from "@/components/face";

/**
 * The hero: the prospect's actual screen.
 *
 * A diagram of a conversation is not a conversation, and a screenshot of one
 * is a picture of a conversation. This is the *thing* — the frame the
 * session uses, the representative moving in it, the exchange in the house
 * conversation language, and the three ways the recipient can continue —
 * rendered as live components rather than described.
 *
 * The exchange plays once when it comes into view, so the page opens
 * mid-conversation instead of on an empty frame.
 */
const EXCHANGE: { who: "prospect" | "representative"; text: string }[] = [
  {
    who: "prospect",
    text: "We keep losing handoffs between support and onboarding. Does this actually help?",
  },
  {
    who: "representative",
    text: "We map your handoffs and show you where work gets stuck, then fix the worst one first. It usually takes a week, and nothing gets ripped out and replaced.",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function RepresentativeScene() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(reducedMotion ? EXCHANGE.length : 0);
  const [started, setStarted] = useState(false);

  // Play the exchange once, when the scene is actually on screen.
  useEffect(() => {
    if (started || reducedMotion) return;
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [started, reducedMotion]);

  useEffect(() => {
    if (!started || revealed >= EXCHANGE.length) return;
    const timer = setTimeout(() => setRevealed((n) => n + 1), reducedMotion ? 120 : 900);
    return () => clearTimeout(timer);
  }, [started, revealed, reducedMotion]);

  return (
    <div
      ref={rootRef}
      className="rounded-2xl border border-cream-dark bg-white p-4 sm:p-5 shadow-xl shadow-ink/5 space-y-3.5"
    >
      {/* The header the prospect actually sees. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-label-xs uppercase tracking-widest text-ink-faint font-medium">
          Conversation link
        </p>
        <div className="flex items-center gap-1.5 rounded-full border border-cream-dark bg-cream/60 py-1 pl-1 pr-2.5">
          <Face src="/representative.webp" name="Alex Rivera" size="xs" alt="" />
          <span className="text-label-xs text-ink font-medium leading-none">Alex Rivera</span>
          <span className="text-label-xs text-ink-faint leading-none">·</span>
          <span className="rounded border border-ink-faint/40 px-1 text-label-xs font-semibold text-ink-faint leading-none">
            AI
          </span>
        </div>
      </div>

      <p className="font-display text-2xl sm:text-3xl tracking-tight leading-[0.95] -mt-1">
        A conversation with Alex Rivera
      </p>

      {/* The frame the session uses. */}
      <div className="relative overflow-hidden rounded-xl border border-cream-dark bg-ink">
        <div className="relative aspect-video">
          {reducedMotion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/representative.webp"
              alt="The AI representative a prospect meets"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <video
              src="/representative-loop.mp4"
              autoPlay
              muted
              loop
              playsInline
              aria-label="The AI representative a prospect meets"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent"
            aria-hidden
          />
        </div>
      </div>

      {/* The exchange, in the house language: the human is ink, the AI is accent. */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {EXCHANGE.slice(0, revealed).map((turn, i) => (
            <motion.div
              key={turn.who + i}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={`flex ${turn.who === "representative" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  turn.who === "representative"
                    ? "bg-accent-soft/60 border border-accent/20 text-ink"
                    : "bg-ink text-cream ml-auto"
                }`}
              >
                {turn.who === "representative" && (
                  <p className="text-label-sm uppercase tracking-widest opacity-60 mb-0.5">
                    Alex&rsquo;s AI representative
                  </p>
                )}
                <p className="text-body-sm leading-relaxed">{turn.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* The three ways the recipient continues — the real choices. */}
      <div className="space-y-2 pt-1">
        <p className="text-label-xs uppercase tracking-widest text-ink-faint font-medium">
          Choose how to continue
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-xl bg-accent px-3.5 py-2 text-body-xs font-medium text-white">
            Ask the AI representative
          </span>
          <span className="rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-body-xs font-medium text-ink-muted">
            Request Alex Rivera
          </span>
          <span className="rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-body-xs font-medium text-ink-muted">
            Choose a time
          </span>
        </div>
        <p className="text-label-base text-ink-faint pt-0.5">
          A disclosed AI representative. It is not Alex — it stands in for him, and answers
          only from Alex&rsquo;s notes.
        </p>
      </div>
    </div>
  );
}
