"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface VideoPlayerProps {
  videoUrl: string;
  onReset: () => void;
}

export function VideoPlayer({ videoUrl, onReset }: VideoPlayerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(videoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[640px]"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-6 flex items-center gap-3"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 15 }}
            className="w-8 h-8 rounded-full bg-success-soft flex items-center justify-center"
          >
            <svg
              viewBox="0 0 16 16"
              className="w-4 h-4 text-success"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 8.5l3.5 3.5L13 5" />
            </svg>
          </motion.div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight leading-none">
              Ready to send
            </h1>
          </div>
        </motion.div>

        {/* Video */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="aspect-video w-full rounded-2xl overflow-hidden bg-ink shadow-2xl shadow-ink/20 mb-6"
        >
          <video
            src={videoUrl}
            controls
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          >
            <track kind="captions" />
          </video>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex gap-3 mb-8"
        >
          <button
            onClick={handleCopy}
            className="btn-press flex-1 rounded-xl border border-cream-dark px-5 py-3.5 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" className="w-4 h-4 text-success" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8.5l3.5 3.5L13 5" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" />
                  <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
                </svg>
                Copy link
              </>
            )}
          </button>
          <a
            href={videoUrl}
            download
            className="btn-press flex-1 rounded-xl border border-cream-dark px-5 py-3.5 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v9M4 8l4 4 4-4M2 14h12" />
            </svg>
            Download
          </a>
        </motion.div>

        {/* Reset */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <button
            onClick={onReset}
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            Generate another →
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
