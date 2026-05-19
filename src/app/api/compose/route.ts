import { NextRequest, NextResponse } from "next/server";
import { composeFinalVideo } from "@/lib/hooks/compose";

export async function POST(request: NextRequest) {
  try {
    const { hookUrl, bodyUrl } = await request.json();

    if (!hookUrl || !bodyUrl) {
      return NextResponse.json(
        { error: "Both hookUrl and bodyUrl are required" },
        { status: 400 },
      );
    }

    const result = await composeFinalVideo(hookUrl, bodyUrl);

    return NextResponse.json({
      composedUrl: result.composedUrl,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("[api/compose] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Composition failed",
        composedUrl: null,
        skipped: false,
      },
      { status: 200 },
    );
  }
}
