"use client";

import { Face } from "@/components/face";

interface SenderTrustBadgeProps {
  senderName?: string;
  recipientName?: string;
  mode?: "outreach" | "reconnect";
  deliveryMode?: "video" | "livelink";
  playbookConfigured?: boolean;
  /** Public photo of the sender — the human behind the AI. */
  photoUrl?: string | null;
  /** Company logo — trust proof next to the sender's name. */
  logoUrl?: string | null;
}

export function SenderTrustBadge({
  senderName,
  mode = "outreach",
  deliveryMode = "video",
  playbookConfigured = false,
  photoUrl,
  logoUrl,
}: SenderTrustBadgeProps) {
  const name = senderName || "your contact";

  const live = deliveryMode === "livelink";
  const label = live
    ? playbookConfigured
      ? "AI representative · guided by their playbook"
      : "AI representative · general guidance"
    : mode === "reconnect"
      ? `Made by ${name} with a little AI help`
      : `Made by ${name}'s AI twin`;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-cream-dark bg-white/80 pl-1.5 pr-3 py-1.5 shadow-sm">
      <Face
        src={photoUrl}
        name={name}
        size="xs"
        alt={photoUrl ? `${name}'s photo` : ""}
      />
      <div className="text-left">
        <p className="text-label-sm text-ink font-medium leading-tight flex items-center gap-1.5">
          {name}
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-3.5 w-auto object-contain opacity-70"
            />
          )}
        </p>
        <p className="text-label-xs text-ink-faint leading-tight flex items-center gap-1">
          {live ? (
            <span className="rounded border border-ink-faint/40 px-0.5 text-label-xs font-semibold text-ink-faint">AI</span>
          ) : (
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l3 3 5-6" />
            </svg>
          )}
          {label}
        </p>
      </div>
    </div>
  );
}
