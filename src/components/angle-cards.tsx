"use client";

import { motion } from "motion/react";
import type { TopicalAngle } from "@/lib/claude";

const CONFIDENCE_META: Record<
  TopicalAngle["confidence"],
  { label: string; color: string; bg: string; border: string }
> = {
  high: {
    label: "High confidence",
    color: "text-success",
    bg: "bg-success-soft",
    border: "border-success/20",
  },
  medium: {
    label: "Medium confidence",
    color: "text-warm",
    bg: "bg-warm-soft",
    border: "border-warm/20",
  },
  low: {
    label: "Low confidence",
    color: "text-ink-faint",
    bg: "bg-cream-dark/30",
    border: "border-cream-dark",
  },
};

const ARCHETYPE_HINTS: Record<string, { icon: string; label: string }> = {
  mirror: { icon: "🪞", label: "Mirror" },
  origin: { icon: "🌱", label: "Origin" },
  inside_joke: { icon: "🤫", label: "Inside joke" },
  future_cast: { icon: "🔮", label: "Future-cast" },
  day_in_the_life: { icon: "📆", label: "Day-in-life" },
};

interface AngleCardsProps {
  angles: TopicalAngle[];
  selectedAngleId?: string;
  onSelect: (angle: TopicalAngle) => void;
  maxDisplay?: number;
}

export function AngleCards({
  angles,
  selectedAngleId,
  onSelect,
  maxDisplay = 4,
}: AngleCardsProps) {
  if (!angles || angles.length === 0) return null;

  const displayAngles = angles.slice(0, maxDisplay);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Recommended angles
        </span>
        <span className="text-[10px] font-mono text-ink-faint/60">
          {angles.length} angle{angles.length !== 1 ? "s" : ""} · ranked by relevance
        </span>
      </div>

      <div className="grid gap-3">
        {displayAngles.map((angle, i) => {
          const meta = CONFIDENCE_META[angle.confidence];
          const archetype = angle.suggestedArchetype
            ? ARCHETYPE_HINTS[angle.suggestedArchetype.toLowerCase()]
            : null;
          const isSelected = selectedAngleId === angle.id;

          return (
            <motion.button
              key={angle.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onSelect(angle)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 ${
                isSelected
                  ? "border-accent bg-accent-soft/40 shadow-sm"
                  : "border-cream-dark bg-white hover:border-accent/30 hover:shadow-sm hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Angle label + confidence badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[13px] font-medium ${
                        isSelected ? "text-accent" : "text-ink"
                      }`}
                    >
                      {angle.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.bg} ${meta.color} ${meta.border} border`}
                    >
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {meta.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] text-ink-muted leading-relaxed">
                    {angle.description}
                  </p>

                  {/* Evidence */}
                  <div className="flex items-start gap-1.5">
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3 h-3 mt-0.5 shrink-0 text-ink-faint"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
                    </svg>
                    <span className="text-[11px] text-ink-faint leading-relaxed">
                      {angle.evidence}
                    </span>
                  </div>

                  {/* Relevance to outreach */}
                  <span className="inline-block text-[10px] text-ink-faint/60 italic">
                    {angle.relevanceToOutreach}
                  </span>
                </div>

                {/* Archetype hint */}
                {archetype && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cream-dark/30 text-[10px] font-mono text-ink-faint">
                    <span>{archetype.icon}</span>
                    <span>{archetype.label}</span>
                  </span>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <svg
                      viewBox="0 0 12 12"
                      className="w-2.5 h-2.5 text-white"
                      fill="currentColor"
                    >
                      <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                    </svg>
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
