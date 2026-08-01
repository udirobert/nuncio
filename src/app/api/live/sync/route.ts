import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getLiveSessionStorageProvider } from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";
import {
  expireStaleLiveSessions,
  hashLiveSessionToken,
  parseLiveSessionDuration,
  reconcileLiveSession,
  type LiveSessionEndReason,
} from "@/lib/live-session";

const END_REASONS: LiveSessionEndReason[] = [
  "manual",
  "provider_closed",
  "max_duration",
  "unload",
];

export async function POST(request: NextRequest) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "LiveLink is not enabled" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      shareId?: string;
      durationMs?: unknown;
      reason?: string;
      syncToken?: string;
    };

    if (!body.sessionId || !body.shareId) {
      return NextResponse.json({ error: "sessionId and shareId are required" }, { status: 400 });
    }

    const record = await getLiveSessionStorageProvider().get(body.sessionId);
    if (!record || record.shareId !== body.shareId || !body.syncToken) {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    if (hashLiveSessionToken(body.syncToken) !== record.syncTokenHash) {
      return NextResponse.json({ error: "Invalid live session token" }, { status: 403 });
    }

    const share = await getShareRecord(body.shareId);
    if (!share || share.deliveryMode !== "livelink") {
      return NextResponse.json({ error: "Live link not found" }, { status: 404 });
    }

    const durationMs = parseLiveSessionDuration(body.durationMs);
    if (durationMs === null) {
      return NextResponse.json({ error: "durationMs must be a non-negative number" }, { status: 400 });
    }

    const reason = END_REASONS.includes(body.reason as LiveSessionEndReason)
      ? body.reason as LiveSessionEndReason
      : "manual";
    const updated = await reconcileLiveSession({ record, durationMs, reason });
    await expireStaleLiveSessions();

    return NextResponse.json({
      sessionId: updated.id,
      status: updated.status,
      durationMs: updated.durationMs || 0,
      chargedCredits: updated.chargedCredits,
    });
  } catch (error) {
    console.error("[api/live/sync] error:", error);
    return NextResponse.json({ error: "Failed to reconcile live session" }, { status: 500 });
  }
}
