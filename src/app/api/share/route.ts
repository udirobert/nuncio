import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { AgentTraceItem } from "@/lib/artifacts";
import type { Profile } from "@/lib/claude";
import { readAccountSession } from "@/lib/auth/session";
import { isLiveLinkAllowed } from "@/lib/live-link";

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
  } = body;

  const session = readAccountSession(request);

  // Live links don't need a rendered video. Recorded videos do.
  const mode = deliveryMode === "livelink" ? "livelink" : "video";
  if (mode === "livelink" && !isLiveLinkAllowed({ workspaceId: session?.workspaceId, senderEmail: session?.email })) {
    return NextResponse.json({ error: "LiveLink is not enabled for this pilot" }, { status: 404 });
  }
  if (mode === "video" && videoUrl === undefined) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
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
  });

  const sharePath = mode === "livelink" ? `/live/${record.id}` : `/v/${record.id}`;
  // Keep the internal sender identity out of the public creation response.
  const publicRecord = { ...record };
  delete publicRecord.senderEmail;
  return NextResponse.json({ record: publicRecord, shareUrl: sharePath });
}