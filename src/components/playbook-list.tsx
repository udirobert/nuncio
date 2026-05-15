"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import type { PlaybookEntry } from "@/lib/playbook";
import { trackPlaybookViewed } from "@/lib/analytics";

interface PlaybookListProps {
  entries: PlaybookEntry[];
}

export function PlaybookList({ entries }: PlaybookListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(entries[0]?.id || null);

  // Honour URL hash on mount and on hash changes — recipient-wall cards
  // deep-link as /playbook#entry-id; this opens that entry and scrolls to it.
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const match = entries.find((e) => e.id === hash);
      if (!match) return;
      setExpandedId(match.id);
      trackPlaybookViewed({ entryId: match.id });
      // Defer scroll until after the entry has had a frame to expand
      requestAnimationFrame(() => {
        document
          .getElementById(`playbook-entry-${match.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [entries]);

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <PlaybookCard
            entry={entry}
            isExpanded={expandedId === entry.id}
            onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
          />
        </motion.div>
      ))}
    </div>
  );
}

function PlaybookCard({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: PlaybookEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Build the "Try this example" URL with intent
  const tryUrl = `/?url=${encodeURIComponent(entry.recipient.url)}&brief=${encodeURIComponent(entry.brief)}${entry.intent ? `&intent=${entry.intent}` : ""}`;

  return (
    <article
      id={`playbook-entry-${entry.id}`}
      className="rounded-2xl border border-cream-dark bg-white overflow-hidden scroll-mt-6"
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-cream-dark/20 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full ${entry.categoryColor}`}
            >
              {entry.category}
            </span>
          </div>
          <h3 className="text-base font-medium text-ink mb-1">
            {entry.recipient.name}
          </h3>
          <p className="text-sm text-ink-muted">
            {entry.recipient.role} at {entry.recipient.company} ·{" "}
            {entry.recipient.platform}
          </p>
        </div>
        <svg
          viewBox="0 0 16 16"
          className={`w-4 h-4 text-ink-faint transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="px-6 pb-6 space-y-6 border-t border-cream-dark/60 pt-5"
        >
          {/* Brief */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-2">
              Sender brief
            </h4>
            <p className="text-sm text-ink-muted leading-relaxed italic">
              &ldquo;{entry.brief}&rdquo;
            </p>
          </div>

          {/* Generated script */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-2">
              Generated script
            </h4>
            <div className="rounded-xl bg-cream-dark/40 p-4">
              <p className="text-[14px] leading-[1.7] text-ink-light whitespace-pre-wrap">
                {entry.script}
              </p>
            </div>
          </div>

          {/* Teardown */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-ink-faint font-medium">
              Why this works
            </h4>

            <div className="space-y-2">
              {entry.teardown.whatWorked.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-success-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      viewBox="0 0 16 16"
                      className="w-2.5 h-2.5 text-success"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                  </span>
                  <p className="text-sm text-ink-light leading-relaxed">{point}</p>
                </div>
              ))}
            </div>

            <p className="text-sm text-ink-muted leading-relaxed bg-accent-soft/30 rounded-xl px-4 py-3 border border-accent/10">
              {entry.teardown.whyItLands}
            </p>

            {/* What was skipped */}
            <div>
              <h5 className="text-[11px] uppercase tracking-widest text-ink-faint font-medium mb-2">
                Deliberately skipped
              </h5>
              <div className="space-y-1.5">
                {entry.teardown.skipped.map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        viewBox="0 0 16 16"
                        className="w-2.5 h-2.5 text-ink-faint"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 8h8" />
                      </svg>
                    </span>
                    <p className="text-xs text-ink-faint leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Use this example CTA */}
          <div className="pt-2">
            <Link
              href={tryUrl}
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium shadow-lg shadow-ink/10 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Try this example
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </motion.div>
      )}
    </article>
  );
}
