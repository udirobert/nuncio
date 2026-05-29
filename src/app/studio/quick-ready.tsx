"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface QuickReadyProps {
  videoUrl?: string;
  videoRendering: "idle" | "rendering" | "done" | "failed";
  videoComposed: boolean;
  script?: string;
  onRenderVideo: () => void;
  onShare: () => void;
  onDownload: () => void;
  onReset: () => void;
  onToggleMode: () => void;
  shareUrl?: string;
  draftMessage?: { channel: string; message: string } | null;
  recipientName?: string;
}

export function QuickReady({
  videoUrl,
  videoRendering,
  videoComposed,
  script,
  onRenderVideo,
  onShare,
  onDownload,
  onReset,
  onToggleMode,
  shareUrl,
  draftMessage,
  recipientName,
}: QuickReadyProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (shareUrl) {
      const absolute = new URL(shareUrl, window.location.origin).toString();
      await navigator.clipboard.writeText(absolute);
    } else if (videoUrl) {
      await navigator.clipboard.writeText(videoUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showVideo = videoUrl && videoRendering === "done";

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
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center">
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
                  <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                </svg>
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl text-ink">
                  Your video is ready
                </h2>
                <p className="text-xs text-ink-muted">
                  Copy the link and paste it into your outreach message.
                </p>
              </div>
            </div>
            <button
              onClick={onToggleMode}
              className="text-[11px] text-ink-faint hover:text-accent transition-colors shrink-0"
            >
              Advanced options
            </button>
          </div>

          {showVideo && (
            <div className="rounded-2xl overflow-hidden border border-cream-dark bg-black aspect-video">
              <video
                src={videoUrl}
                controls
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {!showVideo && (
            <div className="rounded-2xl border border-cream-dark bg-white p-8 text-center space-y-4">
              {videoRendering === "rendering" ? (
                <>
                  <span className="relative flex h-8 w-8 mx-auto">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-30" />
                    <span className="relative inline-flex rounded-full h-8 w-8 bg-accent/20" />
                  </span>
                  <p className="text-sm text-ink-muted">
                    Rendering your video... This takes about 60–90 seconds.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    Video is built and ready to render.
                  </p>
                  <button
                    onClick={onRenderVideo}
                    className="btn-press rounded-xl bg-ink text-cream px-6 py-3 text-sm font-medium hover:bg-ink-light transition-colors"
                  >
                    Render video
                  </button>
                </>
              )}
            </div>
          )}

          {showVideo && (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyLink}
                  className="btn-press flex-1 rounded-xl bg-ink text-cream py-3 text-sm font-medium hover:bg-ink-light transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 11v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z" />
                        <path d="M3 13V5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2H3z" />
                      </svg>
                      Copy link
                    </>
                  )}
                </button>
                <button
                  onClick={onDownload}
                  className="btn-press flex-1 rounded-xl border border-cream-dark py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1v9M4 6l4 4 4-4" />
                    <path d="M2 12v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={onShare}
                  className="btn-press flex-1 rounded-xl border border-cream-dark py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 12v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2" />
                    <path d="M8 1v9M4 6l4 4 4-4" />
                  </svg>
                  Share
                </button>
              </div>

              {/* One-click share flows */}
              {(shareUrl || videoUrl) && (
                <div className="rounded-2xl border border-cream-dark bg-white p-4 space-y-3">
                  <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
                    Quick share
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={`mailto:${recipientName ? "" : ""}?subject=${encodeURIComponent(`Quick video for ${recipientName || "you"}`)}&body=${encodeURIComponent((draftMessage?.message || `I made a short personalised video for you — take a look!`) + "\n\n" + (shareUrl ? new URL(shareUrl, typeof window !== "undefined" ? window.location.origin : "").toString() : videoUrl || ""))}`}
                      className="btn-press flex flex-col items-center gap-1.5 rounded-xl border border-cream-dark py-3 text-[11px] font-medium text-ink hover:bg-cream-dark/30 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="12" height="10" rx="1" />
                        <path d="M2 4l6 5 6-5" />
                      </svg>
                      Email
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent((draftMessage?.channel === "twitter" ? draftMessage.message : `Check out this personalised video I made for ${recipientName || "you"}!`) + " " + (shareUrl ? new URL(shareUrl, typeof window !== "undefined" ? window.location.origin : "").toString() : videoUrl || ""))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press flex flex-col items-center gap-1.5 rounded-xl border border-cream-dark py-3 text-[11px] font-medium text-ink hover:bg-cream-dark/30 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                        <path d="M9.52 6.77L14.48 1h-1.18L8.99 5.9 5.95 1H1.22l5.2 7.56L1.22 15h1.18l4.55-5.28L10.05 15h4.73L9.52 6.77zM7.64 8.97l-.53-.76L2.87 1.92h1.81l3.39 4.85.53.76 4.41 6.31h-1.81L7.64 8.97z" />
                      </svg>
                      Tweet
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl ? new URL(shareUrl, typeof window !== "undefined" ? window.location.origin : "").toString() : videoUrl || "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press flex flex-col items-center gap-1.5 rounded-xl border border-cream-dark py-3 text-[11px] font-medium text-ink hover:bg-cream-dark/30 transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                        <path d="M3.5 2A1.5 1.5 0 1 0 3.5 5 1.5 1.5 0 0 0 3.5 2zM2 6.5h3V14H2V6.5zm5.5 0h2.9v1h.04c.4-.76 1.4-1.56 2.86-1.56C16.1 5.94 16 8.58 16 10.25V14h-3V10.75c0-.77-.01-1.77-1.08-1.77-1.08 0-1.24.85-1.24 1.72V14H7.5V6.5z" />
                      </svg>
                      LinkedIn
                    </a>
                  </div>
                </div>
              )}

              {draftMessage && (
                <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
                      Your draft ({draftMessage.channel})
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(draftMessage.message); }}
                      className="text-[10px] text-accent hover:text-accent/80 font-medium transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">
                    {draftMessage.message}
                  </p>
                </div>
              )}

              {script && (
                <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
                    Script
                  </span>
                  <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">
                    {script}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center">
                <button
                  onClick={onShare}
                  className="btn-press rounded-xl border border-cream-dark px-6 py-3 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h10v10H3z" />
                    <path d="M8 6v4M6 8h4" />
                  </svg>
                  Create share page
                </button>
              </div>
            </>
          )}

          {/* Batch CTA */}
          {showVideo && (
            <div className="rounded-2xl border border-accent/20 bg-accent-soft/10 p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 16 16" className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 8h6M8 5v6" />
                  <circle cx="8" cy="8" r="6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">Send to more people{recipientName ? ` like ${recipientName}` : ""}?</p>
                <p className="text-[11px] text-ink-muted">Batch create videos with the same style and voice.</p>
              </div>
              <a
                href="/batch"
                className="btn-press shrink-0 rounded-lg bg-accent text-white px-3 py-2 text-[11px] font-medium hover:bg-accent/90 transition-colors"
              >
                Open Batch
              </a>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={onReset}
              className="text-[11px] uppercase tracking-widest text-ink-faint hover:text-ink transition-colors"
            >
              Generate another →
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
