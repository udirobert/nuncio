/**
 * The representative — who actually answers the prospect.
 *
 * An avatar app that never shows the avatar is an avatar app that feels
 * barren. This module is the single place that answers "who is going to
 * speak to my prospect, and what are they?", and it is used by the setup
 * preview, the prospect's lobby, the trust badge and the studio.
 *
 * Two honest kinds, because the two providers support different promises:
 *
 *   "self"    — the representative uses the sender's own photo. The prospect
 *               is talking to something that looks like the sender, so the
 *               disclosure has to say so plainly.
 *   "persona" — the representative is a disclosed provider persona that
 *               stands in for the sender. It does not look like them, and
 *               the disclosure must not imply that it does.
 *
 * Never collapse the two. "May not resemble you" and "is you" are different
 * promises, and a prospect is entitled to know which one they are getting.
 */

import { getAnamAvatar } from "@/lib/anam";
import type { WorkspaceAccount } from "@/lib/storage/types";

export type RepresentativeKind = "self" | "persona" | "unset";

export interface RepresentativeDescription {
  kind: RepresentativeKind;
  /** Display name — the persona's name, or the sender's name for a photo avatar. */
  name: string;
  /** Rendered image of the representative, when one can be resolved. */
  imageUrl?: string;
  /** Rendered video of the representative — the avatar actually moving. */
  videoUrl?: string;
  /** Which provider will serve the conversation. */
  provider?: "anam" | "synthesia" | "masky";
  /** Whether an avatar is configured at all. */
  configured: boolean;
}

/**
 * The sender's own photo drives the Anam path, so a configured Anam avatar
 * means the representative *is* the sender, visually.
 */
function hasPhotoAvatar(workspace: Partial<WorkspaceAccount> | null | undefined): boolean {
  return Boolean(workspace?.anamAvatarId?.trim());
}

function hasPersonaAvatar(workspace: Partial<WorkspaceAccount> | null | undefined): boolean {
  return Boolean(workspace?.synthesiaAvatarId?.trim() || workspace?.maskyAvatarId?.trim());
}

/**
 * Describe the representative without touching the network.
 *
 * The Anam image is resolved separately (it costs an API call) — this is the
 * cheap, always-available description.
 */
export function describeRepresentative(
  workspace: Partial<WorkspaceAccount> | null | undefined,
): RepresentativeDescription {
  const senderName = workspace?.lastSenderName?.trim() || "";
  const representativeName = workspace?.representativeName?.trim() || "";

  if (hasPhotoAvatar(workspace)) {
    return {
      kind: "self",
      name: representativeName || senderName || "Your representative",
      imageUrl: workspace?.representativeImageUrl?.trim() || undefined,
      provider: "anam",
      configured: true,
    };
  }

  if (hasPersonaAvatar(workspace)) {
    return {
      kind: "persona",
      name: representativeName || "Your AI representative",
      imageUrl: workspace?.representativeImageUrl?.trim() || undefined,
      provider: workspace?.maskyAvatarId?.trim() ? "masky" : "synthesia",
      configured: true,
    };
  }

  return {
    kind: "unset",
    name: representativeName || "Your AI representative",
    imageUrl: workspace?.representativeImageUrl?.trim() || undefined,
    configured: false,
  };
}

/**
 * The sentence a prospect reads before deciding to talk.
 *
 * This is the disclosure, and it is the whole point of the two kinds: a
 * prospect who is talking to a face that looks like the sender must be told
 * that, in the same breath as the fact that it is an AI.
 */
export function representativeDisclosure(input: {
  kind: RepresentativeKind;
  senderName?: string;
  representativeName?: string;
}): string {
  const sender = (input.senderName || "").trim();
  const who = (input.representativeName || "").trim();

  if (input.kind === "self") {
    return sender
      ? `You are talking to ${sender}'s AI representative. It uses ${sender}'s photo and answers only from ${sender}'s notes.`
      : "You are talking to an AI representative. It uses the sender's photo and answers only from the sender's notes.";
  }

  if (input.kind === "persona") {
    const name = who ? `a disclosed AI representative called ${who}` : "a disclosed AI representative";
    return sender
      ? `You are talking to ${name}. It is not ${sender} — it stands in for them, and answers only from ${sender}'s notes.`
      : `You are talking to ${name}. It is not the sender — it stands in for them, and answers only from the sender's notes.`;
  }

  return "You are talking to an AI representative. It answers only from the sender's notes.";
}

/** A short label for the sender's own UI ("this is who answers"). */
export function representativeLabel(
  description: RepresentativeDescription,
  senderName?: string,
): string {
  const sender = (senderName || "").trim();
  switch (description.kind) {
    case "self":
      return sender
        ? `${sender}'s face, answering as an AI`
        : "Your photo, answering as an AI";
    case "persona":
      return description.name
        ? `${description.name} — a disclosed AI persona`
        : "A disclosed AI persona";
    default:
      return "Not set — your representative has no face yet";
  }
}

/**
 * Resolve the rendered media for a photo avatar. Anam returns the image it
 * generated and a video of it moving; failures degrade to no media rather
 * than an error — a missing picture must never break a prospect's page.
 */
export async function resolveRepresentativeMedia(
  workspace: Partial<WorkspaceAccount> | null | undefined,
): Promise<{ imageUrl?: string; videoUrl?: string }> {
  const override = workspace?.representativeImageUrl?.trim();
  const avatarId = workspace?.anamAvatarId?.trim();
  if (!avatarId) return { imageUrl: override || undefined };

  try {
    const avatar = await getAnamAvatar(avatarId);
    return {
      imageUrl: avatar.imageUrl || override || undefined,
      videoUrl: avatar.videoUrl || undefined,
    };
  } catch {
    return { imageUrl: override || undefined };
  }
}
