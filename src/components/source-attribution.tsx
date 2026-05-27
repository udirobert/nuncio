"use client";

import { motion } from "motion/react";
import type { SourceAttribution } from "@/lib/claude";

const PROVIDER_LABELS: Record<string, string> = {
  tinyfish: "TinyFish",
  firecrawl: "Firecrawl",
  exa: "EXA",
  "web-search": "Web Search",
  claude: "Claude",
  melius: "Melius",
};

const PROVIDER_COLORS: Record<string, string> = {
  tinyfish: "text-accent bg-accent-soft border-accent/20",
  firecrawl: "text-warm bg-warm-soft border-warm/20",
  exa: "text-success bg-success-soft border-success/20",
  "web-search": "text-ink-muted bg-cream-dark/30 border-cream-dark",
};

interface SourceAttributionPanelProps {
  attribution: SourceAttribution;
  isPremium?: boolean;
}

function AttributionBar({ label, count, total, color }: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-ink-muted w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-cream-dark/30 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-mono text-ink-muted w-8 text-right">{count}</span>
    </div>
  );
}

export function SourceAttributionPanel({ attribution, isPremium = false }: SourceAttributionPanelProps) {
  if (!attribution) return null;

  const totalFindings = attribution.factCount + attribution.inferenceCount;
  const providers = attribution.providerBreakdown
    ? Object.entries(attribution.providerBreakdown)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-cream-dark bg-white p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Research confidence
        </span>
        <span className="text-[10px] font-mono text-ink-faint/60">
          {attribution.sourcesScanned} source{attribution.sourcesScanned !== 1 ? "s" : ""} scanned
        </span>
      </div>

      {/* Fact vs Inference bar */}
      <div className="space-y-1.5">
        <AttributionBar
          label="Facts"
          count={attribution.factCount}
          total={totalFindings}
          color="bg-success"
        />
        <AttributionBar
          label="Inferences"
          count={attribution.inferenceCount}
          total={totalFindings}
          color="bg-warm"
        />
      </div>

      {/* Summary text */}
      <div className="flex items-center gap-2 text-[11px]">
        {attribution.factCount > attribution.inferenceCount ? (
          <span className="inline-flex items-center gap-1 text-success">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
              <path d="M6 0a6 6 0 1 1 0 12A6 6 0 0 1 6 0zm-.22 2.97a.75.75 0 0 0-1.06 1.06L6.47 5.7a.75.75 0 0 0 1.06 0l3-3a.75.75 0 0 0-1.06-1.06L6 4.19 5.78 2.97z" />
            </svg>
            Mostly factual · {Math.round((attribution.factCount / totalFindings) * 100)}% verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-warm">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
              <path d="M6 0a6 6 0 1 1 0 12A6 6 0 0 1 6 0zm-.22 3.47a.75.75 0 0 0 1.06 0L9.5 5.7a.75.75 0 0 0-1.06 1.06L6.53 5.03a.75.75 0 0 0-1.06 0L3.84 6.76a.75.75 0 0 0 1.06 1.06l1.1-1.1V8.5a.75.75 0 0 0 1.5 0V5.97L5.78 3.47z" />
            </svg>
            Mostly inferred · {Math.round((attribution.inferenceCount / totalFindings) * 100)}% unverified
          </span>
        )}
      </div>

      {/* Provider breakdown */}
      {providers.length > 0 && (
        <div className="pt-1 border-t border-cream-dark space-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium block">
            Sources
          </span>
          <div className="flex flex-wrap gap-1.5">
            {providers.map(([provider, count]) => {
              const colors = PROVIDER_COLORS[provider] || "text-ink-faint bg-cream-dark/30 border-cream-dark";
              const label = PROVIDER_LABELS[provider] || provider;
              return (
                <span
                  key={provider}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors}`}
                >
                  {label}
                  <span className="font-mono opacity-70">{count}</span>
                </span>
              );
            })}
            {!isPremium && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-ink-faint/30 text-ink-faint/60">
                + more with Deep Research
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
