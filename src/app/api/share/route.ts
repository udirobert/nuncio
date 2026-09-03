import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { AgentTraceItem } from "@/lib/artifacts";
import type { Profile } from "@/lib/claude";
import { readAccountSession } from "@/lib/auth/session";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { getAccountStorageProvider } from "@/lib/storage";

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
  let bookingUrl: string | undefined;
  let anamAvatarId: string | undefined = bodyAnamAvatarId;
  let anamVoiceId: string | undefined = bodyAnamVoiceId;
  if (session?.workspaceId) {
    const workspace = await getAccountStorageProvider().getWorkspace(session.workspaceId);
    bookingUrl = workspace?.bookingUrl?.trim() || undefined;
    anamAvatarId = anamAvatarId || workspace?.anamAvatarId;
    anamVoiceId = anamVoiceId || workspace?.anamVoiceId;
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
    mode: campaignMode === "reconnect" ? "reconnect" : "outreach",
    anamAvatarId,
    anamVoiceId,
  });

  const sharePath = mode === "livelink" ? `/live/${record.id}` : `/v/${record.id}`;
  // Keep the internal sender identity out of the public creation response.
  const publicRecord = { ...record };
  delete publicRecord.senderEmail;
  return NextResponse.json({ record: publicRecord, shareUrl: sharePath });
}