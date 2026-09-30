import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import {
  getAccountStorageProvider,
  getCallRequestStorageProvider,
  getHandoffStorageProvider,
  getLiveSessionStorageProvider,
} from "@/lib/storage";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { readAccountSession } from "@/lib/auth/session";
import { hashLiveSessionToken } from "@/lib/live-session";
import { parseLiveCallBrief } from "@/lib/live-call-brief";
import { isLiveLinkEnabled } from "@/lib/live-link";
import { authorizeHandoffShare } from "@/lib/live-handoff";
import {
  CALL_REQUEST_PENDING_TTL_MS,
  areCallRequestsEnabledForShare,
  browserMutationAllowed,
  isCallAvailabilityActive,
  isWorkspaceOwner,
  mintRecipientToken,
  runCallRequestCleanup,
} from "@/lib/call-request";
import { callRequestTimings, summarizeCallRequests } from "@/lib/call-connection";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Recipient entry point: create a call request on a live share. Gated on the
 * LiveLink pilot allowlist, a valid workspace share, LiveKit infra, explicit
 * sender availability, and a per-IP rate limit. Creates no paid avatar work —
 * the request is a durable inbox item for the owner.
 */
export async function POST(request: NextRequest) {
  if (!isLiveLinkEnabled()) {
    return NextResponse.json({ error: "LiveLink is not enabled" }, { status: 404, headers: NO_STORE });
  }

  const body = (await request.json().catch(() => null)) as {
    shareId?: string;
    liveSessionId?: string;
    syncToken?: string;
    liveBrief?: unknown;
    briefConsent?: unknown;
  } | null;
  const shareId = body?.shareId;
  if (!shareId || typeof shareId !== "string") {
    return NextResponse.json({ error: "shareId is required" }, { status: 400, headers: NO_STORE });
  }
  if (body?.liveSessionId !== undefined && (typeof body.liveSessionId !== "string" || !body.liveSessionId)) {
    return NextResponse.json({ error: "liveSessionId must be a string" }, { status: 400, headers: NO_STORE });
  }

  const share = await getShareRecord(shareId);
  if (!share || share.deliveryMode !== "livelink" || !share.workspaceId) {
    return NextResponse.json({ error: "Live link not found" }, { status: 404, headers: NO_STORE });
  }

  if (!await authorizeHandoffShare(request, share)) {
    return NextResponse.json({ error: "Live link not found" }, { status: 404, headers: NO_STORE });
  }
  if (share.handoffId && !browserMutationAllowed(request, true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  if (!areCallRequestsEnabledForShare(share)) {
    return NextResponse.json({ error: "Call requests are not available for this link" }, { status: 404, headers: NO_STORE });
  }

  const rateLimit = await checkRateLimit(getClientId(request), "live.callRequest", RATE_LIMITS.live);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", retryAfter: rateLimit.resetIn },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rateLimit.resetIn) } },
    );
  }

  const workspace = await getAccountStorageProvider().getWorkspace(share.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Live link not found" }, { status: 404, headers: NO_STORE });
  }

  // Explicit, expiring availability only — never inferred from a calendar.
  if (!isCallAvailabilityActive(workspace)) {
    return NextResponse.json({ error: "The sender is not taking calls right now" }, { status: 409, headers: NO_STORE });
  }

  // A request tied to a live twin session must prove it holds that session.
  if (body.liveSessionId) {
    const session = await getLiveSessionStorageProvider().get(body.liveSessionId);
    const valid = session
      && session.shareId === shareId
      && session.workspaceId === share.workspaceId
      && (session.status === "pending" || session.status === "active")
      && typeof body.syncToken === "string"
      && hashLiveSessionToken(body.syncToken) === session.syncTokenHash;
    if (!valid) {
      return NextResponse.json({ error: "Invalid live session proof" }, { status: 403, headers: NO_STORE });
    }
  }

  // A live brief is stored only when the recipient explicitly reviewed and
  // consented — and only while bound to a proven live session.
  let liveBrief: import("@/lib/storage/types").CallRequestRecord["liveBrief"];
  if (body.liveBrief !== undefined) {
    if (body.briefConsent !== true || !body.liveSessionId) {
      return NextResponse.json({ error: "Invalid brief consent" }, { status: 400, headers: NO_STORE });
    }
    const parsed = parseLiveCallBrief(body.liveBrief);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid live brief" }, { status: 400, headers: NO_STORE });
    }
    liveBrief = { ...parsed, source: "recipient_reviewed", sharedAt: new Date().toISOString() };
  }

  const { token, hash } = mintRecipientToken();
  const now = new Date();
  const record = await getCallRequestStorageProvider().createIfNoOpen({
    id: crypto.randomUUID(),
    shareId,
    workspaceId: share.workspaceId,
    recipientTokenHash: hash,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CALL_REQUEST_PENDING_TTL_MS).toISOString(),
    liveSessionId: body.liveSessionId,
    liveBrief,
  }, now);

  if (!record) {
    return NextResponse.json(
      { error: "A call request is already open for this link" },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      requestId: record.id,
      recipientToken: token,
      status: record.status,
      expiresAt: record.expiresAt,
    },
    { headers: NO_STORE },
  );
}

/** Owner inbox: list this workspace's call requests (never token hashes). */
export async function GET(request: NextRequest) {
  const session = readAccountSession(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
  }
  if (!await isWorkspaceOwner({ session, workspaceId: session.workspaceId })) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
  }

  let cleanupErrors = 0;
  let cleanupSweepFailed = false;
  try {
    cleanupErrors = (await runCallRequestCleanup(new Date(), session.workspaceId)).errors;
  } catch {
    cleanupSweepFailed = true;
  }
  const provider = getCallRequestStorageProvider();
  const requests = await provider.listByWorkspace(session.workspaceId);

  // Enrich with safe summary fields: recipient profile name/role/company from
  // the share and classified topic labels only — never transcripts.
  const shareCache = new Map<string, Awaited<ReturnType<typeof getShareRecord>>>();
  const enriched = await Promise.all(requests.map(async (record) => {
    const r = record as {
      id: string; shareId: string; workspaceId: string; status: string;
      createdAt: string; expiresAt: string; acceptedAt?: string; liveSessionId?: string;
      roomName?: string; roomReady?: boolean; cleanupError?: boolean;
      connection?: import("@/lib/call-connection").CallConnectionMetrics;
      liveBrief?: import("@/lib/storage/types").CallRequestRecord["liveBrief"];
    };
    if (!shareCache.has(r.shareId)) shareCache.set(r.shareId, await getShareRecord(r.shareId));
    const share = shareCache.get(r.shareId);
    const sessionRecord = r.liveSessionId
      ? await getLiveSessionStorageProvider().get(r.liveSessionId)
      : null;
    return {
      id: r.id,
      shareId: r.shareId,
      status: r.status,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      liveSessionId: r.liveSessionId,
      roomName: r.roomName,
      roomReady: Boolean(r.roomReady),
      cleanupError: Boolean(r.cleanupError),
      connection: r.connection ?? null,
      timings: callRequestTimings(r),
      recipient: share?.profile?.name || share?.recipientName || null,
      recipientRole: share?.profile?.current_role || null,
      recipientCompany: share?.profile?.company || null,
      questionTopics: sessionRecord?.metrics?.questionTopics ?? [],
      liveBrief: r.liveBrief ?? null,
      handoffContext: share?.handoffId && share.workspaceId === session.workspaceId
        ? await getHandoffStorageProvider().get(share.handoffId).then((handoff) =>
          handoff
          && handoff.id === share.handoffId
          && handoff.shareId === share.id
          && handoff.workspaceId === session.workspaceId
            ? handoff.context
            : null)
        : null,
    };
  }));

  return NextResponse.json(
    {
      requests: enriched,
      summary: summarizeCallRequests(requests),
      summaryScope: "latest 50 requests in this workspace",
      cleanupErrors,
      cleanupSweepFailed,
    },
    { headers: NO_STORE },
  );
}
