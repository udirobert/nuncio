"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { LottieIcon } from "@/components/lottie-icon";
import { Face } from "@/components/face";
import {
  representativeDisclosure,
  representativeHeadline,
  type RepresentativeKind,
} from "@/lib/representative";

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
  /** A short clip of the representative, for the moving face. */
  videoUrl?: string | null;
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

/**
 * The house conversation language, from `RelationshipJourney`:
 * the disclosed AI is the soft accent bubble on the left, the human is the
 * ink bubble on the right. Colour *is* the disclosure — an AI must never be
 * drawn like a person, and the human side must never be drawn like the AI.
 */
const BUBBLE = {
  prospect: "bg-ink text-cream ml-auto",
  representative: "bg-accent-soft/60 border border-accent/20 text-ink",
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export function RepresentativeExample({
  kind,
  senderName,
  representativeName,
  imageUrl,
  videoUrl,
}: RepresentativeExampleProps) {
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);

  const disclosure = representativeDisclosure({
    kind,
    senderName: senderName ?? "",
    representativeName: kind === "persona" ? representativeName : "",
  });
  const headline = representativeHeadline({
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
          className="text-label-xs uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors inline-flex items-center min-h-[44px]"
        >
          {isComplete ? "Replay" : "Play"}
        </button>
      </div>

      {/* Who is speaking — the same disclosure the prospect reads. */}
      <div className="flex items-start gap-3 rounded-xl border border-cream-dark bg-cream/60 p-3">
        <Face
          src={imageUrl}
          videoUrl={videoUrl}
          live={Boolean(videoUrl)}
          name={representativeName || senderName}
          size="sm"
          alt="The AI representative"
        />
        <div className="min-w-0">
          <p className="text-body-xs font-medium text-ink">{headline}</p>
          <p className="text-body-xs text-ink-muted mt-1 leading-relaxed">{disclosure}</p>
        </div>
      </div>

      {/* The exchange. */}
      <div className="space-y-2.5" role="log" aria-live="polite">
        <AnimatePresence initial={false}>
          {TURNS.slice(0, revealed).map((turn, i) => (
            <motion.div
              key={`${turn.who}-${i}`}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={`flex ${turn.who === "representative" ? "justify-start" : "justify-end"}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${BUBBLE[turn.who]}`}>
                {turn.who === "representative" && (
                  <p className="text-label-sm uppercase tracking-widest opacity-60 mb-0.5">
                    {representativeName || "AI representative"}
                  </p>
                )}
                <p className="text-body-sm leading-relaxed">{turn.text}</p>
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
            className="w-full rounded-2xl border border-dashed border-cream-dark py-6 text-body-xs text-ink-faint hover:text-ink hover:border-ink-faint/40 transition-colors"
          >
            See what a conversation looks like
          </button>
        )}
      </div>
    </div>
  );
}
