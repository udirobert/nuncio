"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ShowcasePlatform, ShowcaseRecipient } from "@/lib/showcase";

const PLATFORM_LABEL: Record<ShowcasePlatform, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  github: "GitHub",
  farcaster: "Farcaster",
  facebook: "Facebook",
};

interface RecipientCardProps {
  item: ShowcaseRecipient;
  /** Visual size — the wall uses "lg" on desktop, "md" on the mobile strip. */
  size?: "md" | "lg";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function RecipientCard({ item, size = "lg" }: RecipientCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHover, setIsHover] = useState(false);

  function handleEnter() {
    setIsHover(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  function handleLeave() {
    setIsHover(false);
    if (videoRef.current) videoRef.current.pause();
  }

  const isLg = size === "lg";
  const hasVideo = !!item.videoUrl;

  // Card destination, in priority order:
  // 1. /v/[id] — when there's a real video to play (matches a share record)
  // 2. /playbook#entry — when there's a teardown for this recipient
  // 3. /?demo=true — fallback so the visitor can still experience the pipeline
  const href = hasVideo
    ? `/v/${item.id}`
    : item.playbookId
      ? `/playbook#${item.playbookId}`
      : "/?demo=true";

  return (
    <Link
      href={href}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className={`
        group block w-full rounded-2xl border border-cream-dark bg-white/80
        backdrop-blur-sm shadow-sm hover:shadow-xl hover:-translate-y-0.5
        transition-all duration-300 overflow-hidden
        ${isLg ? "p-4" : "p-3"}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`
            relative shrink-0 rounded-xl flex items-center justify-center overflow-hidden
            ${isLg ? "w-14 h-14" : "w-11 h-11"}
          `}
          style={{ backgroundColor: item.hue }}
        >
          {hasVideo ? (
            <>
              <video
                ref={videoRef}
                src={item.videoUrl}
                muted
                playsInline
                loop
                preload="none"
                className={`
                  absolute inset-0 w-full h-full object-cover
                  transition-opacity duration-300
                  ${isHover ? "opacity-100" : "opacity-0"}
                `}
              />
              <span
                className={`
                  font-[family-name:var(--font-display)] text-ink/80
                  ${isLg ? "text-lg" : "text-sm"}
                  transition-opacity duration-300
                  ${isHover ? "opacity-0" : "opacity-100"}
                `}
              >
                {initials(item.name)}
              </span>
              {/* Play indicator */}
              <span
                className={`
                  absolute bottom-1 right-1 w-4 h-4 rounded-full
                  bg-ink/80 text-cream flex items-center justify-center
                  transition-opacity duration-300
                  ${isHover ? "opacity-0" : "opacity-100"}
                `}
                aria-hidden
              >
                <svg viewBox="0 0 8 8" className="w-2 h-2 fill-current">
                  <path d="M2 1l5 3-5 3z" />
                </svg>
              </span>
            </>
          ) : (
            <span
              className={`
                font-[family-name:var(--font-display)] text-ink/80
                ${isLg ? "text-lg" : "text-sm"}
              `}
            >
              {initials(item.name)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`
                font-medium text-ink truncate
                ${isLg ? "text-sm" : "text-[13px]"}
              `}
            >
              {item.name}
            </p>
            <span className="text-[9px] uppercase tracking-widest text-ink-faint/70 shrink-0">
              {PLATFORM_LABEL[item.platform]}
            </span>
          </div>
          <p
            className={`
              text-ink-muted mt-0.5 truncate
              ${isLg ? "text-[12px]" : "text-[11px]"}
            `}
          >
            {item.role}
          </p>
        </div>
      </div>

      <p
        className={`
          font-[family-name:var(--font-display)] italic text-ink-light leading-snug
          ${isLg ? "text-[13px] mt-3" : "text-[12px] mt-2.5"}
        `}
      >
        “{item.angle}”
      </p>
    </Link>
  );
}
