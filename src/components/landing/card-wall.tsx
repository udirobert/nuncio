"use client";

import type { ShowcaseRecipient } from "@/lib/showcase";
import { RecipientCard } from "./recipient-card";

interface CardWallProps {
  items: ShowcaseRecipient[];
  /** "up" drifts cards from bottom→top; "down" reverses. */
  direction: "up" | "down";
  /** Animation duration in seconds (lower = faster drift). */
  durationSec?: number;
}

/**
 * Vertical infinite-drift column of recipient cards.
 *
 * The list is duplicated and the inner track is animated with a single
 * CSS keyframe (drift-up / drift-down in globals.css). No JS, no Lenis,
 * no WebGL. The fade-out at top and bottom is a CSS mask so cards arrive
 * and depart smoothly. Animation pauses on hover/focus for readability.
 */
export function CardWall({ items, direction, durationSec = 60 }: CardWallProps) {
  // Inner-edge fade: the side closest to the centred form fades toward the
  // cream background so the wall reads as ambient atmosphere rather than a
  // competing wall of text. Top/bottom fades also stronger.
  const innerEdgeFade =
    direction === "up"
      ? "linear-gradient(to right, black 0%, black 65%, transparent 100%)"
      : "linear-gradient(to left, black 0%, black 65%, transparent 100%)";

  return (
    <div
      className="card-wall relative h-full overflow-hidden opacity-80 hover:opacity-100 transition-opacity duration-500"
      style={{
        WebkitMaskImage: `linear-gradient(to bottom, transparent 0, black 18%, black 82%, transparent 100%), ${innerEdgeFade}`,
        WebkitMaskComposite: "source-in",
        maskImage: `linear-gradient(to bottom, transparent 0, black 18%, black 82%, transparent 100%), ${innerEdgeFade}`,
        maskComposite: "intersect",
      }}
    >
      <div
        className="card-wall-track flex flex-col gap-4 will-change-transform"
        style={{
          animationName: direction === "up" ? "drift-up" : "drift-down",
          animationDuration: `${durationSec}s`,
        }}
      >
        {[...items, ...items].map((item, i) => (
          <RecipientCard key={`${item.id}-${i}`} item={item} size="lg" />
        ))}
      </div>
    </div>
  );
}
