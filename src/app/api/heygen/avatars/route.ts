import { NextResponse } from "next/server";
import { getAvatars } from "@/lib/heygen";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const avatars = await getAvatars();
    return NextResponse.json({ avatars });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch avatars" },
      { status: 500 }
    );
  }
}
