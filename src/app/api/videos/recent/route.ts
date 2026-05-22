import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { listShares } from "@/lib/share-store";

export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ videos: [] });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

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

  return NextResponse.json({ videos });
}
