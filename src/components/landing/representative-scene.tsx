"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Face } from "@/components/face";

/**
 * The hero: the prospect's actual screen, with the faces you can flick through.
 *
 * A diagram of a conversation is not a conversation, and a screenshot of one
 * is a picture of a conversation. This is the *thing* — the frame the session
 * uses, the representative moving in it, the exchange in the house
 * conversation language, and the three ways the recipient can continue.
 *
 * The deck on the frame is not a gallery. It is the product's one idea: a
 * representative has a face, and there are exactly two honest ways to get
 * one — the sender's own photo, or a disclosed persona that stands in for
 * them. Flicking the deck changes the face, the name and the disclosure
 * together, because that is what a sender is actually choosing.
 */
interface FaceOption {
  id: string;
  name: string;
  /** What this option is, in a few words. */
  role: string;
  image?: string;
  video?: string;
  /** "self" uses the sender's photo; "persona" stands in for them. */
  kind: "self" | "persona";
  /** What the representative says when it introduces itself. */
  line: string;
  /** The disclosure the prospect reads. */
  disclosure: string;
}

const FACES: FaceOption[] = [
  {
    id: "gabriel",
    name: "Gabriel",
    role: "The default persona",
    image: "/representative.webp",
    video: "/representative-loop.mp4",
    kind: "persona",
    line: "I’m Alex’s AI representative — I’m not Alex, I stand in for him, and I answer from his notes.",
    disclosure:
      "A disclosed AI representative. It is not Alex — it stands in for him, and answers only from Alex’s notes.",
  },
  {
    id: "mia",
    name: "Mia",
    role: "Another persona from the library",
    image: "/representative-mia.webp",
    video: "/representative-mia-loop.mp4",
    kind: "persona",
    line: "I’m Alex’s AI representative — I’m not Alex, I stand in for him, and I answer from his notes.",
    disclosure:
      "A disclosed AI representative. It is not Alex — it stands in for him, and answers only from Alex’s notes.",
  },
  {
    id: "you",
    name: "Your photo",
    role: "Your own face, disclosed",
    kind: "self",
    line: "I’m Alex’s AI representative — this is Alex’s photo, and I answer from his notes.",
    disclosure:
      "An AI representative that uses Alex’s photo. It answers only from Alex’s notes, and the prospect is told it is his face.",
  },
];

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

/** The disclosure the prospect reads. Shared with the hero's caption. */
export const SCENE_DISCLOSURE =
  "A disclosed AI representative. It is not Alex \u2014 it stands in for him, and answers only from Alex\u2019s notes.";

export function RepresentativeScene({
  compact = false,
}: {
  /** Mobile: frame, deck and disclosure only — the face above the fold. */
  compact?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(reducedMotion ? EXCHANGE.length : 0);
  const [started, setStarted] = useState(false);

  const face = FACES[index];

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

  // Changing the face replays the exchange — the representative is a different
  // person saying the same thing.
  function select(next: number) {
    if (next === index) return;
    setIndex(next);
    setRevealed(reducedMotion ? EXCHANGE.length : 0);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    select((index + delta + FACES.length) % FACES.length);
  }

  return (
    <div
      ref={rootRef}
      className={`rounded-2xl border border-cream-dark bg-white shadow-xl shadow-ink/5 space-y-3 ${compact ? "p-3" : "p-4 sm:p-5"}`}
    >
      {/* The header the prospect actually sees. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-label-xs uppercase tracking-widest text-ink-faint font-medium">
          Conversation link
        </p>
        <div className="flex items-center gap-1.5 rounded-full border border-cream-dark bg-cream/60 py-1 pl-1 pr-2.5">
          <Face src={face.image} name={face.kind === "self" ? "Alex Rivera" : face.name} size="xs" alt="" />
          <span className="text-label-xs text-ink font-medium leading-none">Alex Rivera</span>
          <span className="text-label-xs text-ink-faint leading-none">·</span>
          <span className="rounded border border-ink-faint/40 px-1 text-label-xs font-semibold text-ink-faint leading-none">
            AI
          </span>
        </div>
      </div>

      {!compact && (
        <p className="font-display text-2xl sm:text-3xl tracking-tight leading-[0.95] -mt-1">
          A conversation with Alex Rivera
        </p>
      )}

      {/* The frame the session uses. */}
      <div className="relative overflow-hidden rounded-xl border border-cream-dark bg-ink">
        <div className="relative aspect-video">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={face.id}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute inset-0"
            >
              {face.video ? (
                <video
                  key={face.video}
                  src={face.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-label={`${face.name}, the AI representative`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : face.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={face.image}
                  alt={`${face.name}, the AI representative`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cream-soft px-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-ink-faint/60 text-ink-muted">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="9" r="3.5" />
                      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
                    </svg>
                  </span>
                  <p className="text-body-xs text-ink-muted max-w-[240px] leading-relaxed">
                    Alex&rsquo;s photo goes here &mdash; the representative then answers in
                    his face, and says so.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {(face.video || face.image) && (
            <div
              className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent"
              aria-hidden
            />
          )}
        </div>
      </div>

      {/* The deck — stacked, and the product's one idea in three cards. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <div
          role="tablist"
          aria-label="Faces a representative can wear"
          onKeyDown={onKeyDown}
          className="flex items-center -space-x-2"
        >
          {FACES.map((option, i) => {
            const selected = i === index;
            return (
              <button
                key={option.id}
                role="tab"
                aria-selected={selected}
                aria-label={option.name}
                title={`${option.name} — ${option.role}`}
                onClick={() => select(i)}
                className={`w-11 h-11 rounded-full border-2 transition-[transform,box-shadow,border-color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                  selected
                    ? "border-accent opacity-100 -translate-y-0.5 scale-110 z-10 shadow-md"
                    : "border-cream opacity-55 hover:opacity-90 hover:-translate-y-0.5"
                }`}
              >
                {option.image ? (
                  <Face
                    src={option.image}
                    name={option.name}
                    size="xs"
                    alt=""
                    className="w-full h-full border-0 opacity-100"
                  />
                ) : (
                  <span className="w-full h-full rounded-full bg-cream-soft flex items-center justify-center text-ink-faint">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="9" r="3.5" />
                      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="min-w-0">
          <p className="text-body-xs font-medium text-ink leading-tight">{face.name}</p>
          <p className="text-label-base text-ink-faint">{face.role}</p>
        </div>
      </div>

      {/* The exchange, in the house language: the human is ink, the AI is accent. */}
      <div className={`space-y-2 ${compact ? "hidden lg:block" : ""}`}>
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
      <div className={`space-y-2 pt-1 ${compact ? "hidden lg:block" : ""}`}>
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
      </div>

      {/* The disclosure, which changes with the face. */}
      {!compact && (
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={face.id}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="text-label-base text-ink-faint leading-snug pt-0.5"
        >
          {face.disclosure}
        </motion.p>
      </AnimatePresence>
      )}
    </div>
  );
}
