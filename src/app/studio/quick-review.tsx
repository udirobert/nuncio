"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Profile } from "@/lib/claude";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import { AngleCards } from "@/components/angle-cards";

interface QuickReviewProps {
  profile: Profile | null;
  script: string;
  senderName: string;
  onBuild: () => void;
  onRegenerate: (adjustments?: string) => void;
  onBack: () => void;
  onToggleMode: () => void;
  regenerating: boolean;
  translateEnabled: boolean;
  onToggleTranslate: () => void;
  onLanguageChange: (code: string) => void;
}

export function QuickReview({
  profile,
  script,
  senderName,
  onBuild,
  onRegenerate,
  onBack,
  onToggleMode,
  regenerating,
  translateEnabled,
  onToggleTranslate,
  onLanguageChange,
}: QuickReviewProps) {
  const [editing, setEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script);
  const [copied, setCopied] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [adjustments, setAdjustments] = useState("");
  const [selectedAngleId, setSelectedAngleId] = useState<string | undefined>(
    profile?.suggestedAngles?.[0]?.id
  );
  const currentScript = editing ? editedScript : script;
  const wordCount = currentScript.split(/\s+/).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <section className="relative px-6 pt-28 pb-16">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-[11px] uppercase tracking-widest text-ink-faint hover:text-ink transition-colors flex items-center gap-1.5"
            >
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4L6 8l4 4" />
              </svg>
              Back
            </button>
            <button
              onClick={onToggleMode}
              className="text-[11px] text-ink-faint hover:text-accent transition-colors"
            >
              Switch to Advanced
            </button>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Review the script
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              For {profile?.name || "your recipient"}. Edit or regenerate before building the video.
            </p>
            {senderName && (
              <p className="text-xs text-ink-faint mt-1">
                Signing off as {senderName}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
            {editing ? (
              <textarea
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-cream-dark/70 bg-cream/30 px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all font-[family-name:var(--font-geist-sans)]"
              />
            ) : (
              <p className="text-sm text-ink-light leading-relaxed whitespace-pre-wrap">
                {script}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-cream-dark">
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-medium ${
                  wordCount > 200 ? "text-error" : wordCount > 180 ? "text-warm" : "text-ink-muted"
                }`}>
                  {wordCount} words · ~{Math.round(wordCount / 2.5)}s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentScript);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-[11px] uppercase tracking-widest text-ink-faint hover:text-accent transition-colors"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setEditing(!editing)}
                  className="text-[11px] uppercase tracking-widest text-ink-faint hover:text-accent transition-colors"
                >
                  {editing ? "Done editing" : "Edit"}
                </button>
                <button
                  onClick={() => onRegenerate(adjustments.trim() || undefined)}
                  disabled={regenerating}
                  className="text-[11px] uppercase tracking-widest text-ink-faint hover:text-accent transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  {regenerating ? (
                    <>
                      <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      Regenerating
                    </>
                  ) : (
                    "Regenerate"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cream-dark/70 bg-white/60 overflow-hidden">
            <button
              onClick={() => setPersonalizeOpen(!personalizeOpen)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2l2 2-8 8H4v-2l8-8z" />
                </svg>
                <span className="text-xs font-medium text-ink-muted">Personalize further</span>
              </div>
              <svg
                viewBox="0 0 16 16"
                className={`w-3 h-3 text-ink-faint transition-transform ${personalizeOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {personalizeOpen && (
              <div className="px-5 pb-4 space-y-3 border-t border-cream-dark/50">
                <p className="text-[11px] text-ink-faint pt-3">
                  Tell the agent what to change and hit regenerate.
                </p>
                <textarea
                  value={adjustments}
                  onChange={(e) => setAdjustments(e.target.value)}
                  placeholder="e.g. Make it more casual, mention their recent podcast, focus on the partnership angle…"
                  rows={3}
                  className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                />
                <button
                  onClick={() => onRegenerate(adjustments.trim() || undefined)}
                  disabled={regenerating || !adjustments.trim()}
                  className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-2 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
                >
                  {regenerating ? "Regenerating…" : "Regenerate with changes"}
                </button>
              </div>
            )}
          </div>

          {profile && (
            <div className="rounded-2xl border border-cream-dark bg-white p-4 space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
                About {profile.name}
              </span>
              <p className="text-xs text-ink-muted leading-relaxed">
                {[profile.current_role, profile.company && `at ${profile.company}`].filter(Boolean).join(" ")}
              </p>
              {profile.language && profile.language !== "en" && (
                <span className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-cream-dark text-ink-muted">
                  {languageLabel(profile.language)} · auto-detected
                </span>
              )}
            {profile.outreach_intent?.goal && (
              <div className="rounded-xl border border-warm/20 bg-warm-soft/40 p-3">
                <span className="text-[10px] uppercase tracking-widest text-warm font-medium">Outreach goal</span>
                <p className="text-xs text-ink-muted mt-1">{profile.outreach_intent.goal}</p>
                {profile.outreach_intent.desiredOutcome && (
                  <p className="text-[11px] text-ink-faint mt-1">Desired outcome: {profile.outreach_intent.desiredOutcome}</p>
                )}
              </div>
            )}
            {profile.suggestedAngles && profile.suggestedAngles.length > 0 ? (
              <div className="pt-2">
                <AngleCards
                  angles={profile.suggestedAngles}
                  selectedAngleId={selectedAngleId}
                  onSelect={(angle) => setSelectedAngleId(angle.id)}
                />
              </div>
            ) : profile.relevance_signals && profile.relevance_signals.length > 0 ? (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">Why this person fits</span>
                {profile.relevance_signals.slice(0, 3).map((signal, i) => (
                  <div key={i} className="rounded-xl border border-accent/15 bg-accent-soft/30 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-accent">{signal.label}</span>
                      <span className="text-[10px] text-ink-faint uppercase">{signal.confidence}</span>
                    </div>
                    <p className="text-[11px] text-ink-muted">{signal.relevanceToOutreach}</p>
                    <p className="text-[10px] text-ink-faint">{signal.evidence}</p>
                  </div>
                ))}
              </div>
            ) : null}
              {profile.language && profile.language !== "en" && (
                <div className="flex items-center justify-between pt-2 border-t border-cream-dark">
                  <div className="flex items-center gap-2">
                    <select
                      value={profile.language}
                      onChange={(e) => onLanguageChange(e.target.value)}
                      className="text-[11px] rounded-md border border-cream-dark px-2 py-1 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                    <span className="text-[10px] text-ink-faint">· auto-detected</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-ink-faint cursor-pointer select-none">
                    <span className={translateEnabled ? "text-warm" : "text-ink-faint"}>
                      {translateEnabled ? `Translate` : `English`}
                    </span>
                    <button
                      onClick={onToggleTranslate}
                      className={`relative w-8 h-4 rounded-full transition-colors ${
                        translateEnabled ? "bg-warm" : "bg-cream-dark"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          translateEnabled ? "translate-x-4" : ""
                        }`}
                      />
                    </button>
                  </label>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onBuild}
            className="btn-press w-full rounded-xl bg-ink text-cream py-3.5 text-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
          >
            Build final video
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </section>
    </motion.div>
  );
}
