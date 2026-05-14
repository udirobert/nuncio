"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ShareNuncioProps {
  videoUrl?: string;
  recipientName?: string;
}

export function ShareNuncio({ videoUrl, recipientName }: ShareNuncioProps) {
  const [isOpen, setIsOpen] = useState(false);

  const shareText = recipientName
    ? `Just sent a personalised video to ${recipientName} using @naboranuncio — AI researched them, wrote a script, and rendered a video in 90 seconds. Wild.`
    : `Just discovered nuncio — paste someone's LinkedIn, get a personalised video in 90 seconds. The AI researches them and writes a script that actually references their work.`;

  const shareUrl = "https://nuncio.app";

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  async function handleCopyReferral() {
    const referralText = `${shareText}\n\nTry it: ${shareUrl}`;
    await navigator.clipboard.writeText(referralText);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-ink-faint hover:text-ink-muted transition-colors flex items-center gap-1.5"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="4" cy="8" r="2" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M5.7 7l4.6-2M5.7 9l4.6 2" />
        </svg>
        Know someone who sends outreach? Share nuncio
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 mb-3 w-72 rounded-2xl border border-cream-dark bg-white p-4 shadow-xl shadow-ink/10 z-50"
          >
            <p className="text-xs text-ink-muted mb-3 leading-relaxed">
              {shareText.slice(0, 100)}...
            </p>

            <div className="flex gap-2">
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-ink text-cream px-3 py-2.5 text-xs font-medium hover:bg-ink-light transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Post
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#0A66C2] text-white px-3 py-2.5 text-xs font-medium hover:bg-[#004182] transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Share
              </a>
              <button
                onClick={handleCopyReferral}
                className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-cream-dark px-3 py-2.5 text-xs font-medium text-ink hover:bg-cream-dark/50 transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" />
                  <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
                </svg>
                Copy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
