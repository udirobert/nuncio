import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { AgentTraceItem } from "@/lib/artifacts";
import type { Profile } from "@/lib/claude";
import { readAccountSession } from "@/lib/auth/session";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { getAccountStorageProvider } from "@/lib/storage";
import { normalizeCanAnswer, normalizeImageUrl } from "@/lib/sender-proof";
import {
  describeRepresentative,
  resolveRepresentativeMedia,
  type RepresentativeProvider,
} from "@/lib/representative";
import { resolvePrimaryProvider, resolveStartAttempts } from "@/lib/live-avatar-providers";
import { captureFunnelEvent } from "@/lib/funnel";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    videoUrl,
    videoId,
    recipientName,
    senderName,
    profile,
    sources,
    trace,
    privacy,
    industry,
    videoStyle,
    deliveryMode,
    mode: campaignMode,
    anamAvatarId: bodyAnamAvatarId,
    anamVoiceId: bodyAnamVoiceId,
  }: {
    videoUrl?: string;
    videoId?: string;
    recipientName?: string;
    senderName?: string;
    profile?: Profile;
    sources?: string[];
    trace?: AgentTraceItem[];
    privacy?: "public" | "private";
    industry?: string;
    videoStyle?: string;
    deliveryMode?: "video" | "livelink";
    mode?: "outreach" | "reconnect";
    anamAvatarId?: string;
    anamVoiceId?: string;
  } = body;

  const session = readAccountSession(request);

  const liveLinkAllowed = isLiveLinkAllowed({
    workspaceId: session?.workspaceId,
    senderEmail: session?.email,
  });

  // STRATEGY Phase 1: the live link is the primary artifact. An explicit
  // deliveryMode always wins; otherwise a rendered videoUrl implies video,
  // and livelink is the default whenever the pilot allows it.
  const mode = deliveryMode === "livelink" || deliveryMode === "video"
    ? deliveryMode
    : videoUrl !== undefined
      ? "video"
      : liveLinkAllowed
        ? "livelink"
        : "video";

  // Live links don't need a rendered video. Recorded videos do.
  if (mode === "livelink" && !liveLinkAllowed) {
    return NextResponse.json({ error: "LiveLink is not enabled for this pilot" }, { status: 404 });
  }
  if (mode === "video" && videoUrl === undefined) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  // Snapshot the sender's booking link and Anam assets onto the artifact so the live/share
  // pages can offer "Book time with {sender}" and the live session can load the right twin.
  // The sender's photo, logo and "what can it answer" line are snapshotted too: a
  // prospect must see the same proof they were shown when the link was created.
  let bookingUrl: string | undefined;
  let anamAvatarId: string | undefined = bodyAnamAvatarId;
  let anamVoiceId: string | undefined = bodyAnamVoiceId;
  let senderPhotoUrl: string | undefined;
  let senderCompanyLogoUrl: string | undefined;
  let senderCanAnswer: string | undefined;
  let representativeKind: "self" | "persona" | "unset" = "unset";
  let representativeName: string | undefined;
  let representativeImageUrl: string | undefined;
  if (session?.workspaceId) {
    const workspace = await getAccountStorageProvider().getWorkspace(session.workspaceId);
    bookingUrl = workspace?.bookingUrl?.trim() || undefined;
    anamAvatarId = anamAvatarId || workspace?.anamAvatarId;
    anamVoiceId = anamVoiceId || workspace?.anamVoiceId;
    senderPhotoUrl = normalizeImageUrl(workspace?.senderPhotoUrl);
    senderCompanyLogoUrl = normalizeImageUrl(workspace?.senderCompanyLogoUrl);
    senderCanAnswer = normalizeCanAnswer(workspace?.senderCanAnswer);
    // Who answers is part of the promise: a prospect must see the same face
    // they were shown, and be told the same thing about it. The resolution
    // follows the provider order the live session uses.
    const primary = resolvePrimaryProvider();
    const attempt = primary
      ? resolveStartAttempts(primary, { workspace, share: {} })[0]
      : undefined;
    const resolution = {
      provider: attempt?.adapter.id as RepresentativeProvider | undefined,
      avatarId: attempt?.ids.avatarId,
    };
    const representative = describeRepresentative(workspace, resolution);
    const media = await resolveRepresentativeMedia(workspace, resolution);
    representativeKind = representative.kind;
    representativeName = media.name ?? representative.name ?? undefined;
    representativeImageUrl = media.imageUrl ?? representative.imageUrl;
  }

  const record = await createShareRecord({
    videoUrl: videoUrl || "",
    videoId,
    recipientName,
    senderName,
    senderEmail: mode === "livelink" ? session?.email : undefined,
    profile,
    sources,
    trace,
    privacy: privacy || "public",
    industry,
    videoStyle,
    workspaceId: session?.workspaceId,
    deliveryMode: mode,
    bookingUrl,
    senderPhotoUrl,
    senderCompanyLogoUrl,
    senderCanAnswer,
    representativeKind,
    representativeName,
    representativeImageUrl,
    mode: campaignMode === "reconnect" ? "reconnect" : "outreach",
    anamAvatarId,
    anamVoiceId,
  });

  const sharePath = mode === "livelink" ? `/live/${record.id}` : `/v/${record.id}`;
  // Funnel step 1: the first touch exists.
  captureFunnelEvent({
    workspaceId: record.workspaceId,
    shareId: record.id,
    event: "first_touch_sent",
    properties: { delivery_mode: mode, mode: record.mode },
  });
  // Keep the internal sender identity out of the public creation response.
  const publicRecord = { ...record };
  delete publicRecord.senderEmail;
  return NextResponse.json({ record: publicRecord, shareUrl: sharePath });
}