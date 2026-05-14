"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Profile } from "@/lib/claude";

interface ScriptReviewProps {
  script: string;
  profile: Profile;
  sources?: string[];
  onEdit: (script: string) => void;
  onRender: () => void;
}

/**
 * Highlight personalisation hooks within the script text.
 * Returns an array of segments, some marked as highlighted.
 */
function highlightScript(
  text: string,
  hooks: string[]
): { text: string; highlighted: boolean }[] {
  if (!hooks.length) return [{ text, highlighted: false }];

  // Build a regex that matches any hook (case-insensitive, partial)
  const patterns = hooks
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((h) => h.length > 3); // Only highlight meaningful phrases

  if (!patterns.length) return [{ text, highlighted: false }];

  const regex = new RegExp(`(${patterns.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part) => ({
    text: part,
    highlighted: regex.test(part) || patterns.some((p) => new RegExp(p, "i").test(part)),
  }));
}

export function ScriptReview({
  script,
  profile,
  sources,
  onEdit,
  onRender,
}: ScriptReviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script);
  const [isRevealed, setIsRevealed] = useState(false);

  const wordCount = editedScript.trim().split(/\s+/).length;
  const wordCountColor =
    wordCount > 200
      ? "text-error"
      : wordCount > 180
        ? "text-warm"
        : "text-success";

  const segments = useMemo(
    () => highlightScript(editedScript, profile.personalization_hooks || []),
    [editedScript, profile.personalization_hooks]
  );

  // Trigger reveal after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsRevealed(true), 400);
    return () => clearTimeout(timer);
  }, []);

  function handleSaveEdit() {
    onEdit(editedScript);
    setIsEditing(false);
  }

  function handleRender() {
    if (isEditing) {
      onEdit(editedScript);
    }
    onRender();
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
            transition={{ delay: 0.1 }}
            className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-3"
          >
            Your message for
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[0.9]"
          >
            {profile.name}
          </motion.h1>
          {profile.current_role && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-ink-muted text-sm mt-2"
            >
              {profile.current_role}
              {profile.company && ` at ${profile.company}`}
            </motion.p>
          )}
        </div>

        {/* Personalisation depth indicator */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-accent-soft/40 border border-accent/10"
        >
          <div className="flex -space-x-0.5">
            {[...Array(Math.min(profile.personalization_hooks?.length || 0, 5))].map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 + i * 0.05, type: "spring", stiffness: 500 }}
                className="w-2 h-2 rounded-full bg-accent border border-accent-soft"
              />
            ))}
          </div>
          <span className="text-xs text-accent font-medium">
            {profile.personalization_hooks?.length || 0} specific details referenced
          </span>
        </motion.div>

        {/* Script card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-cream-dark bg-white p-6 shadow-lg shadow-ink/5 mb-6"
        >
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  rows={8}
                  className="w-full text-[15px] leading-[1.7] resize-none focus:outline-none bg-transparent text-ink"
                  aria-label="Edit video script"
                  autoFocus
                />
              </motion.div>
            ) : (
              <motion.div
                key="display"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[15px] leading-[1.7] text-ink-light"
              >
                {isRevealed ? (
                  segments.map((seg, i) =>
                    seg.highlighted ? (
                      <motion.mark
                        key={i}
                        initial={{ backgroundColor: "transparent" }}
                        animate={{ backgroundColor: "var(--color-accent-soft)" }}
                        transition={{ delay: 0.1 * i, duration: 0.4 }}
                        className="bg-accent-soft text-ink rounded-sm px-0.5 -mx-0.5"
                      >
                        {seg.text}
                      </motion.mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )
                ) : (
                  <span className="text-ink-faint">Loading script...</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream-dark/60">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-[family-name:var(--font-mono)] ${wordCountColor}`}>
                {wordCount}w
              </span>
              <span className="text-ink-faint/30">·</span>
              <span className="text-xs text-ink-faint">
                ~{Math.ceil(wordCount / 2.5)}s delivery
              </span>
            </div>
            {sources && sources.length > 0 && (
              <div className="flex items-center gap-1.5">
                {sources.map((s, i) => {
                  let hostname = s;
                  try { hostname = new URL(s).hostname.replace("www.", ""); } catch { /* noop */ }
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-faint"
                    >
                      {hostname}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3"
        >
          {isEditing ? (
            <button
              onClick={handleSaveEdit}
              className="btn-press flex-1 rounded-2xl border border-cream-dark px-5 py-4 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
            >
              Done editing
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-press flex-1 rounded-2xl border border-cream-dark px-5 py-4 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M11.5 1.5l3 3L5 14l-3.5.5.5-3.5z" />
                </svg>
                Edit
              </span>
            </button>
          )}
          <button
            onClick={handleRender}
            className="btn-press flex-[2] rounded-2xl bg-ink px-5 py-4 text-sm font-medium text-cream hover:bg-ink-light transition-all shadow-xl shadow-ink/15 hover:shadow-2xl hover:shadow-ink/20 hover:-translate-y-0.5"
          >
            <span className="flex items-center justify-center gap-2">
              Render video
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </span>
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[11px] text-ink-faint mt-4"
        >
          Rendering takes ~60 seconds · Uses 1 credit
        </motion.p>
      </motion.div>
    </main>
  );
}
