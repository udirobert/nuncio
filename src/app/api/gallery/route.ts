import { NextRequest, NextResponse } from "next/server";
import { listShares } from "@/lib/share-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  // Only return public shares for the gallery
  const records = await listShares({ limit, privacy: "public", industry });

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      recipientName: r.recipientName,
      profile: r.profile,
      industry: r.industry,
      videoUrl: r.videoUrl,
      createdAt: r.createdAt,
    })),
  });
}