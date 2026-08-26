import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { getLiveSessionStorageProvider } from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";

/**
 * Scoreboard read path (STRATEGY Phase 1): recent terminal live sessions for
 * the signed-in workspace, including instrumentation metrics. Secrets that
 * authorize writes (syncTokenHash, reservationId) are stripped.
 */
export async function GET(request: NextRequest) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "LiveLink is not enabled" }, { status: 404 });
  }

  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const records = await getLiveSessionStorageProvider().listRecent({
    workspaceId: session.workspaceId,
  });

  return NextResponse.json({
    sessions: records.map((record) => ({
      id: record.id,
      shareId: record.shareId,
      status: record.status,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      durationMs: record.durationMs,
      terminalReason: record.terminalReason,
      metrics: record.metrics,
    })),
  });
}
