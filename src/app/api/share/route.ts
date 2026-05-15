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
  }: {
    videoUrl?: string;
    videoId?: string;
    recipientName?: string;
    senderName?: string;
    profile?: Profile;
    sources?: string[];
    canvas?: CanvasProof;
    trace?: AgentTraceItem[];
  } = body;

  if (!videoUrl) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  const record = await createShareRecord({
    videoUrl,
    videoId,
    recipientName,
    senderName,
    profile,
    sources,
    canvas,
    trace,
  });

  return NextResponse.json({ record, shareUrl: `/v/${record.id}` });
}