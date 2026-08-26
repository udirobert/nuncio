import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getShareRecord } from "@/lib/share-store";
import { getAccountStorageProvider } from "@/lib/storage";
import { creditsEnforced, getCreditBalance, reserveCredits, refundCreditReservation } from "@/lib/billing/credits";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import type { Profile } from "@/lib/claude";
import type { WorkspaceAccount } from "@/lib/storage/types";
import { isLiveLinkAllowed, LIVE_SESSION_MAX_CREDITS } from "@/lib/live-link";
import { createLiveSessionRecord, hashLiveSessionToken, reconcileLiveSession } from "@/lib/live-session";

interface AnamPersonaConfig {
  avatarId: string;
  voiceId: string;
  systemPrompt: string;
}

interface AnamSessionResponse {
  sessionToken?: string;
  token?: string;
}

function buildSystemPrompt(share: {
  recipientName?: string;
  senderName?: string;
  profile?: Profile;
  language?: string;
}, workspace?: WorkspaceAccount | null): string {
  const profile = share.profile;
  const recipient = share.recipientName || profile?.name || "there";
  const sender = share.senderName || "your contact";
  const role = profile?.current_role ? `, ${profile.current_role}` : "";
  const company = profile?.company ? ` at ${profile.company}` : "";
  const language = share.language || "en";
  const languageHint = language !== "en"
    ? `Respond in the recipient's primary language (${language}).`
    : "Respond in English.";

  const hooks = profile?.personalization_hooks?.length
    ? profile.personalization_hooks.map((h) => `- ${h}`).join("\n")
    : "- No specific hooks available.";

  const wants = workspace?.playbookWants || "start a conversation";
  const offer = workspace?.playbookOffer || "help where it makes sense";
  const wiggle = workspace?.playbookWiggleRoom || "tone and timing";
  const constraints = workspace?.playbookConstraints?.trim()
    ? workspace.playbookConstraints.split("\n").filter(Boolean).join("\n")
    : "- Be honest, concise, and respectful.\n- Do not promise pricing or terms the sender cannot commit to.\n- Do not disparage competitors.";

  const bookingGuidance = workspace?.bookingUrl
    ? `\n- A booking link is shown on this page. If the recipient wants time with ${sender}, invite them to use it: "Use the booking button below to grab time with ${sender}." Never invent specific times or promise meetings on ${sender}'s behalf beyond pointing to that link.`
    : "";

  return `You are a live AI representative for ${sender}. You are speaking one-on-one with ${recipient}${role}${company}.

Your goal is to represent ${sender} naturally, answer the recipient's questions, and move the conversation toward a clear next step. You should feel like a helpful colleague, not a sales script.

Context about ${recipient}:
${hooks}

Sender's playbook:
- What ${sender} wants: ${wants}
- What ${sender} can offer: ${offer}
- Where ${sender} has wiggle room: ${wiggle}
- Hard constraints (never violate):
${constraints}

Instructions for the conversation:
- Keep responses short (1-2 sentences) so the conversation feels natural.
- If you don't know something, offer to follow up rather than guessing.
- Always stay within the playbook constraints above.
- End by offering a clear next step (e.g., book a short call, answer follow-up questions, or share more information).
- Address the recipient by name when it feels natural.
- ${languageHint}${bookingGuidance}`;
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

    // Every live session must be attributable to a workspace so the maximum
    // reservation cannot be bypassed through legacy or manually-created
    // sender-only share records.
    if (!share.workspaceId) {
      return NextResponse.json({ error: "Live link is not available for this share" }, { status: 404 });
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

    const anamApiKey = process.env.ANAM_API_KEY;
    const avatarId = process.env.ANAM_AVATAR_ID;
    const voiceId = process.env.ANAM_VOICE_ID;
    if (!anamApiKey || !avatarId || !voiceId) {
      return NextResponse.json(
        { error: "Live avatar is not configured on this server" },
        { status: 503 }
      );
    }

    let workspace: WorkspaceAccount | null = null;
    if (share.workspaceId) {
      workspace = await getAccountStorageProvider().getWorkspace(share.workspaceId);
    }

    if (share.workspaceId) {
      if (creditsEnforced()) {
        const balance = await getCreditBalance({ workspaceId: share.workspaceId, anonymous: false });
        if (balance < LIVE_SESSION_MAX_CREDITS) {
          return NextResponse.json(
            { error: "Live sessions are unavailable while this account has insufficient credits" },
            { status: 402 }
          );
        }
      }

      const reservation = await reserveCredits({
        subject: { workspaceId: share.workspaceId, anonymous: false },
        action: "live.session",
        amount: LIVE_SESSION_MAX_CREDITS,
        reason: "Anam live avatar session maximum reservation",
        provider: "anam",
      });
      reservationId = reservation.id;
    }

    const syncToken = randomBytes(32).toString("base64url");
    sessionRecord = await createLiveSessionRecord({
      shareId,
      workspaceId: share.workspaceId,
      reservationId,
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

    const personaConfig: AnamPersonaConfig = {
      avatarId,
      voiceId,
      systemPrompt: buildSystemPrompt(
        {
          recipientName: share.recipientName,
          senderName: share.senderName,
          profile: share.profile,
          language: share.language,
        },
        workspace
      ),
    };

    const anamRes = await fetch("https://api.anam.ai/v1/auth/session-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anamApiKey}`,
      },
      body: JSON.stringify({ personaConfig }),
      signal: AbortSignal.timeout(10000),
    });

    if (!anamRes.ok) {
      const text = await anamRes.text();
      console.error("[anam] session token error:", anamRes.status, text);
      await reconcileLiveSession({ record: sessionRecord, durationMs: 0, reason: "start_failed" });
      return NextResponse.json({ error: "Failed to create live avatar session" }, { status: 502 });
    }

    const anamData = (await anamRes.json()) as AnamSessionResponse;
    const sessionToken = anamData.sessionToken || anamData.token;
    if (!sessionToken) {
      await reconcileLiveSession({ record: sessionRecord, durationMs: 0, reason: "start_failed" });
      return NextResponse.json({ error: "Anam did not return a session token" }, { status: 502 });
    }

    return NextResponse.json({ sessionToken, sessionId: sessionRecord.id, syncToken });
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
