import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { createAnamVoice, getAnamVoice } from "@/lib/anam";
import { getAccountStorageProvider } from "@/lib/storage";
import { reserveCredits, commitCreditReservation, refundCreditReservation, InsufficientCreditsError, getCreditSubject } from "@/lib/billing/credits";
import { getAnamVoiceTrainingCreditCost } from "@/lib/live-link";

function anamErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Live twin training failed";
  const lower = message.toLowerCase();

  if (lower.includes("anam_api_key") || lower.includes("not configured")) {
    return NextResponse.json({ error: "Live twin training isn't configured on this deployment." }, { status: 503 });
  }
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json({ error: err.message }, { status: 402 });
  }
  if (lower.includes("403") || lower.includes("plan") || lower.includes("enterprise")) {
    return NextResponse.json(
      { error: "Your Anam plan doesn't support voice cloning. Upgrade your Anam account or use the recorded video option." },
      { status: 403 }
    );
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * POST /api/anam/voice
 * Create a cloned Anam voice from an audio file (data URL) or public audio URL.
 * If the caller has an account session, the resulting voiceId is persisted to the workspace.
 */
export async function POST(request: NextRequest) {
  let reservationId: string | undefined;
  try {
    const { audioUrl, name, language } = (await request.json()) as {
      audioUrl?: string;
      name?: string;
      language?: string;
    };

    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
    }

    if (!process.env.ANAM_API_KEY) {
      return NextResponse.json({ error: "Live twin training isn't configured on this deployment." }, { status: 503 });
    }

    const subject = getCreditSubject(request);
    const cost = getAnamVoiceTrainingCreditCost();
    const reservation = await reserveCredits({
      subject,
      action: "live.voice",
      amount: cost,
      reason: "Anam voice training",
      provider: "anam",
    });
    reservationId = reservation.id;

    const result = await createAnamVoice({ audioUrl, name: name || "My Voice", language });

    await commitCreditReservation(reservation.id);

    const session = readAccountSession(request);
    if (session?.workspaceId) {
      try {
        await getAccountStorageProvider().updateWorkspace(session.workspaceId, { anamVoiceId: result.voiceId });
      } catch (err) {
        console.error("[anam/voice] Failed to persist voice to workspace:", err);
      }
    }

    return NextResponse.json({ voiceId: result.voiceId, sampleUrl: result.sampleUrl });
  } catch (err) {
    if (reservationId) await refundCreditReservation(reservationId, "voice_creation_failed");
    console.error("[anam/voice] Error:", err);
    return anamErrorResponse(err);
  }
}

/**
 * GET /api/anam/voice?id=xxx
 * Poll the status of an Anam voice.
 */
export async function GET(request: NextRequest) {
  const voiceId = request.nextUrl.searchParams.get("id");
  if (!voiceId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const status = await getAnamVoice(voiceId);
    return NextResponse.json({
      ...status,
      status: status.sampleUrl ? "completed" : "processing",
    });
  } catch (err) {
    console.error("[anam/voice] Status error:", err);
    return NextResponse.json(
      {
        status: "failed",
        error: err instanceof Error ? err.message : "Status check failed",
      },
      { status: 200 }
    );
  }
}
