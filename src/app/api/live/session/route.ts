import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getShareRecord } from "@/lib/share-store";
import { getAccountStorageProvider, getLiveSessionStorageProvider } from "@/lib/storage";
import { creditsEnforced, getCreditBalance, reserveCredits, refundCreditReservation, getCreditSubject } from "@/lib/billing/credits";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import type { LiveSessionRecord, WorkspaceAccount } from "@/lib/storage/types";
import { isLiveLinkAllowed, LIVE_SESSION_MAX_CREDITS, LIVE_SESSION_MAX_DURATION_MS } from "@/lib/live-link";
import { authorizeHandoffShare, getActiveHandoffForShare, validateHandoffBookingUrl } from "@/lib/live-handoff";
import { createLiveSessionRecord, hashLiveSessionToken, reconcileLiveSession } from "@/lib/live-session";
import { buildLiveSystemPrompt, sanitizeLivePromptContext } from "@/lib/live-prompt";
import {
  resolvePrimaryProvider,
  resolveStartAttempts,
  type LiveAvatarAdapter,
  type ProviderStartHandle,
} from "@/lib/live-avatar-providers";
import { browserMutationAllowed } from "@/lib/call-request";

export async function POST(request: NextRequest) {
  let sessionRecord: Awaited<ReturnType<typeof createLiveSessionRecord>> | undefined;
  let reservationId: string | undefined;

  try {
    const body = (await request.json()) as { shareId?: string };
    const { shareId } = body;

    if (!shareId || typeof shareId !== "string") {
      return NextResponse.json({ error: "shareId is required" }, { status: 400 });
    }

    if (process.env.NUNCIO_LIVELINK_ENABLED !== "true") {
      return NextResponse.json({ error: "LiveLink is not enabled" }, { status: 404 });
    }

    const share = await getShareRecord(shareId);
    if (!share || share.deliveryMode !== "livelink") {
      return NextResponse.json({ error: "Live link not found" }, { status: 404 });
    }

    if (!isLiveLinkAllowed({ workspaceId: share.workspaceId, senderEmail: share.senderEmail })) {
      return NextResponse.json({ error: "LiveLink is not enabled for this pilot" }, { status: 404 });
    }

    if (!await authorizeHandoffShare(request, share)) {
      return NextResponse.json({ error: "Live link not found" }, { status: 404 });
    }
    if (share.handoffId && !browserMutationAllowed(request, true)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const handoff = share.handoffId ? (await getActiveHandoffForShare(share)).record : null;
    if (share.handoffId && !handoff) {
      return NextResponse.json({ error: "Live link not found" }, { status: 404 });
    }

    let workspace: WorkspaceAccount | null = null;
    if (share.workspaceId) {
      workspace = await getAccountStorageProvider().getWorkspace(share.workspaceId);
    }

    const clientId = getClientId(request);
    const rateLimit = await checkRateLimit(clientId, "live.session", RATE_LIMITS.live);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many live session attempts. Please try again shortly.",
          retryAfter: rateLimit.resetIn,
        },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetIn) } }
      );
    }

    const primary = resolvePrimaryProvider();
    if (!primary) {
      return NextResponse.json(
        { error: "Live avatar is not configured for this sender" },
        { status: 503 }
      );
    }
    const attempts = resolveStartAttempts(primary, { workspace, share });

    if (attempts.length === 0) {
      return NextResponse.json(
        { error: "Live avatar is not configured for this sender" },
        { status: 503 }
      );
    }

    const creditSubject = share.workspaceId
      ? { workspaceId: share.workspaceId, anonymous: false as const }
      : getCreditSubject(request);

    if (creditsEnforced()) {
      const balance = await getCreditBalance(creditSubject);
      if (balance < LIVE_SESSION_MAX_CREDITS) {
        return NextResponse.json(
          { error: "Live sessions are unavailable while this account has insufficient credits" },
          { status: 402 }
        );
      }
    }

    const reservation = await reserveCredits({
      subject: creditSubject,
      action: "live.session",
      amount: LIVE_SESSION_MAX_CREDITS,
      reason: "Live avatar session maximum reservation",
      provider: attempts[0].adapter.id,
    });
    reservationId = reservation.id;

    const syncToken = randomBytes(32).toString("base64url");
    sessionRecord = await createLiveSessionRecord({
      shareId,
      workspaceId: share.workspaceId,
      reservationId,
      provider: attempts[0].adapter.id,
      syncTokenHash: hashLiveSessionToken(syncToken),
      reservedCredits: reservationId ? LIVE_SESSION_MAX_CREDITS : 0,
      creditsEnforced: creditsEnforced(),
    });

    if (!sessionRecord) {
      if (reservationId) {
        await refundCreditReservation(reservationId, "live_session_already_open");
      }
      return NextResponse.json(
        { error: "A live session is already open for this link" },
        { status: 409 },
      );
    }

    const governed = await sanitizeLivePromptContext({
      workspaceId: share.workspaceId,
      workspace,
      context: handoff?.context,
    });
    const systemPrompt = buildLiveSystemPrompt(
      {
        recipientName: share.recipientName,
        senderName: share.senderName,
        profile: share.profile,
        language: share.language,
      },
      governed.workspace,
      governed.context,
      { schedulingAvailable: Boolean(validateHandoffBookingUrl(share.bookingUrl)) },
    );

    const record = sessionRecord;

    for (const { adapter, ids } of attempts) {
      const started = await tryAdapterStart(adapter, ids, record, systemPrompt);
      if ("response" in started && started.ok) {
        return NextResponse.json({
          ...started.response,
          sessionId: record.id,
          syncToken,
        });
      }
      if (started.fatal) {
        return NextResponse.json(
          { error: "Live session could not be started safely. Please try again." },
          { status: 500 }
        );
      }
    }

    await reconcileLiveSession({ record, durationMs: 0, reason: "start_failed" }).catch(() => {});
    return NextResponse.json({ error: "Failed to start live session" }, { status: 500 });
  } catch (error) {
    console.error("[api/live/session] error: stage=session session=%s name=%s", sessionRecord?.id ?? "none", (error as Error)?.name ?? "unknown");
    if (sessionRecord) {
      await reconcileLiveSession({ record: sessionRecord, durationMs: 0, reason: "start_failed" }).catch(() => {});
    } else if (reservationId) {
      await refundCreditReservation(reservationId, "live_session_record_failure").catch(() => {});
    }
    return NextResponse.json({ error: "Failed to start live session" }, { status: 500 });
  }
}

type StartOutcome =
  | { ok: true; response: Record<string, unknown> }
  | { ok: false; fatal: boolean };

async function tryAdapterStart(
  adapter: LiveAvatarAdapter,
  ids: { avatarId: string; voiceId: string },
  record: LiveSessionRecord,
  systemPrompt: string,
): Promise<StartOutcome> {
  const provisionalRoom = adapter.transport === "livekit"
    ? `nuncio-live-${record.id}`
    : undefined;
  let started: ProviderStartHandle | null = null;
  try {
    const currentRecord: LiveSessionRecord = {
      ...record,
      provider: adapter.id,
      transport: adapter.transport,
      reuseHumanRoom: adapter.capabilities.reuseHumanRoom,
      roomName: provisionalRoom,
      roomClosedAt: undefined,
    };
    await getLiveSessionStorageProvider().update(currentRecord);
    started = await adapter.start({
      sessionId: record.id,
      systemPrompt,
      recipientIdentity: `guest-${record.id}`,
      recipientTtlSeconds: Math.ceil(LIVE_SESSION_MAX_DURATION_MS / 1000),
      avatarId: ids.avatarId,
      voiceId: ids.voiceId,
    });
    const finalRecord: LiveSessionRecord = {
      ...currentRecord,
      roomName: adapter.transport === "livekit" ? started.roomName : undefined,
      roomClosedAt: undefined,
    };
    if (
      finalRecord.provider !== record.provider
      || finalRecord.transport !== record.transport
      || finalRecord.roomName !== record.roomName
    ) {
      await getLiveSessionStorageProvider().update(finalRecord);
    }
    return { ok: true, response: started.response };
  } catch (error) {
    console.warn("[api/live/session] %s start failed: stage=avatar session=%s name=%s", adapter.id, record?.id ?? "none", (error as Error)?.name ?? "unknown");
    const partial = {
      roomName: started?.roomName ?? provisionalRoom ?? `nuncio-live-${record.id}`,
      dispatchId: started?.dispatchId,
    };
    const cleaned = await adapter.cleanup(started, partial).catch(() => false);
    if (adapter.transport === "livekit") {
      if (!cleaned) {
        await reconcileLiveSession({
          record: {
            ...record,
            provider: adapter.id,
            transport: adapter.transport,
            reuseHumanRoom: adapter.capabilities.reuseHumanRoom,
            roomName: partial.roomName,
            cleanupError: true,
          },
          durationMs: LIVE_SESSION_MAX_DURATION_MS,
          reason: "provider_closed",
        }).catch(() => {});
        return { ok: false, fatal: true };
      }
      return { ok: false, fatal: false };
    }
    if (!cleaned) {
      await reconcileLiveSession({
        record: { ...record, provider: adapter.id, transport: adapter.transport, cleanupError: true },
        durationMs: 0,
        reason: "start_failed",
      }).catch(() => {});
      return { ok: false, fatal: true };
    }
    await reconcileLiveSession({
      record: { ...record, provider: adapter.id, transport: adapter.transport },
      durationMs: 0,
      reason: "start_failed",
    }).catch(() => {});
    return { ok: false, fatal: true };
  }
}
