"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DiscoveredProfile } from "@/lib/tinyfish";

interface ProfilePickerProps {
  primaryUrl: string;
  discoveredProfiles: DiscoveredProfile[];
  onConfirm: (profilesToUse: string[]) => void;
  onSkip: () => void;
}

export function ProfilePicker({
  primaryUrl,
  discoveredProfiles,
  onConfirm,
  onSkip,
}: ProfilePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set([primaryUrl, ...discoveredProfiles.map((p) => p.url)])
  );
  const [autoSkipTimer, setAutoSkipTimer] = useState(10);
  const autoSkipRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (discoveredProfiles.length === 0) {
      setTimeout(() => onConfirm([primaryUrl]), 500);
      return;
    }

    autoSkipRef.current = setInterval(() => {
      setAutoSkipTimer((prev) => {
        if (prev <= 1) {
          if (autoSkipRef.current) clearInterval(autoSkipRef.current);
          onConfirm(Array.from(selected));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoSkipRef.current) clearInterval(autoSkipRef.current);
    };
  }, [discoveredProfiles.length, onConfirm, primaryUrl, selected]);

  function toggleProfile(url: string) {
    if (autoSkipRef.current) {
      clearInterval(autoSkipRef.current);
      autoSkipRef.current = null;
    }
    setAutoSkipTimer(0);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (autoSkipRef.current) {
      clearInterval(autoSkipRef.current);
    }
    onConfirm(Array.from(selected));
  }

  if (discoveredProfiles.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[540px] text-center"
        >
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight leading-[0.9] mb-4">
            No additional
            <br />
            <span className="italic">profiles found</span>
          </h1>
          <p className="text-ink-muted text-sm mb-8">
            We couldn&apos;t discover any other profiles for this person.
            Continuing with the single profile you provided.
          </p>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[540px]"
      >
        {/* Header */}
        <div className="mb-8">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-3"
          >
            Profile discovery
          </motion.p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight leading-[0.9] mb-3">
            Which profiles
            <br />
            <span className="italic">look right?</span>
          </h1>
          <p className="text-ink-muted text-sm">
            We discovered {discoveredProfiles.length} additional profiles.
            Verify the correct ones before we research them.
          </p>
        </div>

        {/* Profile cards */}
        <div className="space-y-2 mb-6">
          <AnimatePresence>
            {discoveredProfiles.map((profile, i) => (
              <motion.button
                key={profile.url}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                onClick={() => toggleProfile(profile.url)}
                className={`
                  w-full text-left rounded-2xl border px-5 py-4 transition-all duration-200
                  ${selected.has(profile.url)
                    ? "border-accent bg-accent-soft/30 shadow-sm"
                    : "border-cream-dark bg-white hover:border-ink-faint/30"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(profile.url)
                      ? "border-accent bg-accent"
                      : "border-cream-dark"
                      }`}
                  >
                    {selected.has(profile.url) && (
                      <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 8.5l3.5 3.5L13 5" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-ink">{profile.platform}</p>
                      {profile.confidence && (
                        <span className="text-[10px] text-ink-faint">
                          {Math.round(profile.confidence * 100)}% match
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted truncate">{profile.url}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3"
        >
          <button
            onClick={onSkip}
            className="btn-press flex-1 rounded-2xl border border-cream-dark px-5 py-4 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
          >
            Use original only
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className={`btn-press flex-[2] rounded-2xl px-5 py-4 text-sm font-medium transition-all ${selected.size > 0
              ? "bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5"
              : "bg-cream-dark text-ink-faint cursor-not-allowed"
              }`}
          >
            <span className="flex items-center justify-center gap-2">
              Research {selected.size} profile{selected.size !== 1 ? "s" : ""}
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </span>
          </button>
        </motion.div>

        {/* Auto-skip timer */}
        {autoSkipTimer <= 10 && autoSkipTimer > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-[11px] text-ink-faint mt-3"
          >
            Auto-continuing in {autoSkipTimer}s · or pick your profiles above
          </motion.p>
        )}
      </motion.div>
    </main>
  );
}