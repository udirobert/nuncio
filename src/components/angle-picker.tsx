"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Profile } from "@/lib/claude";

interface AngleCandidate {
  label: string;
  evidence: string;
  why_chosen: string;
}

interface SkippedSignal {
  signal: string;
  why_skipped: string;
}

interface AnglePickerProps {
  profile: Profile;
  onConfirm: (selectedAngles: AngleCandidate[]) => void;
  onSkip: () => void;
}

export function AnglePicker({ profile, onConfirm, onSkip }: AnglePickerProps) {
  const [angles, setAngles] = useState<AngleCandidate[]>([]);
  const [skipped, setSkipped] = useState<SkippedSignal[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSkipTimer, setAutoSkipTimer] = useState(10);
  const autoSkipRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch angles from the API
  useEffect(() => {
    async function fetchAngles() {
      try {
        const res = await fetch("/api/preview-angles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile }),
        });

        if (!res.ok) throw new Error("Failed to load angles");

        const data = await res.json();
        setAngles(data.angles || []);
        setSkipped(data.skipped || []);
        // Pre-select first two angles
        setSelected(new Set([0, 1]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load angles");
      }
      setLoading(false);
    }

    fetchAngles();
  }, [profile]);

  // Auto-skip countdown (if user doesn't interact, proceed with selected angles after 10s)
  useEffect(() => {
    if (loading || error) return;

    autoSkipRef.current = setInterval(() => {
      setAutoSkipTimer((prev) => {
        if (prev <= 1) {
          if (autoSkipRef.current) clearInterval(autoSkipRef.current);
          // Auto-confirm with selected angles
          const selectedAngles = angles.filter((_, i) => selected.has(i));
          onConfirm(selectedAngles.length > 0 ? selectedAngles : angles);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoSkipRef.current) clearInterval(autoSkipRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error]);

  function toggleAngle(index: number) {
    // Stop auto-skip on user interaction
    if (autoSkipRef.current) {
      clearInterval(autoSkipRef.current);
      autoSkipRef.current = null;
    }
    setAutoSkipTimer(0);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleConfirm() {
    const selectedAngles = angles.filter((_, i) => selected.has(i));
    onConfirm(selectedAngles.length > 0 ? selectedAngles : angles);
  }

  function handleUseAll() {
    onConfirm(angles);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[540px] text-center"
        >
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight leading-[0.9] mb-4">
            Finding the
            <br />
            <span className="italic">right angle</span>
          </h1>
          <p className="text-ink-muted text-sm mb-8">
            Analysing {profile.name}&apos;s profile for the strongest personalisation signals...
          </p>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="w-2 h-2 rounded-full bg-accent"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </main>
    );
  }

  if (error) {
    // On error, skip coach mode and proceed
    onSkip();
    return null;
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
            Coach mode
          </motion.p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight leading-[0.9] mb-3">
            Which angles
            <br />
            <span className="italic">matter most?</span>
          </h1>
          <p className="text-ink-muted text-sm">
            We found {angles.length} personalisation signals in {profile.name}&apos;s profile.
            Pick 1–2 to focus the script, or use all.
          </p>
        </div>

        {/* Angle cards */}
        <div className="space-y-2 mb-6">
          <AnimatePresence>
            {angles.map((angle, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                onClick={() => toggleAngle(i)}
                className={`
                  w-full text-left rounded-2xl border px-5 py-4 transition-all duration-200
                  ${selected.has(i)
                    ? "border-accent bg-accent-soft/30 shadow-sm"
                    : "border-cream-dark bg-white hover:border-ink-faint/30"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected.has(i)
                        ? "border-accent bg-accent"
                        : "border-cream-dark"
                    }`}
                  >
                    {selected.has(i) && (
                      <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 8.5l3.5 3.5L13 5" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink mb-0.5">{angle.label}</p>
                    <p className="text-xs text-ink-muted leading-relaxed">{angle.evidence}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Skipped signals */}
        {skipped.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-8 rounded-xl bg-cream-dark/40 px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-2">
              Deliberately skipped
            </p>
            <div className="space-y-1">
              {skipped.map((s, i) => (
                <p key={i} className="text-xs text-ink-faint">
                  <span className="text-ink-muted">{s.signal}</span> — {s.why_skipped}
                </p>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3"
        >
          <button
            onClick={handleUseAll}
            className="btn-press flex-1 rounded-2xl border border-cream-dark px-5 py-4 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
          >
            Use all {angles.length}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className={`btn-press flex-[2] rounded-2xl px-5 py-4 text-sm font-medium transition-all ${
              selected.size > 0
                ? "bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5"
                : "bg-cream-dark text-ink-faint cursor-not-allowed"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              Write script with {selected.size} angle{selected.size !== 1 ? "s" : ""}
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
            Auto-continuing in {autoSkipTimer}s · or pick your angles above
          </motion.p>
        )}
      </motion.div>
    </main>
  );
}
