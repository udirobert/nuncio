import { NextRequest, NextResponse } from "next/server";
import { createShareRecord } from "@/lib/share-store";
import type { CanvasProof, AgentTraceItem } from "@/lib/artifacts";
import type { Profile } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    videoUrl,
    videoId,
    recipientName,
    senderName,
    profile,
    sources,
    canvas,
    trace,
    privacy,
    industry,
    videoStyle,
  }: {
    videoUrl?: string;
    videoId?: string;
    recipientName?: string;
    senderName?: string;
    profile?: Profile;
    sources?: string[];
    canvas?: CanvasProof;
    trace?: AgentTraceItem[];
    privacy?: "public" | "private";
    industry?: string;
    videoStyle?: string;
  } = body;

  // Allow empty videoUrl for early-share (before video renders)
  // but require it for final share record
  if (videoUrl === undefined) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  const record = await createShareRecord({
    videoUrl: videoUrl || "",
    videoId,
    recipientName,
    senderName,
    profile,
    sources,
    canvas,
    trace,
    privacy: privacy || "public",
    industry,
    videoStyle,
  });

  return NextResponse.json({ record, shareUrl: `/v/${record.id}` });
}