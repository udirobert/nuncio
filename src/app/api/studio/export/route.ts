import { NextRequest, NextResponse } from "next/server";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";

export async function POST(request: NextRequest) {
  try {
    const { canvasId } = await request.json();

    if (!canvasId) {
      return NextResponse.json({ error: "canvasId is required" }, { status: 400 });
    }

    resetMeliusSession();
    const melius = new MeliusProvider();

    const downloadUrl = await melius.exportCanvas(canvasId);

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "Could not export canvas — creative_download returned no URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("[studio/export] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Canvas export failed" },
      { status: 500 }
    );
  }
}
