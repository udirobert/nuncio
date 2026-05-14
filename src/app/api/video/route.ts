import { NextRequest, NextResponse } from "next/server";
import { createVideo } from "@/lib/heygen";

export async function POST(request: NextRequest) {
  const { script, assetUrls } = await request.json();

  if (!script) {
    return NextResponse.json(
      { error: "Script is required" },
      { status: 400 }
    );
  }

  const result = await createVideo(script, assetUrls);
  return NextResponse.json(result);
}
