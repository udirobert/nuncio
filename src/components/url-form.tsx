"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import { VoiceInput } from "@/components/voice-input";
import { IntentChips, type IntentId } from "@/components/intent-chips";
import { trackExampleClicked } from "@/lib/analytics";

interface UrlFormProps {
  onSubmit: (urls: string[], senderBrief?: string, intent?: IntentId) => void;
}

interface UrlEntry {
  id: string;
  value: string;
  platform: Platform | null;
}

type Platform = "linkedin" | "twitter" | "github" | "farcaster" | "facebook" | "other";

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  linkedin: { label: "LinkedIn", color: "text-[#0A66C2]" },
  twitter: { label: "X", color: "text-ink" },
  github: { label: "GitHub", color: "text-ink" },
  farcaster: { label: "Farcaster", color: "text-[#8B5CF6]" },
  facebook: { label: "Facebook", color: "text-[#1877F2]" },
  other: { label: "Profile", color: "text-ink-muted" },
};

interface Example {
  label: string;
  name: string;
  description: string;
  urls: string[];
  brief: string;
  intent: IntentId;
}

const EXAMPLES: Example[] = [
  {
    label: "HeyGen PM",
    name: "Onee Yekeh",
    description: "Ask for feedback on developer-facing video agents.",
    urls: ["https://ca.linkedin.com/in/yekeh"],
    brief:
      "I'm building nuncio, an agentic video personalization pipeline that uses HeyGen to turn public profile context into a short, tailored outreach video. I'd love feedback from a HeyGen product perspective on making developer-facing video agents feel genuinely useful and not like generic automation.",
    intent: "warm_intro",
  },
  {
    label: "PostHog founder",
    name: "Tim Glaser",
    description: "Pitch an analytics-aware outreach workflow.",
    urls: ["https://x.com/timgl"],
    brief:
      "I'm building nuncio, a personalized video outreach agent for founders and growth teams. I'd love feedback from a PostHog perspective on using product context and behavioral signals to make outreach feel more useful, measurable, and less spammy.",
    intent: "founder_to_founder",
  },
  {
    label: "Fal founder",
    name: "Gorkem Yurtseven",
    description: "Explore generative media as creative infrastructure.",
    urls: ["https://x.com/gorkem"],
    brief:
      "I'm building nuncio, an agentic video pipeline that can use generative media assets to make personalized business videos feel more cinematic. I'd love feedback from a Fal perspective on fast, scalable creative generation inside developer workflows.",
    intent: "founder_to_founder",
  },
];

function detectPlatform(url: string): Platform | null {
  if (!url.trim()) return null;
  const lower = url.toLowerCase();
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "twitter";
  if (lower.includes("github.com")) return "github";
  if (lower.includes("warpcast.com") || lower.includes("farcaster")) return "farcaster";
  if (lower.includes("facebook.com") || lower.includes("fb.com")) return "facebook";
  if (lower.startsWith("http")) return "other";
  return null;
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const icons: Record<Platform, React.ReactNode> = {
    linkedin: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    twitter: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    github: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    farcaster: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M18.24 2.4H5.76a3.36 3.36 0 00-3.36 3.36v12.48a3.36 3.36 0 003.36 3.36h12.48a3.36 3.36 0 003.36-3.36V5.76a3.36 3.36 0 00-3.36-3.36zm-1.2 13.68c0 .66-.54 1.2-1.2 1.2h-7.68c-.66 0-1.2-.54-1.2-1.2v-4.8h2.4v3.6h5.28v-3.6h2.4v4.8zm0-6h-2.4V8.52H9.36v1.56h-2.4V7.68c0-.66.54-1.2 1.2-1.2h7.68c.66 0 1.2.54 1.2 1.2v2.4z" />
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    other: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  };
  return <>{icons[platform]}</>;
}

export function UrlForm({ onSubmit }: UrlFormProps) {
  return (
    <Suspense fallback={null}>
      <UrlFormInner onSubmit={onSubmit} />
    </Suspense>
  );
}

function UrlFormInner({ onSubmit }: UrlFormProps) {
  // SSR + first client render: always empty (no hydration mismatch)
  const [entries, setEntries] = useState<UrlEntry[]>([
    { id: "1", value: "", platform: null },
  ]);
  const [senderBrief, setSenderBrief] = useState("");
  const [intent, setIntent] = useState<IntentId | null>(null);
  const [justPasted, setJustPasted] = useState<string | null>(null);

  // Pre-fill from query params AFTER mount (works for both hard nav and soft nav)
  const params = useSearchParams();
  useEffect(() => {
    const url = params.get("url");
    const brief = params.get("brief");
    const i = params.get("intent") as IntentId | null;

    if (url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from URL params (external source)
      setEntries([
        { id: "1", value: url, platform: detectPlatform(url) },
        { id: "2", value: "", platform: null },
      ]);
    }
    if (brief) setSenderBrief(brief);
    if (i) setIntent(i);
  }, [params]);

  function handleIntentChange(next: IntentId | null, stem: string) {
    setIntent(next);
    // Only seed the textarea when it's empty — never clobber what the user typed.
    if (next && stem && !senderBrief.trim()) {
      setSenderBrief(stem);
    }
  }

  // Demo mode detection
  const isDemoActive = params.get("demo") === "true";

  function handleDemoFill() {
    applyExample(EXAMPLES[0]);
  }

  function applyExample(example: Example) {
    setEntries([
      ...example.urls.map((url, index) => ({
        id: String(index + 1),
        value: url,
        platform: detectPlatform(url),
      })),
      { id: String(example.urls.length + 1), value: "", platform: null },
    ]);
    setSenderBrief(example.brief);
    setIntent(example.intent);
    trackExampleClicked({ exampleName: example.name, source: "home" });
  }

  const validUrls = entries
    .filter((e) => e.value.trim() && e.platform)
    .map((e) => e.value.trim());
  const isValid = validUrls.length > 0;

  const handleChange = useCallback((id: string, value: string) => {
    setEntries((prev) => {
      const updated = prev.map((e) =>
        e.id === id ? { ...e, value, platform: detectPlatform(value) } : e
      );
      // Auto-add new row when last row has content
      const lastEntry = updated[updated.length - 1];
      if (lastEntry && lastEntry.value.trim() && updated.length < 5) {
        return [...updated, { id: String(Date.now()), value: "", platform: null }];
      }
      return updated;
    });
  }, []);

  const handlePaste = useCallback(
    (id: string, e: React.ClipboardEvent) => {
      const pasted = e.clipboardData.getData("text");
      if (pasted && detectPlatform(pasted)) {
        setJustPasted(id);
        setTimeout(() => setJustPasted(null), 600);
      }
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      return filtered.length === 0
        ? [{ id: String(Date.now()), value: "", platform: null }]
        : filtered;
    });
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) {
      onSubmit(validUrls, senderBrief.trim() || undefined, intent ?? undefined);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && isValid) {
      e.preventDefault();
      onSubmit(validUrls, senderBrief.trim() || undefined, intent ?? undefined);
    }
  }

  return (
    <div className="w-full px-6 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[540px]"
        onKeyDown={handleKeyDown}
      >
        {/* Brand header */}
        <div className="mb-8 lg:mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-display)] text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-3"
          >
            Send a video
            <br />
            <span className="italic">they&apos;ll actually watch</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-ink-muted text-[14px] leading-relaxed max-w-[380px]"
          >
            Paste their profile. We&apos;ll research them, write a personalised
            script, and render a video in your voice — in about 90 seconds.
          </motion.p>
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* URL inputs */}
          <div className="space-y-2 mb-3">
            <AnimatePresence mode="popLayout">
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className={`
                      relative flex items-center gap-3 rounded-2xl border px-4 py-3.5
                      transition-all duration-300
                      ${justPasted === entry.id ? "scale-[1.02] border-accent bg-accent-soft/30" : ""}
                      ${entry.platform ? "border-cream-dark bg-white shadow-sm" : "border-cream-dark bg-cream-dark/40"}
                    `}
                    style={{
                      transform: justPasted === entry.id ? "scale(1.02)" : undefined,
                    }}
                  >
                    {/* Platform icon */}
                    <AnimatePresence mode="wait">
                      {entry.platform ? (
                        <motion.span
                          key={entry.platform}
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          className={PLATFORM_CONFIG[entry.platform].color}
                        >
                          <PlatformIcon platform={entry.platform} />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="empty"
                          className="text-ink-faint/40"
                        >
                          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6 3h4a4 4 0 010 8H6a4 4 0 010-8z" />
                            <path d="M8 5v6" />
                          </svg>
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Input */}
                    <input
                      type="url"
                      value={entry.value}
                      onChange={(e) => handleChange(entry.id, e.target.value)}
                      onPaste={(e) => handlePaste(entry.id, e)}
                      placeholder={i === 0 ? "Paste a profile URL..." : "Add another profile..."}
                      aria-label={`Profile URL ${i + 1}`}
                      className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint/50 focus:outline-none"
                    />

                    {/* Platform badge */}
                    <AnimatePresence>
                      {entry.platform && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="text-[10px] uppercase tracking-wider text-ink-faint font-medium"
                        >
                          {PLATFORM_CONFIG[entry.platform].label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Remove button */}
                    {entry.value && entries.length > 1 && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        type="button"
                        onClick={() => handleRemove(entry.id)}
                        className="text-ink-faint hover:text-ink transition-colors p-0.5"
                        aria-label="Remove URL"
                      >
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Inline example loaders — small text links, not big cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.4 }}
            className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint"
          >
            <span>or try</span>
            {EXAMPLES.map((example, i) => (
              <span key={example.name} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyExample(example)}
                  className="text-accent hover:text-accent/80 hover:underline underline-offset-2 transition-colors"
                  title={example.description}
                >
                  {example.name}
                </button>
                {i < EXAMPLES.length - 1 && <span className="text-ink-faint/40">·</span>}
              </span>
            ))}
          </motion.div>

          {/* Intent chips — pick a genre, get a sharper script */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <IntentChips value={intent} onChange={handleIntentChange} />
          </motion.div>

          {/* Sender brief — always visible, lightweight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-5"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs uppercase tracking-widest text-ink-faint font-medium">
                What&apos;s your message about?
              </label>
              <VoiceInput
                onTranscript={(text) =>
                  setSenderBrief((prev) => (prev ? `${prev} ${text}` : text))
                }
                placeholder="Record instead"
              />
            </div>
            <textarea
              value={senderBrief}
              onChange={(e) => setSenderBrief(e.target.value)}
              placeholder="e.g. I'm building a payments API and want to connect about their experience at Stripe..."
              rows={2}
              className="w-full rounded-xl border border-cream-dark bg-cream-dark/30 px-4 py-3 text-sm text-ink placeholder:text-ink-faint/50 focus:outline-none focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10 resize-none transition-all"
            />
            <p className="text-[11px] text-ink-faint mt-1.5">
              Helps the script feel specific. Leave blank for a general intro.
            </p>
          </motion.div>

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <button
              type="submit"
              disabled={!isValid}
              className={`
                btn-press w-full rounded-2xl px-6 py-4 text-sm font-medium
                transition-all duration-300 relative overflow-hidden
                ${
                  isValid
                    ? "bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:shadow-ink/20 hover:-translate-y-0.5"
                    : "bg-cream-dark text-ink-faint cursor-not-allowed"
                }
              `}
            >
              <AnimatePresence mode="wait">
                {isValid ? (
                  <motion.span
                    key="ready"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center justify-center gap-2"
                  >
                    Generate video
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </motion.span>
                ) : (
                  <motion.span
                    key="waiting"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    Paste a profile URL to begin
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {isValid && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[11px] text-ink-faint mt-3"
              >
                ⌘ + Enter · No account needed · ~90 seconds
              </motion.p>
            )}

            {/* Demo pre-fill — only visible in demo mode */}
            {isDemoActive && !isValid && (
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={handleDemoFill}
                className="mt-4 w-full text-center text-xs text-warm hover:text-warm/80 transition-colors"
              >
                ▶ Load demo example
              </motion.button>
            )}
          </motion.div>
        </motion.form>
      </motion.div>
    </div>
  );
}
