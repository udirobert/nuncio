import { NextRequest, NextResponse } from "next/server";
import { expireStaleLiveSessions } from "@/lib/live-session";
import { getLiveSessionStorageProvider } from "@/lib/storage";
import { hasAcceptedRoom, runCallRequestCleanup } from "@/lib/call-request";
import { cleanupSynthesiaSession } from "@/lib/livekit";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.NUNCIO_LIVELINK_CRON_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return provided === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const callCleanup = await runCallRequestCleanup();
    const expired = await expireStaleLiveSessions();
    const liveProvider = getLiveSessionStorageProvider();
    const pendingTwinCleanup = await liveProvider.listForCleanup();
    const byId = new Map(pendingTwinCleanup.map((session) => [session.id, session]));
    for (const session of expired) {
      if (session.provider === "synthesia" && session.roomName && !session.roomClosedAt) {
        byId.set(session.id, session);
      }
    }
    let twinErrors = 0;
    for (const session of byId.values()) {
      try {
        if (await hasAcceptedRoom(session.roomName!)) continue;
      } catch {
        twinErrors += 1;
        continue;
      }
      const closed = await cleanupSynthesiaSession({ roomName: session.roomName! });
      const current = await liveProvider.get(session.id);
      if (current) {
        await liveProvider.update(closed
          ? { ...current, roomClosedAt: new Date().toISOString(), cleanupError: false }
          : { ...current, cleanupError: true });
      }
      if (!closed) twinErrors += 1;
    }
    return NextResponse.json({
      expired: expired.length,
      sessions: expired.map((session) => session.id),
      callRequests: callCleanup,
      twinRoomErrors: twinErrors,
    });
  } catch (error) {
    console.error("[api/live/expire] error:", error);
    return NextResponse.json({ error: "Failed to expire live sessions" }, { status: 500 });
  }
}
