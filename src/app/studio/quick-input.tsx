"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface QuickInputProps {
  url: string;
  setUrl: (v: string) => void;
  senderName: string;
  setSenderName: (v: string) => void;
  senderBrief: string;
  setSenderBrief: (v: string) => void;
  senderBusiness: string;
  setSenderBusiness: (v: string) => void;
  outreachGoal: string;
  setOutreachGoal: (v: string) => void;
  onEnrich: () => void;
  onToggleMode: () => void;
  onOpenVoice: () => void;
  detectedLanguage?: string | null;
  detectingLanguage?: boolean;
  translateEnabled: boolean;
  onToggleTranslate: () => void;
  voicePopulatedFields?: Set<string>;
}

export function QuickInput({
  url,
  setUrl,
  senderName,
  setSenderName,
  senderBrief,
  setSenderBrief,
  senderBusiness,
  setSenderBusiness,
  outreachGoal,
  setOutreachGoal,
  onEnrich,
  onToggleMode,
  onOpenVoice,
  detectedLanguage,
  detectingLanguage,
  translateEnabled,
  onToggleTranslate,
  voicePopulatedFields = new Set(),
}: QuickInputProps) {
  const [moreOpen, setMoreOpen] = useState(false);

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
            <div className="flex items-center justify-center gap-2 pt-2 text-[10px] uppercase tracking-widest text-ink-faint">
              <span className="text-accent">Brief</span>
              <span>→</span>
              <span>Review</span>
              <span>→</span>
              <span>Build</span>
              <span>→</span>
              <span>Share</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-accent/25 bg-gradient-to-br from-accent-soft/70 via-white to-warm-soft/40 p-5 shadow-sm space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="relative w-12 h-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-sm shrink-0">
                  <span className="absolute inset-0 rounded-2xl bg-accent animate-ping opacity-15" />
                  <svg viewBox="0 0 16 16" className="relative w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                    <path d="M3 8a5 5 0 0010 0M8 13v2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-medium text-ink">Talk to your video agent</p>
                    <span className="rounded-full bg-white/70 border border-accent/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-accent">
                      Speech Engine
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    Tell Nuncio who you want to reach and it will fill the brief for you.
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenVoice}
                className="btn-press w-full rounded-xl bg-accent text-white py-3.5 text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                Start voice brief
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </button>
              <p className="text-[11px] text-ink-faint text-center">
                or paste a profile URL below
              </p>
            </div>

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

            <div className="rounded-2xl border border-cream-dark/70 bg-white/60 overflow-hidden">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="w-full flex items-center justify-between px-5 py-3 text-left"
              >
                <span className="text-xs font-medium text-ink-muted">More context (optional)</span>
                <svg
                  viewBox="0 0 16 16"
                  className={`w-3 h-3 text-ink-faint transition-transform ${moreOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              {moreOpen && (
                <div className="px-5 pb-4 space-y-3 border-t border-cream-dark/50 pt-3">
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
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                      Your business <span className="normal-case text-ink-faint">— what are you building or selling?</span>
                    </label>
                    <input
                      type="text"
                      value={senderBusiness}
                      onChange={(e) => setSenderBusiness(e.target.value)}
                      placeholder="e.g. AI outreach studio for personalised videos"
                      className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                      Goal <span className="normal-case text-ink-faint">— what outcome do you want from this outreach?</span>
                    </label>
                    <input
                      type="text"
                      value={outreachGoal}
                      onChange={(e) => setOutreachGoal(e.target.value)}
                      placeholder="e.g. book a demo, get feedback, open a partnership conversation"
                      className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {detectingLanguage && (
              <span className="text-[10px] text-ink-faint animate-pulse inline-block">
                Detecting language…
              </span>
            )}
            {detectedLanguage && !detectingLanguage && (
              <div className="rounded-xl border border-warm/20 bg-warm-soft/40 p-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-ink-muted">
                  {detectedLanguage === "en" ? "English detected." : `${detectedLanguage.toUpperCase()} detected. Script stays English unless you choose otherwise.`}
                </span>
                {detectedLanguage !== "en" && (
                  <button
                    onClick={onToggleTranslate}
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                      translateEnabled ? "bg-warm text-white" : "bg-white text-warm border border-warm/20"
                    }`}
                  >
                    {translateEnabled ? `Using ${detectedLanguage.toUpperCase()}` : `Use ${detectedLanguage.toUpperCase()}`}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onEnrich}
              disabled={!url.trim()}
              className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
            >
              Research & write script
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
