"use client";

import { motion, AnimatePresence } from "motion/react";

export type IntentId =
  | "warm_intro"
  | "investor_pitch"
  | "hiring"
  | "conference_followup"
  | "reengage"
  | "founder_to_founder";

export interface IntentOption {
  id: IntentId;
  label: string;
  /** Stem written into the brief textarea when the user picks this intent
   *  AND the textarea is empty. Never overwrites existing content. */
  stem: string;
  /** Short description shown below the chips when this intent is active. */
  hint: string;
}

export const INTENT_OPTIONS: IntentOption[] = [
  {
    id: "warm_intro",
    label: "Warm intro",
    stem: "I came across their work and wanted to introduce myself — ",
    hint: "Curiosity-led, low-friction ask, no pitch above the fold.",
  },
  {
    id: "investor_pitch",
    label: "Investor pitch",
    stem: "I'm raising for ",
    hint: "Lead with momentum signal + map to their stated thesis.",
  },
  {
    id: "hiring",
    label: "Hiring reach-out",
    stem: "I'm hiring for a role I think they'd find unusual — ",
    hint: "References specific work, not job title. Skips recruiter language.",
  },
  {
    id: "conference_followup",
    label: "Conference follow-up",
    stem: "We met briefly at ",
    hint: "Picks up where the in-person conversation left off.",
  },
  {
    id: "reengage",
    label: "Re-engage cold lead",
    stem: "It's been a while — what's changed on my side is ",
    hint: "Acknowledges the gap; leads with what's genuinely new.",
  },
  {
    id: "founder_to_founder",
    label: "Founder-to-founder",
    stem: "Founder to founder — I've been wrestling with ",
    hint: "Peer-to-peer voice. Offers something before asking.",
  },
];

interface IntentChipsProps {
  value: IntentId | null;
  onChange: (intent: IntentId | null, stem: string) => void;
}

export function IntentChips({ value, onChange }: IntentChipsProps) {
  const active = INTENT_OPTIONS.find((o) => o.id === value);

  function handlePick(option: IntentOption) {
    if (value === option.id) {
      onChange(null, "");
    } else {
      onChange(option.id, option.stem);
    }
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          What kind of message?
        </label>
        <span className="text-label-sm text-ink-faint/70">Optional · sharpens the script</span>
      </div>

      <motion.div className="flex flex-wrap gap-1.5">
        {INTENT_OPTIONS.map((option, i) => {
          const isActive = value === option.id;
          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => handlePick(option)}
              aria-pressed={isActive}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`
                text-label-base px-2.5 py-1.5 rounded-full border transition-colors
                ${
                  isActive
                    ? "bg-ink text-cream border-ink shadow-sm"
                    : "bg-white/70 text-ink-muted border-cream-dark hover:border-ink/30 hover:text-ink hover:bg-white"
                }
              `}
            >
              {option.label}
            </motion.button>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        {active && (
          <motion.p
            key={active.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-label-base text-ink-faint mt-2 leading-relaxed"
          >
            {active.hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
