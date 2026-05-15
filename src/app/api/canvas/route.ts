import { NextRequest, NextResponse } from "next/server";
import { createCanvas } from "@/lib/melius";

export async function POST(request: NextRequest) {
  try {
    const { profile, script } = await request.json();

    if (!profile || !script) {
      return NextResponse.json(
        { error: "Profile and script are required" },
        { status: 400 }
      );
    }

    const result = await createCanvas(profile, script);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Canvas creation failed" },
      { status: 500 }
    );
  }
}
