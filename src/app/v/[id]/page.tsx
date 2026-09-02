"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ShareRecord } from "@/lib/artifacts";
import { languageLabel } from "@/lib/languages";
import { DuckingAudio } from "@/components/ducking-audio";
import { trackBookingClicked, trackVideoWatchThrough, trackViralCtaClicked } from "@/lib/analytics";

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
  const [showVideo, setShowVideo] = useState(false);
  const [thanksCopied, setThanksCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideoRef = useRef(false);

  useEffect(() => {
    async function load() {
      const { id } = await params;
      const response = await fetch(`/api/share/${encodeURIComponent(id)}`);
      if (!response.ok) {
        setNotFound(true);
        return;
      }
      const data = await response.json();
      setVideoData(data);
      if (data.videoUrl) hasVideoRef.current = true;
    }
    load();

    const interval = setInterval(async () => {
      if (hasVideoRef.current) {
        clearInterval(interval);
        return;
      }
      const { id } = await params;
      const response = await fetch(`/api/share/${encodeURIComponent(id)}`);
      if (response.ok) {
        const updated = await response.json();
        setVideoData(updated);
        if (updated.videoUrl) {
          hasVideoRef.current = true;
          clearInterval(interval);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [params]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <Link href="/" className="font-display text-lg tracking-tight text-ink">
            nuncio
          </Link>
          <h1 className="font-display text-4xl tracking-tight">Video link expired</h1>
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

  const hasVideo = Boolean(videoData.videoUrl);
  const senderName = videoData.senderName || "";
  const recipientName = videoData.recipientName || "";
  const senderCompany = videoData.profile?.company || "";
  const senderRole = videoData.profile?.current_role || "";

  // Build a "why you're seeing this" line from the profile
  const senderContext = senderName
    ? senderRole || senderCompany
      ? `${senderName}${senderRole ? ` — ${senderRole}` : ""}${senderCompany ? ` at ${senderCompany}` : ""}`
      : senderName
    : "";

  // Booking CTA is the control arm for prediction P-c — https links only.
  const bookingUrl = videoData.bookingUrl?.startsWith("https://") ? videoData.bookingUrl : null;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Minimal header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
        {hasVideo && (
          <Link
            href={`/?ref=share-${videoData.id}-header`}
            onClick={() =>
              trackViralCtaClicked({
                shareId: videoData.id,
                ref: `share-${videoData.id}-header`,
                surface: "header",
              })
            }
            className="text-xs text-ink-faint hover:text-accent transition-colors"
          >
            Make your own →
          </Link>
        )}
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
            <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.9] mb-3">
              Hey{recipientName ? ` ${recipientName}` : ""}
            </h1>
            <p className="text-ink-muted text-[15px]">
              {hasVideo
                ? senderName
                  ? `${senderName} recorded this for you`
                  : "Someone recorded this video just for you"
                : senderName
                  ? `${senderName} is preparing a video for you`
                  : "A video is being prepared for you"}
            </p>
            {senderContext && (
              <p className="text-ink-faint text-xs mt-1.5">
                {senderContext}
              </p>
            )}
            <p className="mt-3 text-label-sm uppercase tracking-widest text-ink-faint font-medium">
              {senderName
                ? `Made by ${senderName}'s AI twin · disclosed, never disguised`
                : "Made by an AI twin · disclosed, never disguised"}
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
              {!videoData.videoUrl ? (
                /* Video processing state */
                <div className="w-full h-full flex flex-col items-center justify-center bg-ink/90 text-cream">
                  <div className="w-12 h-12 rounded-full border-2 border-cream/30 border-t-cream animate-spin mb-4" />
                  <p className="text-sm text-cream/70 mb-2">Video is being rendered</p>
                  <p className="text-xs text-cream/50">This typically takes 3–5 minutes</p>
                </div>
              ) : !isPlaying ? (
                <button
                  onClick={() => {
                    if (videoData.cinematicEntranceUrl) {
                      const audio = new Audio(videoData.cinematicEntranceUrl);
                      audio.onended = () => setShowVideo(true);
                      audio.play().catch(() => setShowVideo(true));
                    } else {
                      setShowVideo(true);
                    }
                    setIsPlaying(true);
                  }}
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
              ) : showVideo ? (
                <>
                  {videoData.soundscapeUrl && (
                    <DuckingAudio
                      soundscapeUrl={videoData.soundscapeUrl}
                      videoRef={videoRef}
                    />
                  )}
                  <video
                    ref={videoRef}
                    src={videoData.videoUrl}
                    controls
                    autoPlay
                    playsInline
                    onEnded={() => trackVideoWatchThrough({ shareId: videoData.id })}
                    className="w-full h-full object-contain"
                  >
                    <track kind="captions" />
                  </video>
                </>
              ) : (
                <div className="w-full h-full bg-ink flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto rounded-full border-2 border-cream/30 border-t-cream animate-spin mb-3" />
                    <p className="text-sm text-cream/60">Preparing cinematic experience...</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Language badge — hide for English, undefined, or unknown languages */}
          {hasVideo && videoData.language && videoData.language !== "en" && videoData.language !== "und" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 text-center"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-soft border border-warm/20 text-label-base text-warm font-medium">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm1 9H7V7h2v5z" />
                </svg>
                This video is in {languageLabel(videoData.language)}
              </span>
            </motion.div>
          )}

          {/* Reply / engagement actions — only when video is ready */}
          {hasVideo && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 flex flex-col items-center gap-3"
            >
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    const replySubject = `Re: your video${recipientName ? ` for ${recipientName}` : ""}`;
                    const replyBody = senderName
                      ? `Hi ${senderName},\n\nThanks for the personalised video — really appreciated the personal touch.\n\nI'd love to learn more. When are you free for a quick call?`
                      : `Thanks for the personalised video — really appreciated the personal touch.\n\nI'd love to learn more. When are you free for a quick call?`;
                    const mailto = `mailto:?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(replyBody)}`;
                    window.location.href = mailto;
                  }}
                  className="btn-press rounded-xl bg-ink text-cream px-5 py-2.5 text-xs font-medium hover:bg-ink-light transition-colors flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 4h12v8H2z" />
                    <path d="M2 4l6 5 6-5" />
                  </svg>
                  Reply
                </button>
                {bookingUrl && (
                  <button
                    onClick={() => {
                      trackBookingClicked({ shareId: videoData.id, surface: "share_page" });
                      window.open(bookingUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="btn-press rounded-xl bg-ink text-cream px-5 py-2.5 text-xs font-medium hover:bg-ink-light transition-colors"
                  >
                    Book time with {senderName || "the sender"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `Thanks for the video${senderName ? `, ${senderName}` : ""}! Really appreciate the personal touch.`
                    );
                    setThanksCopied(true);
                    setTimeout(() => setThanksCopied(false), 2000);
                  }}
                  className="btn-press rounded-xl border border-cream-dark bg-white/80 px-5 py-2.5 text-xs font-medium text-ink hover:bg-white transition-colors"
                >
                  {thanksCopied ? "Copied!" : "Say thanks"}
                </button>
                <Link
                  href={`/?reply=${encodeURIComponent(senderName || "")}`}
                  className="btn-press rounded-xl border border-cream-dark bg-white/80 px-5 py-2.5 text-xs font-medium text-ink hover:bg-white transition-colors flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z" />
                  </svg>
                  Send one back
                </Link>
              </div>
            </motion.div>
          )}

          {/* "How this was made" trace — only when video is ready */}
          {hasVideo && (videoData.trace?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 rounded-2xl border border-cream-dark bg-white/70 p-4"
            >
              <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-3">
                How this was made
              </p>
              <div className="space-y-2">
                {videoData.trace?.slice(0, 4).map((item, index) => (
                  <p key={`${item.label}-${index}`} className="text-xs text-ink-muted leading-relaxed">
                    <span className="font-medium text-ink">{item.label}:</span> {item.detail}
                  </p>
                ))}
              </div>
              {videoData.generation?.models && (
                <div className="mt-3 pt-3 border-t border-cream-dark">
                  <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-2">
                    Generated with Genblaze
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(videoData.generation.models).map(([role, model]) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-label-sm text-ink-muted"
                      >
                        {role}: {model}
                      </span>
                    ))}
                  </div>
                  {videoData.generation.manifests &&
                    Object.keys(videoData.generation.manifests).length > 0 && (
                      <p className="mt-1.5 text-label-sm text-ink-faint">
                        Provenance manifests:{" "}
                        {Object.entries(videoData.generation.manifests)
                          .map(([role]) => role)
                          .join(", ")}
                      </p>
                    )}
                </div>
              )}
              {videoData.proof?.gatewayUrl && (
                <a
                  href={videoData.proof.gatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-label-base text-ink-muted hover:text-ink transition-colors"
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1l5 2v4c0 3.5-2.2 5.7-5 7-2.8-1.3-5-3.5-5-7V3l5-2z" />
                    <path d="M6 8l1.5 1.5L10 6.5" />
                  </svg>
                  View generation proof
                </a>
              )}
            </motion.div>
          )}

          {/* CTA section — only when video is ready */}
          {hasVideo && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12 text-center"
            >
              <div className="inline-flex flex-col items-center gap-4 rounded-2xl border border-cream-dark bg-white/80 px-8 py-6 shadow-sm">
                <p className="text-sm text-ink-light max-w-[320px]">
                  This researched you, wrote what you just watched, and can answer
                  questions live.
                </p>
                <p className="text-xs text-ink-faint max-w-[320px]">
                  It&apos;s {senderName ? `${senderName}'s` : "an"} AI twin — disclosed
                  up front, built on their playbook.
                </p>
                <Link
                  href={`/?ref=share-${videoData.id}`}
                  onClick={() =>
                    trackViralCtaClicked({
                      shareId: videoData.id,
                      ref: `share-${videoData.id}`,
                      surface: "share_page",
                    })
                  }
                  className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-6 py-3 text-sm font-medium shadow-lg shadow-ink/15 hover:shadow-xl hover:-translate-y-0.5 transition-[color,background-color,border-color,opacity,box-shadow,transform]"
                >
                  Make yours →
                </Link>
                <p className="text-label-base text-ink-faint">
                  Free · No account needed · 90 seconds
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center">
        <p className="text-label-base text-ink-faint">
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
