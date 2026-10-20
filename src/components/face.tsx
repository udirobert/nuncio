"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

export type FaceSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<FaceSize, string> = {
  xs: "w-7 h-7 text-label-sm",
  sm: "w-10 h-10 text-label-sm",
  md: "w-12 h-12 text-label-base",
  lg: "w-16 h-16 text-body-xs",
};

/**
 * An avatar URL, re-pointed at the provider's portrait crop.
 *
 * The providers serve a 3:2 landscape image and a 2:3 portrait image of the
 * same avatar. A face belongs in the portrait one: cropping the landscape
 * variant to a circle cuts the sides off and leaves the head small and
 * off-centre.
 */
export function faceImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/image\/landscape\b/, "/image/portrait");
}

/** Initials for the fallback — the house always shows a person as a circle. */
export function faceInitials(name?: string | null): string {
  return (
    (name || "")
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AI"
  );
}

interface FaceProps {
  /** Rendered image of the person. */
  src?: string | null;
  /** Rendered clip of the person — used for the live representative. */
  videoUrl?: string | null;
  /** Name, for the initials fallback. */
  name?: string | null;
  size?: FaceSize;
  /** Play the clip (muted, looping). Falls back to the still under reduced motion. */
  live?: boolean;
  className?: string;
  /** Accessible description. Empty for decorative faces. */
  alt?: string;
}

/**
 * A person's face, in the house shape: always a circle, always the same
 * fallback, never a bespoke glyph.
 *
 * Every person in nuncio is a circle — the sender's initial in the live
 * header, the recipient's initial, the trust badge avatar. This is the one
 * place that rule is enforced, so a new surface cannot invent a new shape.
 */
export function Face({
  src,
  videoUrl,
  name,
  size = "sm",
  live = false,
  className = "",
  alt = "",
}: FaceProps) {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const image = faceImageUrl(src);
  const showVideo = live && Boolean(videoUrl) && !videoFailed && !reducedMotion;

  // A paused-on-first-frame clip still reads as a face; it just does not move.
  useEffect(() => {
    if (showVideo && videoRef.current) {
      void videoRef.current.play().catch(() => setVideoFailed(true));
    }
  }, [showVideo]);

  const base = `rounded-full border border-cream-dark bg-cream-dark object-cover shrink-0 ${SIZES[size]} ${className}`;

  if (showVideo) {
    return (
      <video
        ref={videoRef}
        src={videoUrl ?? undefined}
        muted
        loop
        playsInline
        aria-label={alt || undefined}
        onError={() => setVideoFailed(true)}
        className={base}
      />
    );
  }

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={alt}
        className={base}
      />
    );
  }

  return (
    <span
      aria-label={alt || undefined}
      role={alt ? "img" : undefined}
      className={`rounded-full bg-ink text-cream flex items-center justify-center font-medium shrink-0 ${SIZES[size]} ${className}`}
    >
      {faceInitials(name)}
    </span>
  );
}
