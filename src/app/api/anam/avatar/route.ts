import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { createAnamAvatar, getAnamAvatar } from "@/lib/anam";
import { getAccountStorageProvider } from "@/lib/storage";

/**
 * POST /api/anam/avatar
 * Create a one-shot Anam avatar from an image file (data URL) or public image URL.
 * If the caller has an account session, the resulting avatarId is persisted to the workspace.
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl, name } = (await request.json()) as { imageUrl?: string; name?: string };

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const result = await createAnamAvatar({ imageUrl, displayName: name || "My Avatar" });

    const session = readAccountSession(request);
    if (session?.workspaceId) {
      try {
        await getAccountStorageProvider().updateWorkspace(session.workspaceId, { anamAvatarId: result.avatarId });
      } catch (err) {
        console.error("[anam/avatar] Failed to persist avatar to workspace:", err);
      }
    }

    return NextResponse.json({ avatarId: result.avatarId, imageUrl: result.imageUrl });
  } catch (err) {
    console.error("[anam/avatar] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Avatar creation failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/anam/avatar?id=xxx
 * Poll the status of an Anam avatar.
 */
export async function GET(request: NextRequest) {
  const avatarId = request.nextUrl.searchParams.get("id");
  if (!avatarId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const status = await getAnamAvatar(avatarId);
    return NextResponse.json({
      ...status,
      status: status.videoUrl ? "completed" : "processing",
    });
  } catch (err) {
    console.error("[anam/avatar] Status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
