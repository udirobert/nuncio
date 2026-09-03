"use client";

interface SenderTrustBadgeProps {
  senderName?: string;
  recipientName?: string;
  mode?: "outreach" | "reconnect";
  deliveryMode?: "video" | "livelink";
}

export function SenderTrustBadge({
  senderName,
  recipientName,
  mode = "outreach",
  deliveryMode = "video",
}: SenderTrustBadgeProps) {
  const name = senderName || "your contact";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AI";

  const label =
    mode === "reconnect"
      ? `Made by ${name} with a little AI help`
      : deliveryMode === "livelink"
        ? `AI twin of ${name} · trained on their playbook`
        : `Made by ${name}'s AI twin`;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-cream-dark bg-white/80 pl-1.5 pr-3 py-1.5 shadow-sm">
      <div className="w-7 h-7 rounded-full bg-ink text-cream flex items-center justify-center text-[10px] font-medium shrink-0">
        {initials}
      </div>
      <div className="text-left">
        <p className="text-xs text-ink font-medium leading-tight">{name}</p>
        <p className="text-[10px] text-ink-faint leading-tight flex items-center gap-1">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-6" />
          </svg>
          {label}
        </p>
      </div>
    </div>
  );
}
