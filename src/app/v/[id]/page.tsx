"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ShareRecord } from "@/lib/artifacts";

/**
 * Branded video landing page — /v/[id]
 *
 * This is what the recipient sees when they click the video link.
 * It's a marketing surface: the video plays in a beautiful branded
 * experience with a CTA to try nuncio themselves.
 *
 * Design: editorial, spatial, warm cream palette.
 * Inspired by Codrops grid-to-preview transitions — the video
 * scales up from a card into full view on load.
 */

export default function VideoLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [videoData, setVideoData] = useState<ShareRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      const response = await fetch(`/api/share/${encodeURIComponent(id)}`);
      if (!response.ok) {
        setNotFound(true);
        return;
      }
      setVideoData(await response.json());
    }
    load();
  }, [params]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink">
            nuncio
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">Video link expired</h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            This prototype keeps share records in the running app process. Generate a fresh video to create a new branded page.
          </p>
          <Link
            href="/"
            className="btn-press inline-flex rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium"
          >
            Make your own →
          </Link>
        </div>
      </div>
    );
  }

  if (!videoData) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm text-ink-faint"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Minimal header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
        <Link
          href="/"
          className="text-xs text-ink-faint hover:text-accent transition-colors"
        >
          Make your own →
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[720px]">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 text-center"
          >
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[0.9] mb-3">
              Hey{videoData.recipientName ? ` ${videoData.recipientName}` : ""}
            </h1>
            <p className="text-ink-muted text-[15px]">
              {videoData.senderName
                ? `${videoData.senderName} recorded this for you`
                : "Someone recorded this video just for you"}
            </p>
          </motion.div>

          {/* Video — scales up from card with clip-path reveal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: 0.2,
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative"
          >
            {/* Decorative depth layers — parallax-inspired */}
            <div className="absolute -inset-3 rounded-3xl bg-cream-dark/60 -z-10 transform rotate-1" />
            <div className="absolute -inset-1.5 rounded-3xl bg-cream-dark -z-5 transform -rotate-0.5" />

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-ink shadow-2xl shadow-ink/20 ring-1 ring-ink/5">
              {!isPlaying ? (
                <button
                  onClick={() => setIsPlaying(true)}
                  className="w-full h-full relative group cursor-pointer"
                  aria-label="Play video"
                >
                  {/* Poster / play button overlay */}
                  <div className="absolute inset-0 bg-ink/40 flex items-center justify-center group-hover:bg-ink/30 transition-colors">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-8 h-8 text-ink ml-1"
                        fill="currentColor"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </motion.div>
                  </div>
                  {/* Dark placeholder */}
                  <div className="w-full h-full bg-ink" />
                </button>
              ) : (
                <video
                  src={videoData.videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                >
                  <track kind="captions" />
                </video>
              )}
            </div>
          </motion.div>

          {/* CTA section — the growth mechanic */}
          {(videoData.trace?.length || videoData.canvas) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 rounded-2xl border border-cream-dark bg-white/70 p-4"
            >
              <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-3">
                How this was made
              </p>
              <div className="space-y-2">
                {videoData.trace?.slice(0, 4).map((item, index) => (
                  <p key={`${item.label}-${index}`} className="text-xs text-ink-muted leading-relaxed">
                    <span className="font-medium text-ink">{item.label}:</span> {item.detail}
                  </p>
                ))}
              </div>
              {videoData.canvas?.canvasUrl && (
                <a
                  href={videoData.canvas.canvasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  View creative canvas →
                </a>
              )}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 text-center"
          >
            <div className="inline-flex flex-col items-center gap-4 rounded-2xl border border-cream-dark bg-white/80 px-8 py-6 shadow-sm">
              <p className="text-sm text-ink-light max-w-[320px]">
                This video was researched, written, and rendered by AI — personalised
                specifically for you.
              </p>
              <Link
                href="/"
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-6 py-3 text-sm font-medium shadow-lg shadow-ink/15 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Send your own personalised video
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <p className="text-[11px] text-ink-faint">
                Free · No account needed · 90 seconds
              </p>
              <Link
                href="/playbook"
                className="text-[11px] text-ink-faint hover:text-accent transition-colors underline-offset-2 hover:underline"
              >
                See how nuncio crafts these videos →
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center">
        <p className="text-[11px] text-ink-faint">
          Powered by{" "}
          <Link href="/" className="text-ink-muted hover:text-ink transition-colors font-medium">
            nuncio
          </Link>{" "}
          — your intelligent emissary
        </p>
      </footer>
    </div>
  );
}
