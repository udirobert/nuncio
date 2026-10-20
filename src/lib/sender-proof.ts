/**
 * Sender proof — the human behind the AI.
 *
 * A stranger deciding whether to talk to an AI representative needs more than
 * initials in a circle. The sender can publish a photo, a company logo, and
 * one line describing what their representative can answer. All three are
 * snapshotted onto the share record when the link is created, so a later
 * change to the sender's setup never rewrites what a prospect was shown.
 */

import type { ShareRecord } from "@/lib/artifacts";
import type { WorkspaceAccount } from "@/lib/storage/types";

/** Only https images are accepted — no tracking pixels, no mixed content. */
export function normalizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** A short, sender-written line. Capped so the front door stays readable. */
export function normalizeCanAnswer(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
}

export interface SenderProof {
  photoUrl?: string;
  logoUrl?: string;
  canAnswer?: string;
}

/** Proof read from the sender's workspace. */
export function senderProofFromWorkspace(
  workspace: Partial<WorkspaceAccount> | null | undefined,
): SenderProof {
  return {
    photoUrl: normalizeImageUrl(workspace?.senderPhotoUrl),
    logoUrl: normalizeImageUrl(workspace?.senderCompanyLogoUrl),
    canAnswer: normalizeCanAnswer(workspace?.senderCanAnswer),
  };
}

/**
 * Proof for a recipient-facing page: the snapshot taken when the link was
 * created, falling back to the live workspace only when the snapshot is
 * empty (links created before the field existed).
 */
export function senderProofForShare(
  share: Partial<ShareRecord> | null | undefined,
  workspace?: Partial<WorkspaceAccount> | null,
): SenderProof {
  const live = senderProofFromWorkspace(workspace);
  return {
    photoUrl: normalizeImageUrl(share?.senderPhotoUrl) ?? live.photoUrl,
    logoUrl: normalizeImageUrl(share?.senderCompanyLogoUrl) ?? live.logoUrl,
    canAnswer: normalizeCanAnswer(share?.senderCanAnswer) ?? live.canAnswer,
  };
}

/** Initials fallback when no photo is set — used by the trust badge. */
export function senderInitials(name?: string | null): string {
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
