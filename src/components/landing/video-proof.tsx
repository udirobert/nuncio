"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";

/**
 * Compact video proof section — shows a real rendered nuncio video
 * between the form and the "How it works" section.
 *
 * This is the single most important trust signal for a video generation
 * hackathon: proof that the pipeline actually produces real output.
 */

const GOLDEN_SHARE_PAGE = "/v/cf2ce2ee-c6d";
// Video downloaded from HeyGen and hosted statically — signed URLs expire after ~7 days.
const GOLDEN_VIDEO_URL = "/onee-yekeh-demo.mp4";

export function VideoProof() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="px-6 pt-1 pb-6 max-w-[720px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Label */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-ink-faint font-medium">
            Real output — generated in 90 seconds
          </p>
          <Link
            href={GOLDEN_SHARE_PAGE}
            className="text-xs text-ink-faint hover:text-accent transition-colors"
          >
            View share page →
          </Link>
        </div>

        {/* Video container */}
        <div className="aspect-video w-full rounded-2xl overflow-hidden bg-ink shadow-xl shadow-ink/15 ring-1 ring-ink/5 relative">
          {!isPlaying ? (
            <button
              onClick={() => setIsPlaying(true)}
              className="w-full h-full relative group cursor-pointer"
              aria-label="Play example nuncio video"
            >
              {/* Play button overlay */}
              <div className="absolute inset-0 bg-ink/30 flex items-center justify-center group-hover:bg-ink/20 transition-colors">
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-6 h-6 text-ink ml-0.5"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </motion.div>
              </div>
              {/* Poster — dark bg with subtle text */}
              <div className="w-full h-full bg-gradient-to-br from-ink to-ink-light flex items-end p-6">
                <div className="text-left">
                  <p className="text-cream/90 text-sm font-medium">Personalised video for Onee Yekeh</p>
                  <p className="text-cream/50 text-xs">Product Manager at HeyGen · Generated via nuncio pipeline</p>
                </div>
              </div>
            </button>
          ) : (
            <video
              src={GOLDEN_VIDEO_URL}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            >
              <track kind="captions" src="/onee-yekeh-demo.vtt" srcLang="en" label="English" default />
            </video>
          )}
        </div>

        {/* Caption */}
        <p className="text-center text-[11px] text-ink-faint mt-3">
          Enriched from LinkedIn · Script by Claude · Rendered by HeyGen Video Agent · Captions by HeyGen
        </p>
      </motion.div>
    </section>
  );
}
