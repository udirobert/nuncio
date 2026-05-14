"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface UrlFormProps {
  onSubmit: (urls: string[]) => void;
}

const PLATFORMS = [
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin.com/in/...",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: "twitter",
    label: "Twitter / X",
    placeholder: "x.com/...",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: "other",
    label: "Other",
    placeholder: "any public profile URL",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
];

export function UrlForm({ onSubmit }: UrlFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState<string | null>(null);

  const urls = Object.values(values).filter((u) => u.trim() !== "");
  const isValid = urls.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) {
      onSubmit(urls);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[540px]"
      >
        {/* Brand header */}
        <div className="mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-display)] text-5xl md:text-6xl tracking-tight leading-none mb-4"
          >
            nuncio
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-ink-muted text-base leading-relaxed max-w-[400px]"
          >
            Your intelligent emissary. Drop a social profile — get a
            personalised video in 60 seconds.
          </motion.p>
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-4"
        >
          <p className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-6">
            Who are you reaching out to?
          </p>

          <div className="space-y-3">
            {PLATFORMS.map((platform, i) => (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.35 + i * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  className={`
                    relative flex items-center gap-3 rounded-xl border px-4 py-3
                    transition-all duration-200
                    ${
                      focused === platform.id
                        ? "border-accent bg-white shadow-sm"
                        : "border-cream-dark bg-cream-dark/50 hover:border-ink-faint/30"
                    }
                  `}
                >
                  <span
                    className={`transition-colors duration-200 ${
                      focused === platform.id
                        ? "text-accent"
                        : "text-ink-faint"
                    }`}
                  >
                    {platform.icon}
                  </span>
                  <input
                    id={platform.id}
                    type="url"
                    value={values[platform.id] || ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [platform.id]: e.target.value }))
                    }
                    onFocus={() => setFocused(platform.id)}
                    onBlur={() => setFocused(null)}
                    placeholder={platform.placeholder}
                    aria-label={platform.label}
                    className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint/60 focus:outline-none"
                  />
                  {values[platform.id] && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 rounded-full bg-success"
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="pt-6"
          >
            <button
              type="submit"
              disabled={!isValid}
              className={`
                btn-press w-full rounded-xl px-6 py-4 text-sm font-medium
                transition-all duration-300
                ${
                  isValid
                    ? "bg-ink text-cream hover:bg-ink-light shadow-lg shadow-ink/10"
                    : "bg-cream-dark text-ink-faint cursor-not-allowed"
                }
              `}
            >
              {isValid ? (
                <span className="flex items-center justify-center gap-2">
                  Generate video
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
              ) : (
                "Add at least one profile URL"
              )}
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-xs text-ink-faint pt-2"
          >
            No account needed · Takes about 90 seconds
          </motion.p>
        </motion.form>
      </motion.div>
    </main>
  );
}
