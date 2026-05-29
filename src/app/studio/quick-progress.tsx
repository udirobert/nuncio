"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type QuickProgressStep = "enrich" | "script" | "build" | "render";

export interface WaitContext {
  recipientName?: string;
  senderName?: string;
  script?: string;
  recentActivity?: string;
}

interface QuickProgressProps {
  showDetails: boolean;
  onToggleDetails: () => void;
  currentStep: QuickProgressStep;
  elapsedSeconds: number;
  videoRendering?: "idle" | "rendering" | "done" | "failed";
  waitContext?: WaitContext;
  onDraftReady?: (draft: { channel: string; message: string }) => void;
}

const STEPS = [
  { id: "enrich", label: "Researching recipient" },
  { id: "script", label: "Writing script" },
  { id: "build", label: "Preparing creative" },
  { id: "render", label: "Rendering video" },
];

const MOMENTS = [
  "Finding the sharpest personal hook",
  "Checking the script sounds natural out loud",
  "Preparing the video scene and voice",
  "Sending the render job to HeyGen",
  "HeyGen is rendering your avatar — usually 2–3 minutes",
  "You can tab away — we will move you forward automatically",
  "Great time to draft the message that will accompany your video",
  "Almost there — your personalised video is being finalised",
];

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

const MESSAGE_CHANNELS = [
  { id: "email", label: "Email", icon: "\u2709\uFE0F", placeholder: "Subject line and body..." },
  { id: "linkedin", label: "LinkedIn DM", icon: "\uD83D\uDCBC", placeholder: "Hey [Name], I put something together for you..." },
  { id: "twitter", label: "Tweet / DM", icon: "\uD83D\uDC26", placeholder: "Short and punchy..." },
  { id: "whatsapp", label: "WhatsApp", icon: "\uD83D\uDCAC", placeholder: "Quick personal note..." },
];

export function QuickProgress({
  showDetails,
  onToggleDetails,
  currentStep,
  elapsedSeconds,
  videoRendering = "idle",
  waitContext,
  onDraftReady,
}: QuickProgressProps) {
  const [momentIndex, setMomentIndex] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState("email");
  const [draftMessage, setDraftMessage] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [suggestedDraft, setSuggestedDraft] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const suggestionFetchedRef = useRef<string | null>(null);

  const fetchSuggestion = useCallback(async (channel: string) => {
    if (!waitContext?.recipientName) return;
    if (suggestionFetchedRef.current === channel) return;
    suggestionFetchedRef.current = channel;
    setSuggestionLoading(true);
    setSuggestedDraft("");
    try {
      const res = await fetch("/api/studio/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          recipientName: waitContext.recipientName,
          senderName: waitContext.senderName,
          script: waitContext.script,
          recentActivity: waitContext.recentActivity,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedDraft(data.draft || "");
      }
    } catch { /* noop */ }
    setSuggestionLoading(false);
  }, [waitContext]);

  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.id === currentStep));
  const progress = useMemo(() => {
    const base = (activeIndex / STEPS.length) * 100;
    const activeBoost = videoRendering === "rendering" ? 18 : 12;
    return Math.min(96, Math.round(base + activeBoost));
  }, [activeIndex, videoRendering]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMomentIndex((index) => (index + 1) % MOMENTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex items-center justify-center px-6"
    >
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
              Generating
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Building the final video
          </h2>
          <p className="text-sm text-ink-muted">
            Usually takes 2–3 minutes. You have waited {formatElapsed(elapsedSeconds)}.
          </p>
          <p className="text-[11px] text-ink-faint mt-1">
            You can leave this tab open and come back — we will notify you when it is ready.
          </p>
        </div>

        <div className="rounded-2xl border border-cream-dark bg-white p-4 shadow-sm space-y-3 overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-ink-faint">
            <span>Live build</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent via-warm to-success"
              initial={{ width: "8%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={momentIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-ink-light"
            >
              {MOMENTS[momentIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const isActive = i === activeIndex;
            const isComplete = i < activeIndex || (videoRendering === "done" && step.id === "render");
            const isFailed = videoRendering === "failed" && step.id === currentStep;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-white border transition-colors ${
                  isActive ? "border-accent/30 shadow-sm" : "border-cream-dark"
                }`}
              >
                {isFailed ? (
                  <span className="w-4 h-4 rounded-full bg-error-soft flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  </span>
                ) : isActive ? (
                  <span className="relative flex h-4 w-4 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-30" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-accent/20 border-2 border-accent" />
                  </span>
                ) : isComplete ? (
                  <span className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
                      <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                    </svg>
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-cream-dark shrink-0" />
                )}
                <span className={`text-sm ${
                  isActive ? "text-ink font-medium" : isComplete ? "text-ink-muted" : "text-ink-faint"
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ─── Message Composer ──────────────────────────── */}
        {currentStep === "render" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-accent/20 bg-white p-4 space-y-3"
          >
            <button
              onClick={() => {
                const opening = !showComposer;
                setShowComposer(opening);
                if (opening && !draftMessage) fetchSuggestion(selectedChannel);
              }}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">\u270D\uFE0F</span>
                <span className="text-xs font-medium text-ink">Draft your send message</span>
              </div>
              <span className="text-[10px] text-accent font-medium">
                {showComposer ? "Collapse" : "While you wait"}
              </span>
            </button>

            <AnimatePresence>
              {showComposer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-3"
                >
                  <p className="text-[11px] text-ink-muted">
                    Write the message that will accompany your video. We will save it for when the video is ready.
                  </p>

                  {/* Channel selector */}
                  <div className="flex gap-1.5 flex-wrap">
                    {MESSAGE_CHANNELS.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => { setSelectedChannel(ch.id); suggestionFetchedRef.current = null; setSuggestedDraft(""); if (!draftMessage) fetchSuggestion(ch.id); }}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition-all ${
                          selectedChannel === ch.id
                            ? "border-accent bg-accent-soft/40 text-accent font-medium"
                            : "border-cream-dark text-ink-muted hover:border-ink-faint/30"
                        }`}
                      >
                        {ch.icon} {ch.label}
                      </button>
                    ))}
                  </div>

                  {/* AI suggestion */}
                  {suggestionLoading && (
                    <div className="flex items-center gap-2 text-[11px] text-ink-faint animate-pulse">
                      <span className="inline-block w-3 h-3 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                      Drafting a suggestion...
                    </div>
                  )}
                  {suggestedDraft && !draftMessage && (
                    <div className="rounded-xl border border-accent/15 bg-accent-soft/20 p-3 space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-accent/70 font-medium">AI suggestion</p>
                      <p className="text-xs text-ink-light leading-relaxed whitespace-pre-wrap">{suggestedDraft}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDraftMessage(suggestedDraft)}
                          className="text-[11px] text-accent font-medium hover:text-accent/80 transition-colors"
                        >
                          Use this
                        </button>
                        <button
                          onClick={() => { suggestionFetchedRef.current = null; fetchSuggestion(selectedChannel); }}
                          className="text-[11px] text-ink-faint hover:text-ink-muted transition-colors"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Draft textarea */}
                  <textarea
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    placeholder={MESSAGE_CHANNELS.find((c) => c.id === selectedChannel)?.placeholder || "Write your message..."}
                    className="w-full h-24 rounded-xl border border-cream-dark bg-cream/30 p-3 text-sm text-ink placeholder:text-ink-faint/60 resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
                  />

                  {/* Tips based on context */}
                  {waitContext?.recipientName && (
                    <div className="rounded-lg bg-cream-dark/30 p-2.5">
                      <p className="text-[10px] text-ink-faint">
                        <span className="font-medium">Tip:</span> Mention why now is the right time to reach {waitContext.recipientName}.
                        {waitContext.recentActivity && " You could reference their recent activity."}
                      </p>
                    </div>
                  )}

                  {draftMessage.length > 10 && onDraftReady && (
                    <button
                      onClick={() => onDraftReady({ channel: selectedChannel, message: draftMessage })}
                      className="text-[11px] text-accent font-medium hover:text-accent/80 transition-colors"
                    >
                      \u2713 Save draft
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── Recipient Quiz (from recent activity) ──────── */}
        {currentStep === "render" && waitContext?.recentActivity && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl border border-warm/20 bg-white p-4 space-y-3"
          >
            <button
              onClick={() => setShowQuiz(!showQuiz)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">\uD83E\uDDE0</span>
                <span className="text-xs font-medium text-ink">
                  How well do you know {waitContext.recipientName || "them"}?
                </span>
              </div>
              <span className="text-[10px] text-warm font-medium">
                {showQuiz ? "Collapse" : "Quick quiz"}
              </span>
            </button>

            <AnimatePresence>
              {showQuiz && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg bg-warm-soft/30 p-3 space-y-2">
                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      Based on their recent public activity:
                    </p>
                    <div className="text-xs text-ink-light leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {waitContext.recentActivity.slice(0, 600)}
                    </div>
                    <p className="text-[10px] text-ink-faint pt-1">
                      Use these insights to personalise your send message above.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-cream-dark bg-cream/60 p-4 space-y-2"
          >
            <p className="text-xs font-medium text-ink">What is happening now</p>
            <p className="text-xs leading-relaxed text-ink-muted">
              Nuncio has your brief and script. This step prepares the video creative, starts the HeyGen render, checks status every few seconds, and moves you forward automatically when the MP4 is ready.
            </p>
          </motion.div>
        )}

        <div className="text-center">
          <button
            onClick={onToggleDetails}
            className="text-[11px] text-ink-faint hover:text-accent transition-colors flex items-center gap-1 mx-auto"
          >
            <svg
              viewBox="0 0 16 16"
              className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
