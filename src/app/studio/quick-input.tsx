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
  const [moreOpen, setMoreOpen] = useState(true);

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
                High-value outreach · human reviewed
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl tracking-tight leading-[1.02]">
              Make the next account
              <br />
              <span className="text-ink-muted">count.</span>
            </h1>
            <div className="flex items-center justify-center gap-2 pt-2 text-[10px] uppercase tracking-widest text-ink-faint">
              <span className="text-accent">Account</span>
              <span>→</span>
              <span>Reason</span>
              <span>→</span>
              <span>Review</span>
              <span>→</span>
              <span>Send</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-soft/45 via-white to-warm-soft/25 p-4 shadow-sm text-left">
              <div className="flex items-start gap-3">
                <div className="relative w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm shrink-0">
                  <svg viewBox="0 0 16 16" className="relative w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 2v8M5 6v4a3 3 0 006 0V6" />
                    <path d="M3 8a5 5 0 0010 0M8 13v2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">Prefer to talk it through?</p>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                    Use voice to fill this brief faster. You will still review the message before building.
                  </p>
                </div>
              </div>
              <button onClick={onOpenVoice} className="btn-press text-xs font-medium text-accent hover:text-accent/80 transition-colors flex items-center gap-1.5">
                Brief with voice
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                Who is this for?
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste their LinkedIn, X, or website URL"
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
                  { label: "Example: B2B founder", url: "https://x.com/timgl" },
                  { label: "Example: product leader", url: "https://ca.linkedin.com/in/yekeh" },
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
                <span className="text-xs font-medium text-ink-muted">Why should this conversation happen?</span>
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
                      What is your reason to reach out? <span className="normal-case text-ink-faint">— make it specific</span>
                    </label>
                    <textarea
                      value={senderBrief}
                      onChange={(e) => setSenderBrief(e.target.value)}
                      placeholder="e.g. Their team is scaling payments infrastructure and I have a relevant idea for reducing reconciliation work…"
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
                      Your offer <span className="normal-case text-ink-faint">— what can you genuinely help with?</span>
                    </label>
                    <input
                      type="text"
                      value={senderBusiness}
                      onChange={(e) => setSenderBusiness(e.target.value)}
                      placeholder="e.g. We help fintech teams reduce reconciliation work"
                      className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted block mb-1.5">
                      Desired conversation <span className="normal-case text-ink-faint">— what do you want them to do next?</span>
                    </label>
                    <input
                      type="text"
                      value={outreachGoal}
                      onChange={(e) => setOutreachGoal(e.target.value)}
                      placeholder="e.g. a 20-minute discovery call or their feedback on an idea"
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
              Research account & draft a script
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
              Open full creative controls
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
