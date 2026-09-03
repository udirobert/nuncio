import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { createAnamAvatar, getAnamAvatar } from "@/lib/anam";
import { getAccountStorageProvider } from "@/lib/storage";
import { reserveCredits, commitCreditReservation, refundCreditReservation, InsufficientCreditsError, getCreditSubject } from "@/lib/billing/credits";
import { getAnamAvatarTrainingCreditCost } from "@/lib/live-link";

function anamErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Live twin training failed";
  const lower = message.toLowerCase();

  if (lower.includes("anam_api_key") || lower.includes("not configured")) {
    return NextResponse.json({ error: "Live twin training isn't configured on this deployment." }, { status: 503 });
  }
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json({ error: err.message }, { status: 402 });
  }
  if (lower.includes("403") || lower.includes("plan") || lower.includes("enterprise")) {
    return NextResponse.json(
      { error: "Your Anam plan doesn't support this feature. Upgrade your Anam account or use the recorded video option." },
      { status: 403 }
    );
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * POST /api/anam/avatar
 * Create a one-shot Anam avatar from an image file (data URL) or public image URL.
 * If the caller has an account session, the resulting avatarId is persisted to the workspace.
 */
export async function POST(request: NextRequest) {
  let reservationId: string | undefined;
  try {
    const { imageUrl, name } = (await request.json()) as { imageUrl?: string; name?: string };

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    if (!process.env.ANAM_API_KEY) {
      return NextResponse.json({ error: "Live twin training isn't configured on this deployment." }, { status: 503 });
    }

    const subject = getCreditSubject(request);
    const cost = getAnamAvatarTrainingCreditCost();
    const reservation = await reserveCredits({
      subject,
      action: "live.avatar",
      amount: cost,
      reason: "Anam avatar training",
      provider: "anam",
    });
    reservationId = reservation.id;

    const result = await createAnamAvatar({ imageUrl, displayName: name || "My Avatar" });

    await commitCreditReservation(reservation.id);

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
    if (reservationId) await refundCreditReservation(reservationId, "avatar_creation_failed");
    console.error("[anam/avatar] Error:", err);
    return anamErrorResponse(err);
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
      {
        status: "failed",
        error: err instanceof Error ? err.message : "Status check failed",
      },
      { status: 200 }
    );
  }
}
