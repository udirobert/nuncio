"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Profile } from "@/lib/claude";
import type { AgentTraceItem, CanvasProof } from "@/lib/artifacts";
import type { VideoCustomization, HeyGenAvatar, HeyGenVoice } from "@/lib/heygen";
import { VideoCustomization as VideoCustomizationComponent } from "@/components/video-customization";

interface BillingBalance {
  anonymous: boolean;
  balance: number;
  plan?: string;
  email?: string;
  transactions?: { type: string; amount: number; reason: string }[];
}

interface ScriptReviewProps {
  script: string;
  profile: Profile;
  sources?: string[];
  canvas?: CanvasProof;
  trace?: AgentTraceItem[];
  urls?: string[];
  senderBrief?: string;
  initialAvatars?: HeyGenAvatar[];
  initialVoices?: HeyGenVoice[];
  onEdit: (script: string) => void;
  onRender: (customization?: VideoCustomization) => void;
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
  canvas,
  trace,
  urls,
  senderBrief,
  initialAvatars,
  initialVoices,
  onEdit,
  onRender,
}: ScriptReviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState(script);
  const [isRevealed, setIsRevealed] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const runCreditSummary = useMemo(() => {
    const sourceCount = Math.max(1, urls?.length || sources?.length || 1);
    return {
      researchCredits: sourceCount,
      scriptRequests: 1,
      canvasSessions: canvas ? 1 : 0,
      renderCredits: 5,
    };
  }, [canvas, sources?.length, urls?.length]);

  const [billingBalance, setBillingBalance] = useState<BillingBalance | null>(null);
  const hasInsufficientRenderCredits =
    billingBalance?.anonymous === false && billingBalance.balance < runCreditSummary.renderCredits;

  // Trigger reveal after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsRevealed(true), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialBalance() {
      try {
        const res = await fetch("/api/billing/balance");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBillingBalance(data);
      } catch {
        // Balance is helpful UI, not required for review.
      }
    }

    loadInitialBalance();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTtsPreview() {
    if (ttsPlaying && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      setTtsPlaying(false);
      return;
    }
    if (ttsAudioUrl) {
      const audio = new Audio(ttsAudioUrl);
      audio.onended = () => setTtsPlaying(false);
      ttsAudioRef.current = audio;
      audio.play().catch(() => {});
      setTtsPlaying(true);
      return;
    }
    setTtsLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editedScript }),
      });
      if (res.ok) {
        const data = await res.json();
        setTtsAudioUrl(data.audio);
        const audio = new Audio(data.audio);
        audio.onended = () => setTtsPlaying(false);
        ttsAudioRef.current = audio;
        audio.play().catch(() => {});
        setTtsPlaying(true);
      }
    } catch (error) {
      console.error("[tts] Preview failed:", error);
    }
    setTtsLoading(false);
  }

  function handleSaveEdit() {
    onEdit(editedScript);
    setIsEditing(false);
  }

  function renderWithCurrentState() {
    if (isEditing) {
      onEdit(editedScript);
    }
    onRender(videoCustomization);
  }

  function handleRender() {
    if (billingBalance?.anonymous !== false) {
      setShowAccountGate(true);
      return;
    }
    if (hasInsufficientRenderCredits) {
      window.location.assign("/pricing");
      return;
    }
    renderWithCurrentState();
  }

  async function handleCreateAccountAndRender() {
    setAccountLoading(true);
    setAccountError(null);

    try {
      const res = await fetch("/api/account/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not create account session");
      }
      setBillingBalance({
        anonymous: false,
        balance: data.balance,
        plan: data.plan,
        email: data.email,
      });
      setShowAccountGate(false);
      renderWithCurrentState();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not create account session");
    } finally {
      setAccountLoading(false);
    }
  }

  const [videoCustomization, setVideoCustomization] = useState<VideoCustomization | undefined>();
  const handleCustomize = (c: VideoCustomization) => {
    setVideoCustomization(c);
  };

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

        {/* Credit usage */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="mb-6 rounded-xl border border-cream-dark bg-cream-dark/25 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
              Credit usage
            </p>
            <span className="text-[10px] text-ink-faint">
              {billingBalance
                ? `${billingBalance.anonymous ? "Trial" : billingBalance.plan || "Account"} balance: ${billingBalance.balance} credits`
                : `Tracked to ${profile.name || "this profile"}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <span className="rounded-lg bg-white px-3 py-2 text-ink-muted">
              Est. used {runCreditSummary.researchCredits} research credit{runCreditSummary.researchCredits === 1 ? "" : "s"}
            </span>
            <span className="rounded-lg bg-white px-3 py-2 text-ink-muted">
              Est. used {runCreditSummary.scriptRequests} script credit
            </span>
            <span className="rounded-lg bg-white px-3 py-2 text-ink-muted">
              Est. used {runCreditSummary.canvasSessions} canvas credit{runCreditSummary.canvasSessions === 1 ? "" : "s"}
            </span>
            <span className="rounded-lg bg-white px-3 py-2 text-ink-muted">
              Next: {runCreditSummary.renderCredits} render credits
            </span>
          </div>
          <p className="mt-2 text-[10px] text-ink-faint">
            {billingBalance
              ? `After render: ${Math.max(0, billingBalance.balance - runCreditSummary.renderCredits)} credits.`
              : "Balance loads from the account ledger when a session is available."}{" "}
            ElevenLabs previews only spend when you click Hear it or preview a vibe.
          </p>
        </motion.div>

        <AnimatePresence>
          {showAccountGate && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="mb-6 overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft/25 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-accent">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1.75l5 2.25v3.5c0 3.2-2.1 5.8-5 6.75-2.9-.95-5-3.55-5-6.75V4l5-2.25z" />
                    <path d="M5.5 8.25l1.75 1.75L10.75 6.5" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Save this render to an account</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Add an email to attach trial credits and this render history to your workspace before spending {runCreditSummary.renderCredits} credits.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="min-w-0 flex-1 rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
                    />
                    <button
                      onClick={handleCreateAccountAndRender}
                      disabled={accountLoading}
                      className="btn-press rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-all hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {accountLoading ? "Saving..." : "Save & render"}
                    </button>
                  </div>
                  {accountError && (
                    <p className="mt-2 text-xs text-error">{accountError}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  onChange={(e) => {
                    setEditedScript(e.target.value);
                    setTtsAudioUrl(null);
                  }}
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
            <div className="flex items-center gap-3">
              <button
                onClick={handleTtsPreview}
                disabled={ttsLoading || !editedScript.trim()}
                className="text-[11px] text-accent hover:text-accent/80 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {ttsLoading ? (
                  <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
                ) : ttsPlaying ? (
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                    <rect x="3" y="3" width="4" height="10" rx="1" />
                    <rect x="9" y="3" width="4" height="10" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 6.5v3a1 1 0 001 1h1.5l3 2.5V3L5.5 5.5H4a1 1 0 00-1 1z" />
                    <path d="M10 5.5c.7.7.7 5.3 0 5M12 4c1.3 1.3 1.3 7.7 0 8" />
                  </svg>
                )}
                {ttsLoading ? "Generating..." : ttsPlaying ? "Stop" : "Hear it"}
              </button>
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
          </div>
        </motion.div>

        {/* Agent trace + creative proof */}
        {(trace?.length || canvas) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-2xl border border-cream-dark bg-cream-dark/25 p-4 mb-6"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
                Agent trace
              </p>
              {canvas && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-ink-faint border border-cream-dark">
                  {canvas.provider === "melius" ? "Melius MCP" : `${canvas.provider} provider`}
                  {` · ${canvas.assetCount} asset${canvas.assetCount === 1 ? "" : "s"}`}
                </span>
              )}
            </div>

            {trace && trace.length > 0 && (
              <div className="space-y-2">
                {trace.slice(0, 5).map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex gap-2.5">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.status === "warning" ? "bg-warm" : "bg-success"
                      }`}
                    />
                    <div>
                      <p className="text-xs font-medium text-ink">{item.label}</p>
                      <p className="text-xs text-ink-muted leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canvas?.canvasUrl && (
              <a
                href={canvas.canvasUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Open creative canvas
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M9 2h5v5M8 8l6-6" />
                </svg>
              </a>
            )}
          </motion.div>
        )}

        {/* Customization panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <VideoCustomizationComponent
            onCustomize={handleCustomize}
            initialAvatars={initialAvatars}
            initialVoices={initialVoices}
          />
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
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
            onClick={() => {
              sessionStorage.setItem(
                "nuncio_studio_bridge",
                JSON.stringify({ url: urls?.[0] || "", brief: senderBrief || "" })
              );
              window.location.href = "/studio";
            }}
            className="btn-press rounded-2xl border border-cream-dark px-5 py-4 text-sm font-medium text-ink-muted hover:text-ink hover:bg-cream-dark/50 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zM11.5 8.5l-3-3-3 3M8.5 5.5v8" />
              </svg>
              Build in Studio
            </span>
          </button>
          <button
            onClick={handleRender}
            disabled={wordCount > 200}
            className={`btn-press flex-[2] rounded-2xl px-5 py-4 text-sm font-medium transition-all ${
              wordCount > 200
                ? "bg-cream-dark text-ink-faint cursor-not-allowed"
                : "bg-ink text-cream hover:bg-ink-light shadow-xl shadow-ink/15 hover:shadow-2xl hover:shadow-ink/20 hover:-translate-y-0.5"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {hasInsufficientRenderCredits ? "Buy credits" : "Render video"}
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
          {wordCount > 200
            ? `Script is ${wordCount} words — shorten to 200 or fewer to render`
            : `Rendering takes ~60 seconds · Uses ${runCreditSummary.renderCredits} credits`}
        </motion.p>
      </motion.div>
    </main>
  );
}
