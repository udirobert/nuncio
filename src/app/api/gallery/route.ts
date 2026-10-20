import { NextRequest, NextResponse } from "next/server";
import { listShares } from "@/lib/share-store";

/**
 * Public showcase of public first touches.
 *
 * Privacy: a public *share* means the recipient can open the link — it does
 * not mean the prospect's identity should be published. This route returns
 * the artifact and nothing that identifies the recipient: no name, no
 * researched profile, no role, no company.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  // Only public, non-handoff shares are eligible.
  const records = await listShares({ limit, privacy: "public", industry });

  return NextResponse.json({
    records: records
      .filter((r) => !r.handoffId)
      .map((r) => ({
        id: r.id,
        industry: r.industry,
        videoUrl: r.videoUrl,
        createdAt: r.createdAt,
        title: "A first touch",
      })),
  });
}
