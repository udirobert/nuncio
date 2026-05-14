import { NextRequest, NextResponse } from "next/server";
import { enrich } from "@/lib/tinyfish";

export async function POST(request: NextRequest) {
  const { urls } = await request.json();

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "At least one URL is required" },
      { status: 400 }
    );
  }

  const result = await enrich(urls);
  return NextResponse.json(result);
}
