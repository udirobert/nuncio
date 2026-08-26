import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getLiveSessionStorageProvider } from "@/lib/storage";
import { isLiveLinkEnabled } from "@/lib/live-link";
import {
  expireStaleLiveSessions,
  hashLiveSessionToken,
  parseLiveSessionDuration,
  reconcileLiveSession,
  recordLiveSessionTelemetry,
  type LiveSessionEndReason,
  type LiveSessionTelemetryMetrics,
} from "@/lib/live-session";
import { LIVE_QUESTION_TOPICS } from "@/lib/live-topics";

const END_REASONS: LiveSessionEndReason[] = [
  "manual",
  "provider_closed",
  "max_duration",
  "unload",
];

const MAX_TOPIC_LABELS = LIVE_QUESTION_TOPICS.length;

function clampTurns(value: unknown): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(parsed, 0), 1000);
}

/**
 * Sanitise client-reported telemetry. Fields are clamped/filtered where
 * salvageable; a malformed `firstUserTurnAt` invalidates the whole payload.
 * Returns undefined when the metrics should be ignored entirely — callers must
 * still process the sync itself.
 */
function sanitizeLiveSessionMetrics(input: unknown): LiveSessionTelemetryMetrics | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Record<string, unknown>;

  let firstUserTurnAt: string | undefined;
  if (raw.firstUserTurnAt !== undefined && raw.firstUserTurnAt !== null) {
    if (typeof raw.firstUserTurnAt !== "string" || Number.isNaN(Date.parse(raw.firstUserTurnAt))) {
      return undefined;
    }
    firstUserTurnAt = new Date(raw.firstUserTurnAt).toISOString();
  }

  const questionTopics = Array.isArray(raw.questionTopics)
    ? Array.from(new Set(
        raw.questionTopics.filter(
          (topic): topic is string =>
            typeof topic === "string" && (LIVE_QUESTION_TOPICS as readonly string[]).includes(topic),
        ),
      )).slice(0, MAX_TOPIC_LABELS)
    : [];

  return {
    userTurns: clampTurns(raw.userTurns),
    agentTurns: clampTurns(raw.agentTurns),
    questionTopics,
    bookingClicked: raw.bookingClicked === true,
    bookingUrlPresent: raw.bookingUrlPresent === true,
    lastEvent: typeof raw.lastEvent === "string" && raw.lastEvent.trim()
      ? raw.lastEvent.slice(0, 40)
      : undefined,
    firstUserTurnAt,
  };
}

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
      metrics?: unknown;
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

    const metrics = sanitizeLiveSessionMetrics(body.metrics);
    if (metrics) {
      // The server knows whether the share carries a booking link — never let
      // a client claim otherwise.
      metrics.bookingUrlPresent = metrics.bookingUrlPresent || Boolean(share.bookingUrl);
    }

    // Heartbeat path: no reason means the session is still running — record
    // telemetry without ending anything or touching credits.
    if (body.reason === undefined || body.reason === null) {
      let heartbeatDurationMs: number | undefined;
      if (body.durationMs !== undefined) {
        const parsed = parseLiveSessionDuration(body.durationMs);
        if (parsed === null) {
          return NextResponse.json({ error: "durationMs must be a non-negative number" }, { status: 400 });
        }
        heartbeatDurationMs = parsed;
      }
      const updated = await recordLiveSessionTelemetry({
        record,
        metrics: metrics ?? {
          userTurns: 0,
          agentTurns: 0,
          questionTopics: [],
          bookingClicked: false,
          bookingUrlPresent: Boolean(share.bookingUrl),
        },
        durationMs: heartbeatDurationMs,
      });
      await expireStaleLiveSessions();
      return NextResponse.json({
        sessionId: updated.id,
        status: updated.status,
        heartbeated: true,
      });
    }

    const durationMs = parseLiveSessionDuration(body.durationMs);
    if (durationMs === null) {
      return NextResponse.json({ error: "durationMs must be a non-negative number" }, { status: 400 });
    }

    const reason = END_REASONS.includes(body.reason as LiveSessionEndReason)
      ? body.reason as LiveSessionEndReason
      : "manual";
    const updated = await reconcileLiveSession({ record, durationMs, reason, metrics });
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
