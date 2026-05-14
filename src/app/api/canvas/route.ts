import { NextRequest, NextResponse } from "next/server";
import { createCanvas } from "@/lib/melius";

export async function POST(request: NextRequest) {
  const { profile, script } = await request.json();

  if (!profile || !script) {
    return NextResponse.json(
      { error: "Profile and script are required" },
      { status: 400 }
    );
  }

  const result = await createCanvas(profile, script);
  return NextResponse.json(result);
}
