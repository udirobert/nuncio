"use client";

import { motion } from "motion/react";

export type QualityTierId = "quick" | "balanced" | "deep";
export type UserPlan = "trial" | "free" | "pro" | "studio";

interface TierOption {
  id: QualityTierId;
  label: string;
  description: string;
  features: string[];
  planRequired: UserPlan[];
  badge?: string;
}

const TIER_OPTIONS: TierOption[] = [
  {
    id: "quick",
    label: "Quick",
    description: "Fast profile enrichment — one source, one script.",
    features: ["1 source", "1 script", "Free"],
    planRequired: ["trial", "free", "pro", "studio"],
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Enrichment + recent activity + company context — 2 hooks.",
    features: ["3+ sources", "2 hooks", "Company context"],
    planRequired: ["pro", "studio"],
    badge: "Pro",
  },
  {
    id: "deep",
    label: "Deep Research",
    description: "Multi-provider research — semantic search, source attribution, ranked angles.",
    features: ["10+ sources", "3 ranked angles", "Full citations", "Confidence scoring"],
    planRequired: ["studio"],
    badge: "Studio",
  },
];
interface QualityLadderProps {
  currentTier: QualityTierId;
  onSelect: (tier: QualityTierId) => void;
  userPlan: UserPlan;
  compact?: boolean;
}

export function QualityLadder({
  currentTier,
  onSelect,
  userPlan,
  compact = false,
}: QualityLadderProps) {
  const availableTiers = TIER_OPTIONS.filter((t) =>
    t.planRequired.includes(userPlan)
  );
  const currentRank = TIER_OPTIONS.findIndex((t) => t.id === currentTier);

  if (compact) {
    return (
      <CompactLadder
        availableTiers={availableTiers}
        currentTier={currentTier}
        onSelect={onSelect}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Research depth
        </span>
        <span className="text-[10px] font-mono text-ink-faint/60">
          {TIER_OPTIONS[currentRank]?.label || "Quick"}
        </span>
      </div>
      <div className="grid gap-2">
        {TIER_OPTIONS.map((tier, idx) => {
          const isAvailable = availableTiers.some((t) => t.id === tier.id);
          const isSelected = currentTier === tier.id;
          const isLocked = !isAvailable;
          const isUpgrade = isLocked && idx > currentRank;
          return (
            <TierButton
              key={tier.id}
              tier={tier}
              idx={idx}
              isSelected={isSelected}
              isLocked={isLocked}
              isUpgrade={isUpgrade}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

interface CompactLadderProps {
  availableTiers: TierOption[];
  currentTier: QualityTierId;
  onSelect: (tier: QualityTierId) => void;
}

function CompactLadder({
  availableTiers,
  currentTier,
  onSelect,
}: CompactLadderProps) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
        Research depth
      </span>
      <div className="flex gap-1.5">
        {TIER_OPTIONS.map((tier) => {
          const isAvailable = availableTiers.some((t) => t.id === tier.id);
          const isSelected = currentTier === tier.id;
          const isLocked = !isAvailable;
          return (
            <button
              key={tier.id}
              onClick={() => {
                if (isAvailable) onSelect(tier.id);
              }}
              title={
                isLocked
                  ? "Upgrade for " + tier.label
                  : tier.description
              }
              className={`flex-1 rounded-lg border py-2 px-2 text-center transition-all ${
                isSelected
                  ? "border-accent bg-accent-soft text-accent shadow-sm"
                  : isLocked
                    ? "border-cream-dark/40 bg-cream/30 text-ink-faint/50 cursor-not-allowed"
                    : "border-cream-dark bg-white text-ink-muted hover:border-accent/30 hover:text-accent"
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span
                  className={`text-[10px] font-medium ${
                    isLocked ? "line-through" : ""
                  }`}
                >
                  {tier.label}
                </span>
                {isLocked && (
                  <svg
                    viewBox="0 0 12 12"
                    className="w-2.5 h-2.5"
                    fill="currentColor"
                  >
                    <path d="M6 1a3 3 0 0 0-3 3v1H2.5A1.5 1.5 0 0 0 1 6.5v4A1.5 1.5 0 0 0 2.5 12h7A1.5 1.5 0 0 0 11 10.5v-4A1.5 1.5 0 0 0 9.5 5H9V4a3 3 0 0 0-3-3zm0 2a1 1 0 0 1 1 1v1H5V4a1 1 0 0 1 1-1z" />
                  </svg>
                )}
              </div>
              {isSelected && (
                <span className="block text-[9px] text-accent/70 mt-0.5">
                  {tier.features[0]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


interface TierButtonProps {
  tier: TierOption;
  idx: number;
  isSelected: boolean;
  isLocked: boolean;
  isUpgrade: boolean;
  onSelect: (tier: QualityTierId) => void;
}

function TierButton({
  tier,
  idx,
  isSelected,
  isLocked,
  isUpgrade,
  onSelect,
}: TierButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.06 }}
      onClick={() => {
        if (!isLocked) onSelect(tier.id);
      }}
      disabled={isLocked}
      className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
        isSelected
          ? "border-accent bg-accent-soft/30 shadow-sm"
          : isLocked
            ? "border-dashed border-cream-dark bg-cream/20 opacity-70"
            : "border-cream-dark bg-white hover:border-accent/30 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                isSelected
                  ? "text-accent"
                  : isLocked
                    ? "text-ink-faint"
                    : "text-ink"
              }`}
            >
              {tier.label}
            </span>
            {tier.badge && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${
                  isSelected
                    ? "bg-accent-soft text-accent"
                    : isLocked
                      ? "bg-cream-dark/50 text-ink-faint"
                      : "bg-cream-dark/40 text-ink-muted"
                }`}
              >
                {tier.badge}
              </span>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-faint">
                <svg
                  viewBox="0 0 12 12"
                  className="w-2.5 h-2.5"
                  fill="currentColor"
                >
                  <path d="M6 1a3 3 0 0 0-3 3v1H2.5A1.5 1.5 0 0 0 1 6.5v4A1.5 1.5 0 0 0 2.5 12h7A1.5 1.5 0 0 0 11 10.5v-4A1.5 1.5 0 0 0 9.5 5H9V4a3 3 0 0 0-3-3zm0 2a1 1 0 0 1 1 1v1H5V4a1 1 0 0 1 1-1z" />
                </svg>
                {isUpgrade
                  ? "Upgrade to " + tier.badge
                  : tier.badge + " only"}
              </span>
            )}
          </div>
          <p
            className={`text-[11px] leading-relaxed ${
              isSelected
                ? "text-ink-muted"
                : isLocked
                  ? "text-ink-faint/60"
                  : "text-ink-muted"
            }`}
          >
            {tier.description}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tier.features.map((f) => (
              <span
                key={f}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  isSelected
                    ? "bg-accent-soft/60 text-accent/80"
                    : isLocked
                      ? "bg-cream-dark/20 text-ink-faint/50"
                      : "bg-cream-dark/30 text-ink-muted"
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
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
}
