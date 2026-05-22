"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { StudioBuildResult } from "@/lib/creative/melius-provider";

interface QuickReadyProps {
  buildResult: StudioBuildResult | null;
  videoUrl?: string;
  videoRendering: "idle" | "rendering" | "done" | "failed";
  videoComposed: boolean;
  onRenderVideo: () => void;
  onShare: () => void;
  onDownload: () => void;
  onReset: () => void;
  onToggleMode: () => void;
  shareUrl?: string;
}

export function QuickReady({
  buildResult,
  videoUrl,
  videoRendering,
  videoComposed,
  onRenderVideo,
  onShare,
  onDownload,
  onReset,
  onToggleMode,
  shareUrl,
}: QuickReadyProps) {
  const [copied, setCopied] = useState(false);
  const scriptNode = buildResult?.nodes?.find(
    (n) => n.label === "Script" && n.type === "custom_text"
  );

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
                    The creative canvas is built. Ready to render a HeyGen video.
                  </p>
                  <button
                    onClick={onRenderVideo}
                    className="btn-press rounded-xl bg-ink text-cream px-6 py-3 text-sm font-medium hover:bg-ink-light transition-colors"
                  >
                    Render HeyGen video
                  </button>
                </>
              )}
            </div>
          )}

          {showVideo && (
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
          )}

          {showVideo && (
            <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
                Script
              </span>
              <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">
                {scriptNode?.prompt || "No script available"}
              </p>
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
