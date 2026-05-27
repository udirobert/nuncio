"use client";

import { motion } from "motion/react";

export type UserTier = "trial" | "free" | "pro" | "studio";

interface DeepResearchToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  userTier: UserTier;
  compact?: boolean;
}

const TIER_INFO: Record<UserTier, {
  label: string;
  upgradeRequired: boolean;
  upgradeLabel?: string;
  provider: string;
  tooltip: string;
}> = {
  trial: {
    label: "Trial",
    upgradeRequired: true,
    upgradeLabel: "Upgrade to Pro",
    provider: "TinyFish only",
    tooltip: "Deep research requires a Pro or Studio plan.",
  },
  free: {
    label: "Free",
    upgradeRequired: true,
    upgradeLabel: "Upgrade to Pro",
    provider: "TinyFish only",
    tooltip: "Deep research requires a Pro or Studio plan.",
  },
  pro: {
    label: "Pro",
    upgradeRequired: false,
    provider: "TinyFish + Firecrawl",
    tooltip: "Fetches more sources and structured content.",
  },
  studio: {
    label: "Studio",
    upgradeRequired: false,
    provider: "TinyFish + Firecrawl + EXA",
    tooltip: "Semantic discovery across interviews, podcasts, and thought leadership.",
  },
};

export function DeepResearchToggle({
  enabled,
  onToggle,
  userTier,
  compact = false,
}: DeepResearchToggleProps) {
  const info = TIER_INFO[userTier];
  const isUpgradeRequired = info.upgradeRequired;

  if (compact) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v12M2 8h12" />
            <circle cx="8" cy="8" r="6" />
          </svg>
          <span className="text-[11px] text-ink">Deep Research</span>
          {!isUpgradeRequired && (
            <span className="text-[9px] font-mono text-ink-faint/60">{info.provider}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isUpgradeRequired ? (
            <button
              className="text-[10px] px-2 py-1 rounded-md bg-accent-soft text-accent border border-accent/20 hover:bg-accent/10 transition-colors font-medium"
              onClick={() => onToggle(false)}
              title={info.tooltip}
            >
              {info.upgradeLabel} →
            </button>
          ) : (
            <button
              onClick={() => onToggle(!enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                enabled ? "bg-accent" : "bg-cream-dark"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  enabled ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border-2 p-4 transition-all duration-200 ${
        enabled
          ? "border-accent/30 bg-accent-soft/20"
          : isUpgradeRequired
            ? "border-dashed border-cream-dark bg-white/60"
            : "border-cream-dark bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" className={`w-4 h-4 ${enabled ? "text-accent" : "text-ink-faint"}`} fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v12M2 8h12" />
              <circle cx="8" cy="8" r="6" />
            </svg>
            <span className={`text-sm font-medium ${enabled ? "text-accent" : "text-ink"}`}>
              Deep Research
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${
              enabled ? "bg-accent-soft text-accent" : "bg-cream-dark/50 text-ink-faint"
            }`}>
              {info.provider}
            </span>
          </div>
          <p className={`text-[11px] leading-relaxed ${
            enabled ? "text-ink-muted" : "text-ink-faint"
          }`}>
            {info.tooltip}
          </p>
          {enabled && userTier === "studio" && (
            <p className="text-[10px] text-ink-faint italic">
              Includes semantic discovery across interviews, podcasts, and essays.
            </p>
          )}
        </div>

        {isUpgradeRequired ? (
          <button
            className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-medium hover:bg-accent/90 transition-colors"
            onClick={() => onToggle(false)}
          >
            {info.upgradeLabel} →
          </button>
        ) : (
          <button
            onClick={() => onToggle(!enabled)}
            className={`shrink-0 relative w-10 h-6 rounded-full transition-colors ${
              enabled ? "bg-accent" : "bg-cream-dark"
            }`}
          >
            <span
              className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
                enabled ? "left-[19px]" : "left-0.5"
              }`}
            />
          </button>
        )}
      </div>
    </motion.div>
  );
}
