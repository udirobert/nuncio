"use client";

import type { RelationshipState } from "@/lib/inbox";

/**
 * Where a relationship stands.
 *
 * The inbox used to list links; a sender does not think in links, they think
 * in "is Maya still reading?". These labels turn a log into a pipeline.
 */
const STATE_LABEL: Record<RelationshipState, string> = {
  sent: "Sent",
  opened: "They opened it",
  talking: "They talked",
  booked: "Booked",
  requested: "Asked for you",
};

const STATE_CLASS: Record<RelationshipState, string> = {
  sent: "bg-cream-dark text-ink-faint",
  opened: "bg-accent-soft text-accent",
  talking: "bg-accent-soft text-accent",
  booked: "bg-success-soft text-success",
  requested: "bg-warm-soft text-warm",
};

/** The plain-language sentence under the chip. */
export function relationshipSentence(
  state: RelationshipState,
  recipientName: string | null,
  waitingSince: string | null,
): string {
  const who = recipientName?.trim() || "they";
  switch (state) {
    case "requested":
      return `${who} asked for you — accept in Needs your attention.`;
    case "booked":
      return `${who} booked a time.`;
    case "talking":
      return `${who} had a conversation with your representative.`;
    case "opened":
      return `${who} opened your link${waitingSince ? ` · ${waitingSince}` : ""}.`;
    default:
      return `Waiting for ${who} to open it.`;
  }
}

export function RelationshipChip({ state }: { state: RelationshipState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-label-xs uppercase tracking-widest font-medium ${STATE_CLASS[state]}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}
