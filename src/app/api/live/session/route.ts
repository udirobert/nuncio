import { NextRequest, NextResponse } from "next/server";
import { getShareRecord } from "@/lib/share-store";
import { getAccountStorageProvider } from "@/lib/storage";
import { getCreditBalance, reserveCredits, commitCreditReservation, refundCreditReservation } from "@/lib/billing/credits";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import type { Profile } from "@/lib/claude";
import type { WorkspaceAccount } from "@/lib/storage/types";

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
- ${languageHint}`;
}

export async function POST(request: NextRequest) {
  let reservationId: string | undefined;

  try {
    const body = (await request.json()) as { shareId?: string };
    const { shareId } = body;

    if (!shareId || typeof shareId !== "string") {
      return NextResponse.json({ error: "shareId is required" }, { status: 400 });
    }

    // Rate limit per IP to protect the metered Anam endpoint.
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

    const share = await getShareRecord(shareId);
    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    let workspace: WorkspaceAccount | null = null;
    if (share.workspaceId) {
      workspace = await getAccountStorageProvider().getWorkspace(share.workspaceId);
    }

    // Light credit guard: live sessions are metered by Anam, so we require the
    // workspace to have a non-negative balance before we create a session token.
    if (share.workspaceId) {
      const balance = await getCreditBalance({
        workspaceId: share.workspaceId,
        anonymous: false,
      });
      if (balance <= 0) {
        return NextResponse.json(
          { error: "Live sessions are unavailable while this account has no credits" },
          { status: 402 }
        );
      }

      const reservation = await reserveCredits({
        subject: { workspaceId: share.workspaceId, anonymous: false },
        action: "live.session",
        reason: "Anam live avatar session token",
      });
      reservationId = reservation.id;
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
      if (reservationId) {
        await refundCreditReservation(reservationId, "anam_token_failure");
      }
      return NextResponse.json(
        { error: "Failed to create live avatar session" },
        { status: 502 }
      );
    }

    const anamData = (await anamRes.json()) as AnamSessionResponse;
    const sessionToken = anamData.sessionToken || anamData.token;

    if (!sessionToken) {
      if (reservationId) {
        await refundCreditReservation(reservationId, "missing_anam_token");
      }
      return NextResponse.json(
        { error: "Anam did not return a session token" },
        { status: 502 }
      );
    }

    if (reservationId) {
      await commitCreditReservation(reservationId);
    }

    return NextResponse.json({ sessionToken });
  } catch (error) {
    console.error("[api/live/session] error:", error);
    if (reservationId) {
      await refundCreditReservation(reservationId, "live_session_exception");
    }
    return NextResponse.json(
      { error: "Failed to start live session" },
      { status: 500 }
    );
  }
}
