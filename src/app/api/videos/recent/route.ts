import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { listShares } from "@/lib/share-store";

const OWNER_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ videos: [], firstTouches: [] }, { headers: OWNER_HEADERS });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(Math.floor(Number(searchParams.get("limit")) || 20), 50));

  const shares = await listShares({
    workspaceId: session.workspaceId,
    limit,
  });

  const videos = shares
    .filter((s) => s.videoUrl)
    .map((s) => ({
      id: s.id,
      videoUrl: s.videoUrl,
      videoId: s.videoId,
      recipientName: s.recipientName,
      createdAt: s.createdAt,
      privacy: s.privacy,
    }));

  const firstTouches = shares.map((s) => ({
    id: s.id,
    recipientName: s.recipientName,
    senderName: s.senderName,
    createdAt: s.createdAt,
    privacy: s.privacy,
    deliveryMode: s.deliveryMode,
    hasRecordedVideo: Boolean(s.videoUrl || s.videoId),
    invitationProtected: Boolean(s.handoffId),
  }));

  return NextResponse.json({ videos, firstTouches }, { headers: OWNER_HEADERS });
}
