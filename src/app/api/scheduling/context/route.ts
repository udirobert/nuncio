import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getShareRecord } from "@/lib/share-store";
import { getLiveSessionStorageProvider, getSchedulingStorageProvider } from "@/lib/storage";
import { checkRateLimit, getClientId } from "@/lib/rate-limit";
import { isLiveLinkAllowed } from "@/lib/live-link";
import { authorizeHandoffShare, validateHandoffBookingUrl } from "@/lib/live-handoff";
import { hashLiveSessionToken } from "@/lib/live-session";
import { browserMutationAllowed } from "@/lib/call-request";
import { parseLiveCallBrief } from "@/lib/live-call-brief";
import {
  getCalcomPilotConfig,
  mintSchedulingContextToken,
} from "@/lib/scheduling-server";
import type { SchedulingRecord } from "@/lib/storage/types";

const PRIVATE_HEADERS = { "Cache-Control": "no-store", Vary: "Cookie" };
const CONTEXT_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 };
const CONTEXT_MAX_BODY_BYTES = 16 * 1024;

async function readBoundedBody(request: NextRequest, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    return Buffer.byteLength(text, "utf8") <= maxBytes ? text : null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

export async function GET(request: NextRequest) {
  const config = getCalcomPilotConfig();
  if (!config) {
    return NextResponse.json({ tracked: false }, { headers: PRIVATE_HEADERS });
  }
  const shareId = request.nextUrl.searchParams.get("shareId") || "";
  if (!shareId) {
    return NextResponse.json({ tracked: false }, { headers: PRIVATE_HEADERS });
  }
  try {
    const share = await getShareRecord(shareId);
    const tracked = Boolean(
      share
      && share.deliveryMode === "livelink"
      && share.workspaceId === config.workspaceId
      && validateHandoffBookingUrl(share.bookingUrl) === config.bookingUrl
      && isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail })
      && await authorizeHandoffShare(request, share),
    );
    return NextResponse.json({ tracked }, { headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ tracked: false }, { headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  const config = getCalcomPilotConfig();
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const raw = await readBoundedBody(request, CONTEXT_MAX_BODY_BYTES);
  const body = raw === null ? null : (() => {
    try { return JSON.parse(raw) as unknown; } catch { return null; }
  })() as {
    shareId?: string;
    liveSessionId?: string;
    syncToken?: string;
    briefConsent?: unknown;
    liveBrief?: unknown;
  } | null;

  if (!body || typeof body.shareId !== "string" || !body.shareId || body.shareId.length > 128) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (typeof body.liveSessionId === "string" && body.liveSessionId.length > 256) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (typeof body.syncToken === "string" && body.syncToken.length > 256) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (body.liveBrief !== undefined && body.briefConsent !== true) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const share = await getShareRecord(body.shareId);
    if (!share || share.deliveryMode !== "livelink" || !share.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (!isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail })) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    if (!await authorizeHandoffShare(request, share)) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }

    if (share.workspaceId !== config.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    const shareBooking = validateHandoffBookingUrl(share.bookingUrl);
    if (!shareBooking || shareBooking !== config.bookingUrl) {
      return NextResponse.json({ error: "Scheduling is not configured for this link" }, { status: 404, headers: PRIVATE_HEADERS });
    }

    const rateLimit = await checkRateLimit(
      `scheduling.context:${getClientId(request)}`,
      "scheduling.context",
      CONTEXT_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly.", retryAfter: rateLimit.resetIn },
        { status: 429, headers: { ...PRIVATE_HEADERS, "Retry-After": String(rateLimit.resetIn) } },
      );
    }

    let reviewedBrief: SchedulingRecord["reviewedBrief"];
    if (body.briefConsent === true) {
      const sessionId = typeof body.liveSessionId === "string" ? body.liveSessionId : "";
      const syncToken = typeof body.syncToken === "string" ? body.syncToken : "";
      const session = sessionId ? await getLiveSessionStorageProvider().get(sessionId) : null;
      const proofValid = Boolean(
        session
        && session.shareId === share.id
        && session.workspaceId === share.workspaceId
        && (session.status === "pending" || session.status === "active")
        && hashLiveSessionToken(syncToken) === session.syncTokenHash,
      );
      const brief = proofValid ? parseLiveCallBrief(body.liveBrief) : null;
      if (!proofValid || !brief) {
        return NextResponse.json({ error: "Invalid live session proof or brief" }, { status: 400, headers: PRIVATE_HEADERS });
      }
      reviewedBrief = { ...brief, source: "recipient_reviewed", sharedAt: new Date().toISOString() };
    }

    const record: SchedulingRecord = {
      id: randomUUID(),
      shareId: share.id,
      workspaceId: share.workspaceId,
      provider: "calcom",
      eventTypeId: config.eventTypeId,
      createdAt: new Date().toISOString(),
      status: "started",
      reviewedBrief,
      version: 0,
    };
    await getSchedulingStorageProvider().create(record);

    const token = mintSchedulingContextToken(record.id, config.contextSecret);
    return NextResponse.json({ contextToken: token }, { headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ error: "Scheduling context unavailable" }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
