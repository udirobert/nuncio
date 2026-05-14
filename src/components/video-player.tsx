"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";

interface VideoPlayerProps {
  videoUrl: string;
  onReset: () => void;
  recipientName?: string;
}

function Confetti() {
  const [particles] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.5 + Math.random() * 1,
      size: 4 + Math.random() * 6,
      color: ["#4A3AFF", "#C4704B", "#2D8A4E", "#1A1A1A", "#E8E5FF"][
        Math.floor(Math.random() * 5)
      ],
      yEnd: 400 + Math.random() * 200,
      rotateEnd: 360 + Math.random() * 360,
      xDrift: (Math.random() - 0.5) * 100,
    }))
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: [0, p.yEnd],
            opacity: [1, 1, 0],
            rotate: [0, p.rotateEnd],
            x: [0, p.xDrift],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </div>
  );
}

export function VideoPlayer({ videoUrl, onReset, recipientName }: VideoPlayerProps) {
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(videoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative">
      {/* Celebration confetti */}
      {showConfetti && <Confetti />}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[640px] relative z-10"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 15 }}
            className="w-12 h-12 rounded-full bg-success-soft flex items-center justify-center mx-auto mb-4"
          >
            <svg viewBox="0 0 16 16" className="w-5 h-5 text-success" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 8.5l3.5 3.5L13 5" />
            </svg>
          </motion.div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl tracking-tight leading-none mb-2">
            {recipientName ? `Video for ${recipientName}` : "Your video is ready"}
          </h1>
          <p className="text-sm text-ink-muted">
            Ready to send. Copy the link or download the file.
          </p>
        </motion.div>

        {/* Video */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="aspect-video w-full rounded-2xl overflow-hidden bg-ink shadow-2xl shadow-ink/25 mb-8 ring-1 ring-ink/5"
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
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex gap-3 mb-6"
        >
          <button
            onClick={handleCopy}
            className={`
              btn-press flex-1 rounded-2xl px-5 py-4 text-sm font-medium
              transition-all duration-300 flex items-center justify-center gap-2
              ${copied
                ? "bg-success-soft text-success border border-success/20"
                : "bg-ink text-cream shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5"
              }
            `}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
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
            className="btn-press flex-1 rounded-2xl border border-cream-dark px-5 py-4 text-sm font-medium text-ink hover:bg-cream-dark/50 transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2 14h12" />
            </svg>
            Download
          </a>
        </motion.div>

        {/* Generate another */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <button
            onClick={onReset}
            className="text-sm text-ink-muted hover:text-ink transition-colors inline-flex items-center gap-1.5"
          >
            Generate another
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
