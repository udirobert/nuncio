"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { LottieIcon } from "@/components/lottie-icon";
import { representativeDisclosure, type RepresentativeKind } from "@/lib/representative";

interface Turn {
  who: "prospect" | "representative";
  text: string;
}

interface RepresentativeExampleProps {
  kind: RepresentativeKind;
  senderName?: string;
  representativeName?: string;
  /** The representative's face, when there is one. */
  imageUrl?: string | null;
}

/**
 * What a conversation actually looks like.
 *
 * An avatar app that shows no example of the conversation is an avatar app
 * that feels barren: the user can read about the product but cannot picture
 * the moment it happens. This is a scripted exchange, labelled as an
 * illustration, in the same visual language as the real thing.
 *
 * The lines are written so they are true of the product: the representative
 * answers from the playbook, refuses what the playbook refuses, discloses
 * what it is, and offers the human.
 */
const TURNS: Turn[] = [
  {
    who: "prospect",
    text: "I saw you work on handoffs. How does that actually help a team like mine?",
  },
  {
    who: "representative",
    text: "We map your handoffs and show where work gets stuck — then fix the worst one first. It usually takes a week, and we don't rip anything out and replace it.",
  },
  {
    who: "prospect",
    text: "What does that cost?",
  },
  {
    who: "representative",
    text: "I don't quote pricing — that's the one thing I leave to them. I can tell you what a pilot usually involves, or put you in touch with them directly.",
  },
  {
    who: "prospect",
    text: "Let's talk to them.",
  },
  {
    who: "representative",
    text: "Done — I've let them know you'd like to talk. You can also pick a time here if that's easier.",
  },
];

export function RepresentativeExample({
  kind,
  senderName,
  representativeName,
  imageUrl,
}: RepresentativeExampleProps) {
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);

  const disclosure = representativeDisclosure({
    kind,
    senderName: senderName ?? "",
    representativeName: kind === "persona" ? representativeName : "",
  });

  // Completion is derived, not stored — so the effect never has to set state
  // synchronously (and never cascades a render).
  const isComplete = revealed >= TURNS.length;

  useEffect(() => {
    if (!playing || isComplete) return;
    const timer = setTimeout(() => setRevealed((n) => n + 1), reducedMotion ? 120 : 1100);
    return () => clearTimeout(timer);
  }, [playing, revealed, reducedMotion, isComplete]);

  function replay() {
    setRevealed(0);
    setPlaying(true);
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/70 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label-xs uppercase tracking-widest text-ink-faint font-medium">
          Illustrative conversation · not a live session
        </p>
        <button
          type="button"
          onClick={replay}
          className="text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
        >
          {isComplete ? "Replay" : "Play"}
        </button>
      </div>

      {/* Who is speaking — the same disclosure the prospect reads. */}
      <div className="flex items-start gap-3 rounded-xl border border-cream-dark bg-cream/40 p-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="The AI representative"
            className="w-10 h-10 rounded-lg object-cover border border-cream-dark bg-white shrink-0"
          />
        ) : (
          <span className="w-10 h-10 rounded-lg bg-cream-dark/60 border border-cream-dark flex items-center justify-center text-ink-faint shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="9" r="3.5" />
              <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
            </svg>
          </span>
        )}
        <p className="text-body-xs text-ink-muted leading-relaxed">{disclosure}</p>
      </div>

      {/* The exchange. */}
      <div className="space-y-2.5" role="log" aria-live="polite">
        <AnimatePresence initial={false}>
          {TURNS.slice(0, revealed).map((turn, i) => (
            <motion.div
              key={`${turn.who}-${i}`}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${turn.who === "representative" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body-xs leading-relaxed ${
                  turn.who === "representative"
                    ? "bg-ink text-cream"
                    : "bg-cream/70 text-ink border border-cream-dark"
                }`}
              >
                {turn.who === "representative" && (
                  <span className="block text-label-xs uppercase tracking-widest opacity-60 mb-1">
                    {representativeName || "AI representative"}
                  </span>
                )}
                {turn.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {playing && revealed < TURNS.length && (
          <div className="flex items-center gap-1.5 pl-1" aria-hidden>
            <LottieIcon name="spinner" className="w-3 h-3" />
            <span className="text-label-base text-ink-faint">typing…</span>
          </div>
        )}

        {revealed === 0 && !playing && (
          <button
            type="button"
            onClick={replay}
            className="w-full rounded-xl border border-dashed border-cream-dark py-6 text-body-xs text-ink-faint hover:text-ink hover:border-ink-faint/40 transition-colors"
          >
            See what a conversation looks like
          </button>
        )}
      </div>
    </div>
  );
}
