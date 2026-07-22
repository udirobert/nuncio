import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { AgentTraceItem } from "@/lib/artifacts";
import type { Profile } from "@/lib/claude";
import { readAccountSession } from "@/lib/auth/session";

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
  if (mode === "video" && videoUrl === undefined) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  const record = await createShareRecord({
    videoUrl: videoUrl || "",
    videoId,
    recipientName,
    senderName,
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
  return NextResponse.json({ record, shareUrl: sharePath });
}