import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { createAnamVoice, getAnamVoice } from "@/lib/anam";
import { getAccountStorageProvider } from "@/lib/storage";

/**
 * POST /api/anam/voice
 * Create a cloned Anam voice from an audio file (data URL) or public audio URL.
 * If the caller has an account session, the resulting voiceId is persisted to the workspace.
 */
export async function POST(request: NextRequest) {
  try {
    const { audioUrl, name, language } = (await request.json()) as {
      audioUrl?: string;
      name?: string;
      language?: string;
    };

    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
    }

    const result = await createAnamVoice({ audioUrl, name: name || "My Voice", language });

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
    console.error("[anam/voice] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Voice creation failed" },
      { status: 500 }
    );
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
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
