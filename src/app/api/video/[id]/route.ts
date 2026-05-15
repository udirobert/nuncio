import { NextRequest, NextResponse } from "next/server";
import { getVideoStatus } from "@/lib/heygen";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getVideoStatus(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to fetch video status",
      },
      { status: 502 }
    );
  }
}
