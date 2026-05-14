"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShareNuncio } from "@/components/share-nuncio";

interface VideoPlayerProps {
  videoUrl: string;
  onReset: () => void;
  recipientName?: string;
}

interface Caption {
  text: string;
  startTime: number;
  endTime: number;
}

const LANGUAGES = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
];

function TranslateButton({ videoUrl }: { videoUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);

  async function handleTranslate(langCode: string) {
    setTranslating(langCode);
    setIsOpen(false);

    try {
      // Extract video ID from URL if possible, otherwise use the URL itself
      const videoId = videoUrl.split("/").pop()?.split(".")[0] || videoUrl;

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, targetLanguage: langCode }),
      });

      if (res.ok) {
        setTranslated(langCode);
      }
    } catch {
      // Non-critical
    }
    setTranslating(null);
  }

  return (
    <div className="relative">
      {translating ? (
        <span className="text-xs text-accent flex items-center gap-2">
          <motion.span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="w-1.5 h-1.5 rounded-full bg-accent"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
              />
            ))}
          </motion.span>
          Translating to {LANGUAGES.find((l) => l.code === translating)?.label}...
        </span>
      ) : translated ? (
        <span className="text-xs text-success flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8.5l3.5 3.5L13 5" />
          </svg>
          Translated to {LANGUAGES.find((l) => l.code === translated)?.label}
        </span>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" />
            <path d="M2 8h12M8 2a10 10 0 013 6 10 10 0 01-3 6 10 10 0 01-3-6 10 10 0 013-6z" />
          </svg>
          Translate video
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-cream-dark bg-white p-2 shadow-xl shadow-ink/10 z-50"
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleTranslate(lang.code)}
                className="w-full text-left px-3 py-2 text-xs text-ink-light hover:bg-cream-dark/50 rounded-lg transition-colors"
              >
                {lang.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [captionsLoading, setCaptionsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  async function handleCopy() {
    // Copy the branded landing page URL, not the raw video URL
    const shareableUrl = `${window.location.origin}/v/${encodeURIComponent(videoUrl)}`;
    await navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateCaptions() {
    setCaptionsLoading(true);
    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setCaptions(data.captions);
      }
    } catch (error) {
      console.error("[captions] Failed:", error);
    }
    setCaptionsLoading(false);
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
            Copy the link and paste it into your outreach message.
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

        {/* Translation + Captions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6 flex flex-wrap items-center gap-3"
        >
          {/* Translation */}
          <TranslateButton videoUrl={videoUrl} />

          {/* Captions */}
          {!captions && !captionsLoading && (
            <button
              onClick={handleGenerateCaptions}
              className="text-xs text-ink-faint hover:text-accent transition-colors flex items-center gap-1.5"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="14" height="10" rx="2" />
                <path d="M4 8h3M9 8h3M4 10.5h5" />
              </svg>
              Generate captions
            </button>
          )}
          {captionsLoading && (
            <span className="text-xs text-accent flex items-center gap-2">
              <motion.span className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="w-1.5 h-1.5 rounded-full bg-accent"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
                  />
                ))}
              </motion.span>
              Generating captions...
            </span>
          )}
        </motion.div>

        {/* Captions display */}
        {captions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-cream-dark bg-white p-4 max-h-32 overflow-y-auto"
          >
            <p className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-2">
              Captions ({captions.length} segments)
            </p>
            <div className="space-y-1">
              {captions.map((cap, i) => (
                <p key={i} className="text-xs text-ink-light">
                  <span className="font-[family-name:var(--font-mono)] text-ink-faint mr-2">
                    {cap.startTime.toFixed(1)}s
                  </span>
                  {cap.text}
                </p>
              ))}
            </div>
          </motion.div>
        )}

        {/* Share + Generate another */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col items-center gap-4"
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

          <div className="pt-2">
            <ShareNuncio videoUrl={videoUrl} recipientName={recipientName} />
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
