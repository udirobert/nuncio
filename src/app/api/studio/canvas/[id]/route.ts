import { NextRequest, NextResponse } from "next/server";
import { MeliusProvider, resetMeliusSession } from "@/lib/creative/melius-provider";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: canvasId } = await params;
    const meliusApiKey = request.nextUrl.searchParams.get("key") || undefined;

    if (!canvasId) {
      return NextResponse.json({ error: "Canvas ID is required" }, { status: 400 });
    }

    resetMeliusSession();
    const melius = new MeliusProvider(meliusApiKey);

    const content = await melius.getCanvasContent(canvasId);

    return NextResponse.json(content);
  } catch (error) {
    console.error("[studio/canvas] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get canvas state" },
      { status: 500 }
    );
  }
}
