"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Profile } from "@/lib/claude";

interface ScriptReviewProps {
  script: string;
  profile: Profile;
  sources?: string[];
  onEdit: (script: string) => void;
  onRender: () => void;
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

  const wordCount = editedScript.trim().split(/\s+/).length;
  const wordCountColor =
    wordCount > 200
      ? "text-error"
      : wordCount > 180
        ? "text-warm"
        : "text-ink-faint";

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
    <main className="flex-1 flex items-center justify-center px-6 py-12">
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
            className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-2"
          >
            Script ready
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-none"
          >
            For {profile.name}
          </motion.h1>
        </div>

        {/* Personalisation hooks */}
        {profile.personalization_hooks && profile.personalization_hooks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap gap-2 mb-6"
          >
            {profile.personalization_hooks.slice(0, 3).map((hook, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs text-accent font-medium"
              >
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                  <circle cx="8" cy="8" r="3" />
                </svg>
                {hook}
              </span>
            ))}
          </motion.div>
        )}

        {/* Script card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-cream-dark bg-white p-6 shadow-sm mb-6"
        >
          {isEditing ? (
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              rows={8}
              className="w-full text-sm leading-relaxed resize-none focus:outline-none bg-transparent text-ink"
              aria-label="Edit video script"
            />
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-sm leading-relaxed whitespace-pre-wrap text-ink-light"
            >
              &ldquo;{editedScript}&rdquo;
            </motion.p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream-dark">
            <span className={`text-xs font-[family-name:var(--font-mono)] ${wordCountColor}`}>
              {wordCount} words
            </span>
            {sources && sources.length > 0 && (
              <span className="text-xs text-ink-faint">
                via{" "}
                {sources
                  .map((s) => {
                    try {
                      return new URL(s).hostname.replace("www.", "");
                    } catch {
                      return s;
                    }
                  })
                  .join(" · ")}
              </span>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3"
        >
          {isEditing ? (
            <button
              onClick={handleSaveEdit}
              className="btn-press flex-1 rounded-xl border border-cream-dark px-5 py-3.5 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
            >
              Done editing
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-press flex-1 rounded-xl border border-cream-dark px-5 py-3.5 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors"
            >
              Edit script
            </button>
          )}
          <button
            onClick={handleRender}
            className="btn-press flex-1 rounded-xl bg-ink px-5 py-3.5 text-sm font-medium text-cream hover:bg-ink-light transition-colors shadow-lg shadow-ink/10"
          >
            <span className="flex items-center justify-center gap-2">
              Render video
              <svg
                viewBox="0 0 16 16"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </span>
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
