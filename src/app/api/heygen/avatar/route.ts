import { NextRequest, NextResponse } from "next/server";
import { createPhotoAvatar, getAvatarStatus } from "@/lib/heygen";

/**
 * POST /api/heygen/avatar — Create a photo avatar from an uploaded image URL.
 * GET /api/heygen/avatar?id=xxx — Poll avatar training status.
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl, name } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const result = await createPhotoAvatar(imageUrl, name);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[heygen/avatar] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Avatar creation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const avatarId = request.nextUrl.searchParams.get("id");
  if (!avatarId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const status = await getAvatarStatus(avatarId);
    return NextResponse.json(status);
  } catch (err) {
    console.error("[heygen/avatar] Status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
