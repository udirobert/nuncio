"use client";

import { motion } from "motion/react";

interface QuickInputProps {
  url: string;
  setUrl: (v: string) => void;
  senderName: string;
  setSenderName: (v: string) => void;
  senderBrief: string;
  setSenderBrief: (v: string) => void;
  onEnrich: () => void;
  onToggleMode: () => void;
  detectedLanguage?: string | null;
  detectingLanguage?: boolean;
  voicePopulatedFields?: Set<string>;
}

export function QuickInput({
  url,
  setUrl,
  senderName,
  setSenderName,
  senderBrief,
  setSenderBrief,
  onEnrich,
  onToggleMode,
  detectedLanguage,
  detectingLanguage,
  voicePopulatedFields = new Set(),
}: QuickInputProps) {
  const voiceFlash = (field: string) =>
    voicePopulatedFields.has(field)
      ? "ring-2 ring-success/30 border-success/50 bg-success-soft/30 transition-all duration-700"
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <section className="relative px-6 pt-24 pb-16">
        <div className="max-w-lg mx-auto space-y-8">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                AI-powered · personalised video
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl tracking-tight leading-[1.02]">
              Brief an agent.
              <br />
              <span className="text-ink-muted">Get a personalised video.</span>
            </h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                Profile URL
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all ${voiceFlash("url")} ${voicePopulatedFields.has("url") ? "border-success/50" : "border-cream-dark"}`}
                onKeyDown={(e) => e.key === "Enter" && onEnrich()}
              />
              {voicePopulatedFields.has("url") && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-success">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Set by voice
                </span>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { label: "Try Sundar Pichai", url: "https://linkedin.com/in/sundarpichai" },
                  { label: "Try Vercel CEO", url: "https://x.com/rauchg" },
                ].map((example) => (
                  <button
                    key={example.label}
                    onClick={() => setUrl(example.url)}
                    className="text-[11px] text-ink-muted hover:text-accent transition-colors px-2.5 py-1 rounded-md border border-cream-dark/70 hover:border-accent/30 bg-white/60"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                Your name <span className="normal-case text-ink-faint">— how you sign off in the video</span>
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  if (typeof window !== "undefined") localStorage.setItem("nuncio_sender_name", e.target.value);
                }}
                placeholder="e.g. Udi"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all ${voiceFlash("senderName")} ${voicePopulatedFields.has("senderName") ? "border-success/50" : "border-cream-dark"}`}
              />
              {voicePopulatedFields.has("senderName") && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-success">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Set by voice
                </span>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                Context <span className="normal-case text-ink-faint">— what are you reaching out about?</span>
              </label>
              <textarea
                value={senderBrief}
                onChange={(e) => setSenderBrief(e.target.value)}
                placeholder="e.g. I'm building a payments API and would love their perspective…"
                rows={2}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all ${voiceFlash("senderBrief")} ${voicePopulatedFields.has("senderBrief") ? "border-success/50" : "border-cream-dark"}`}
              />
              {voicePopulatedFields.has("senderBrief") && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-success">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Set by voice
                </span>
              )}
            </div>

            {detectingLanguage && (
              <span className="text-[10px] text-ink-faint animate-pulse inline-block">
                Detecting language…
              </span>
            )}
            {detectedLanguage && !detectingLanguage && (
              <span className="inline-flex items-center gap-1 text-[10px] text-warm">
                <span className="w-1 h-1 rounded-full bg-warm" />
                {detectedLanguage === "en" ? "Script will be in English" : `Script will be in ${detectedLanguage.toUpperCase()}`}
              </span>
            )}

            <button
              onClick={onEnrich}
              disabled={!url.trim()}
              className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
            >
              Generate video
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={onToggleMode}
              className="text-[11px] text-ink-faint hover:text-accent transition-colors"
            >
              Switch to Advanced mode
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
