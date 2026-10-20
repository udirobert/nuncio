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
 *
 * The description is resolved against the *provider that will actually
 * answer* — the same resolution order the live session uses (primary → anam
 * → masky). Showing a face that will not be the one on the call would be
 * worse than showing none.
 */

import { getAnamAvatar } from "@/lib/anam";
import type { WorkspaceAccount } from "@/lib/storage/types";

export type RepresentativeKind = "self" | "persona" | "unset";
export type RepresentativeProvider = "anam" | "synthesia" | "masky";

export interface RepresentativeDescription {
  kind: RepresentativeKind;
  /** Display name — the persona's name, or the sender's name for a photo avatar. */
  name: string;
  /** Rendered image of the representative, when one can be resolved. */
  imageUrl?: string;
  /** Which provider will serve the conversation. */
  provider?: RepresentativeProvider;
  /** Whether an avatar is configured at all. */
  configured: boolean;
}

/** What the provider resolution decided: which avatar will answer. */
export interface RepresentativeResolution {
  provider?: RepresentativeProvider;
  /** The avatar id that will actually be used. */
  avatarId?: string;
}

/**
 * Describe the representative without touching the network.
 *
 * The Anam image is resolved separately (it costs an API call) — this is the
 * cheap, always-available description.
 */
export function describeRepresentative(
  workspace: Partial<WorkspaceAccount> | null | undefined,
  resolution: RepresentativeResolution = {},
): RepresentativeDescription {
  const senderName = workspace?.lastSenderName?.trim() || "";
  const representativeName = workspace?.representativeName?.trim() || "";
  const provider = resolution.provider;
  const avatarId = resolution.avatarId?.trim();

  // The sender's own photo means the representative *is* them, visually.
  if (avatarId && workspace?.anamAvatarId && avatarId === workspace.anamAvatarId) {
    return {
      kind: "self",
      name: representativeName || senderName || "Your representative",
      imageUrl: workspace?.representativeImageUrl?.trim() || undefined,
      provider,
      configured: true,
    };
  }

  if (avatarId) {
    return {
      kind: "persona",
      name: representativeName || "Your AI representative",
      imageUrl: workspace?.representativeImageUrl?.trim() || undefined,
      provider,
      configured: true,
    };
  }

  return {
    kind: "unset",
    name: representativeName || "Your AI representative",
    imageUrl: workspace?.representativeImageUrl?.trim() || undefined,
    provider,
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

/**
 * The one-line detail, used under a heading that already says who is
 * speaking. The full sentence (above) is for a surface that has no heading
 * of its own.
 */
export function representativeSummary(input: {
  kind: RepresentativeKind;
  senderName?: string;
}): string {
  const sender = (input.senderName || "").trim();
  switch (input.kind) {
    case "self":
      return sender
        ? `It uses ${sender}'s photo, and answers only from ${sender}'s notes.`
        : "It uses the sender's photo, and answers only from the sender's notes.";
    case "persona":
      return sender
        ? `It is not ${sender} — it stands in for them, and answers only from ${sender}'s notes.`
        : "It is not the sender — it stands in for them, and answers only from the sender's notes.";
    default:
      return "It answers only from the sender's notes.";
  }
}

/**
 * The heading: who is speaking, in the prospect's own words.
 */
export function representativeHeadline(input: {
  kind: RepresentativeKind;
  senderName?: string;
  representativeName?: string;
}): string {
  const sender = (input.senderName || "").trim();
  const who = (input.representativeName || "").trim();
  switch (input.kind) {
    case "self":
      return sender ? `${sender}'s AI representative` : "The sender's AI representative";
    case "persona":
      return who ? `A disclosed AI representative called ${who}` : "A disclosed AI representative";
    default:
      return "An AI representative";
  }
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
 * Resolve the rendered media for the avatar that will answer.
 *
 * Only the Anam path can hand back a picture and a clip. For a provider
 * persona the sender can supply their own image, and the provider's own
 * catalogue is not something we can render here — so the sender's image is
 * used instead, and the name they chose goes with it.
 *
 * Failures degrade to no media rather than an error: a missing picture must
 * never break a prospect's page.
 */
export async function resolveRepresentativeMedia(
  workspace: Partial<WorkspaceAccount> | null | undefined,
  resolution: RepresentativeResolution = {},
): Promise<{ imageUrl?: string; videoUrl?: string; name?: string }> {
  const override = workspace?.representativeImageUrl?.trim();
  const avatarId = resolution.avatarId?.trim();
  const senderName = workspace?.lastSenderName?.trim() || "";
  const configuredName = workspace?.representativeName?.trim() || "";

  if (!avatarId || resolution.provider !== "anam") {
    return {
      imageUrl: override || undefined,
      name: configuredName || undefined,
    };
  }

  try {
    const avatar = await getAnamAvatar(avatarId);
    const isPhoto = workspace?.anamAvatarId && avatarId === workspace.anamAvatarId;
    return {
      imageUrl: avatar.imageUrl || override || undefined,
      videoUrl: avatar.videoUrl || undefined,
      // The provider's own name for the persona ("Gabriel"), unless the
      // sender named it themselves.
      name: configuredName || (isPhoto ? senderName : avatar.displayName) || undefined,
    };
  } catch {
    return { imageUrl: override || undefined, name: configuredName || undefined };
  }
}
