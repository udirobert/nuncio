import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getShareRecord } from "@/lib/share-store";
import { getAccountStorageProvider, getLiveSessionStorageProvider } from "@/lib/storage";
import { creditsEnforced, getCreditBalance, reserveCredits, refundCreditReservation, getCreditSubject } from "@/lib/billing/credits";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import type { LiveSessionRecord, WorkspaceAccount } from "@/lib/storage/types";
import { isLiveLinkAllowed, LIVE_SESSION_MAX_CREDITS, LIVE_SESSION_MAX_DURATION_MS } from "@/lib/live-link";
import { createLiveSessionRecord, hashLiveSessionToken, reconcileLiveSession } from "@/lib/live-session";
import { createAnamSessionToken } from "@/lib/anam";
import { buildLiveSystemPrompt } from "@/lib/live-prompt";
import { createSynthesiaSession, cleanupSynthesiaSession, isLiveKitConfigured } from "@/lib/livekit";
import { SYNTHESIA_AGENT_NAME } from "@/lib/call-request";

type LiveProvider = "synthesia" | "anam";

function resolvePrimaryProvider(): LiveProvider {
  return process.env.NUNCIO_LIVE_PRIMARY_PROVIDER === "anam" ? "anam" : "synthesia";
}

function synthesiaReady(workspace: WorkspaceAccount | null): { avatarId: string; voiceId: string } | null {
  if (!isLiveKitConfigured()) return null;
  if (process.env.NUNCIO_SYNTHESIA_WORKER_ENABLED !== "true") return null;
  const avatarId = workspace?.synthesiaAvatarId || process.env.SYNTHESIA_AVATAR_ID;
  const voiceId = workspace?.liveVoiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!avatarId || !voiceId) return null;
  return { avatarId, voiceId };
}

function anamReady(input: { workspace: WorkspaceAccount | null; share: { anamAvatarId?: string; anamVoiceId?: string } }): { avatarId: string; voiceId: string } | null {
  const avatarId = input.workspace?.anamAvatarId || input.share.anamAvatarId || process.env.ANAM_AVATAR_ID;
  const voiceId = input.workspace?.anamVoiceId || input.share.anamVoiceId || process.env.ANAM_VOICE_ID;
  if (!avatarId || !voiceId) return null;
  return { avatarId, voiceId };
}

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
    const synthesia = synthesiaReady(workspace);
    const anam = anamReady({ workspace, share });

    if (!synthesia && !anam) {
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
      provider: primary === "synthesia" && synthesia ? "synthesia" : "anam",
    });
    reservationId = reservation.id;

    const syncToken = randomBytes(32).toString("base64url");
    sessionRecord = await createLiveSessionRecord({
      shareId,
      workspaceId: share.workspaceId,
      reservationId,
      provider: primary === "synthesia" && synthesia ? "synthesia" : "anam",
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

    const systemPrompt = buildLiveSystemPrompt(
      {
        recipientName: share.recipientName,
        senderName: share.senderName,
        profile: share.profile,
        language: share.language,
      },
      workspace
    );

    const attempts: LiveProvider[] =
      primary === "synthesia" && synthesia
        ? (anam ? ["synthesia", "anam"] : ["synthesia"])
        : ["anam"];

    const record = sessionRecord;

    for (const provider of attempts) {
      if (provider === "synthesia") {
        const ids = synthesia!;
        let roomName = `nuncio-live-${record.id}`;
        let dispatchId: string | undefined;
        try {
          await getLiveSessionStorageProvider().update({ ...record, provider: "synthesia", roomName });
          const started = await createSynthesiaSession({
            sessionId: record.id,
            avatarId: ids.avatarId,
            voiceId: ids.voiceId,
            recipientIdentity: `guest-${record.id}`,
            recipientTtlSeconds: Math.ceil(LIVE_SESSION_MAX_DURATION_MS / 1000),
          });
          roomName = started.roomName;
          dispatchId = started.dispatchId;
          return NextResponse.json({
            provider: "synthesia",
            serverUrl: started.serverUrl,
            participantToken: started.participantToken,
            roomName,
            sessionId: record.id,
            syncToken,
            agentName: SYNTHESIA_AGENT_NAME,
          });
        } catch (error) {
          console.warn("[api/live/session] synthesia start failed:", (error as Error)?.name ?? "unknown");
          const cleaned = await cleanupSynthesiaSession({ roomName, dispatchId }).catch(() => false);
          if (!cleaned) {
            await reconcileLiveSession({
              record: { ...record, provider: "synthesia", roomName, cleanupError: true },
              durationMs: LIVE_SESSION_MAX_DURATION_MS,
              reason: "provider_closed",
            }).catch(() => {});
            return NextResponse.json(
              { error: "Live session could not be started safely. Please try again." },
              { status: 500 }
            );
          }
          continue;
        }
      }

      try {
        const ids = anam!;
        const { sessionToken } = await createAnamSessionToken({
          avatarId: ids.avatarId,
          voiceId: ids.voiceId,
          systemPrompt,
          avatarModel: "cara-4",
        });
        if (record.provider !== "anam") {
          const updated: LiveSessionRecord = {
            ...record,
            provider: "anam",
            roomName: undefined,
            roomClosedAt: new Date().toISOString(),
          };
          await getLiveSessionStorageProvider().update(updated);
        }
        return NextResponse.json({ provider: "anam", sessionToken, sessionId: record.id, syncToken });
      } catch (error) {
        console.warn("[api/live/session] anam start failed:", (error as Error)?.name ?? "unknown");
        await reconcileLiveSession({ record, durationMs: 0, reason: "start_failed" }).catch(() => {});
        return NextResponse.json({ error: "Failed to start live session" }, { status: 500 });
      }
    }

    await reconcileLiveSession({ record, durationMs: 0, reason: "start_failed" }).catch(() => {});
    return NextResponse.json({ error: "Failed to start live session" }, { status: 500 });
  } catch (error) {
    console.error("[api/live/session] error:", error);
    if (sessionRecord) {
      await reconcileLiveSession({ record: sessionRecord, durationMs: 0, reason: "start_failed" }).catch(() => {});
    } else if (reservationId) {
      await refundCreditReservation(reservationId, "live_session_record_failure").catch(() => {});
    }
    return NextResponse.json({ error: "Failed to start live session" }, { status: 500 });
  }
}
