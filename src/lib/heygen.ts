import { fetchWithRetry } from "@/lib/retry";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
const HEYGEN_VOICE_ID = process.env.HEYGEN_VOICE_ID;
const HEYGEN_BASE_URL = "https://api.heygen.com";

export interface VideoResult {
  videoId: string;
}

export interface VideoStatus {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
}

/**
 * Create a video using HeyGen's Video Agent API.
 * The Video Agent handles scene composition, avatar selection, and rendering
 * from a structured prompt — the recommended approach for agentic workflows.
 *
 * Falls back to /v3/videos direct API if Video Agent is unavailable.
 */
export async function createVideo(
  script: string,
  assetUrls?: string[],
  recipientName?: string
): Promise<VideoResult> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

  // Try Video Agent API first (preferred for hackathon judging)
  try {
    return await createVideoViaAgent(script, recipientName);
  } catch (error) {
    console.warn("[heygen] Video Agent failed, falling back to direct API:", error);
    return await createVideoDirect(script, assetUrls);
  }
}

/**
 * Video Agent API — high-level prompt-based video generation.
 * Follows HeyGen Skills prompt optimization guidelines:
 * - Structured scene breakdown (Hook → Content → CTA)
 * - Visual direction per scene
 * - Duration targets
 */
async function createVideoViaAgent(
  script: string,
  recipientName?: string
): Promise<VideoResult> {
  // Build a structured Video Agent prompt following HeyGen Skills best practices
  const agentPrompt = buildVideoAgentPrompt(script, recipientName);

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v1/video_agent/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HEYGEN_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: agentPrompt,
      config: {
        duration_sec: Math.min(Math.ceil(script.split(/\s+/).length / 2.5), 90),
        orientation: "landscape",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video Agent API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  return { videoId: data.data?.video_id || data.video_id };
}

/**
 * Direct /v3/videos API — manual scene composition.
 * Used as fallback if Video Agent is unavailable.
 */
async function createVideoDirect(
  script: string,
  assetUrls?: string[]
): Promise<VideoResult> {
  if (!HEYGEN_AVATAR_ID || !HEYGEN_VOICE_ID) {
    throw new Error("HEYGEN_AVATAR_ID and HEYGEN_VOICE_ID must be configured");
  }

  const payload: Record<string, unknown> = {
    type: "avatar",
    avatar_id: HEYGEN_AVATAR_ID,
    script,
    voice_id: HEYGEN_VOICE_ID,
    resolution: "1080p",
    aspect_ratio: "16:9",
    expressiveness: "high",
  };

  // If Melius provided a background asset, use it
  if (assetUrls && assetUrls.length > 0) {
    payload.background = {
      type: "asset",
      asset_id: assetUrls[0],
    };
  }

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HEYGEN_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HeyGen API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  return { videoId: data.data.video_id };
}

/**
 * Build a structured Video Agent prompt following HeyGen Skills guidelines.
 * Scene structure: Intro → Main delivery → CTA
 */
function buildVideoAgentPrompt(script: string, recipientName?: string): string {
  const wordCount = script.split(/\s+/).length;
  const estimatedDuration = Math.ceil(wordCount / 2.5);

  return `Create a personalised outreach video with the following structure:

SCENE 1 — INTRO (3 seconds):
- Scene type: A-roll (avatar speaking)
- Visual: Clean, professional background. Warm lighting.
- The avatar looks directly at camera and begins speaking naturally.
${recipientName ? `- The video is addressed to ${recipientName}.` : ""}

SCENE 2 — MAIN MESSAGE (${estimatedDuration - 6} seconds):
- Scene type: A-roll (avatar speaking)
- Visual: Same professional setting, slight camera movement for dynamism.
- Voiceover script (deliver exactly as written):

"${script}"

SCENE 3 — CLOSE (3 seconds):
- Scene type: A-roll
- Visual: Avatar smiles naturally, slight nod.
- The avatar finishes speaking and the video ends cleanly.

GLOBAL STYLE:
- Tone: Warm, conversational, genuine — not corporate or salesy
- Avatar: Professional appearance, direct eye contact
- Background: Clean, minimal, slightly warm-toned
- Resolution: 1080p, 16:9 landscape
- Expressiveness: High — natural gestures and facial expressions
${HEYGEN_AVATAR_ID ? `- Avatar ID: ${HEYGEN_AVATAR_ID}` : ""}
${HEYGEN_VOICE_ID ? `- Voice ID: ${HEYGEN_VOICE_ID}` : ""}`;
}

/**
 * Poll HeyGen for video generation status.
 * Works with both Video Agent and direct API videos.
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

  // Try the video status endpoint (works for both APIs)
  const response = await fetchWithRetry(
    `${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${videoId}`,
    {
      headers: {
        Authorization: `Bearer ${HEYGEN_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    // Fallback to v3 endpoint
    const v3Response = await fetchWithRetry(
      `${HEYGEN_BASE_URL}/v3/videos/${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${HEYGEN_API_KEY}`,
        },
      }
    );

    if (!v3Response.ok) {
      throw new Error(`HeyGen API error: ${v3Response.status}`);
    }

    const v3Data = await v3Response.json();
    return {
      status: v3Data.data.status,
      videoUrl: v3Data.data.video_url || undefined,
    };
  }

  const data = await response.json();
  return {
    status: data.data?.status || "pending",
    videoUrl: data.data?.video_url || undefined,
  };
}

/**
 * Translate a video to another language using HeyGen Video Translate + Lipsync.
 */
export async function translateVideo(
  videoId: string,
  targetLanguage: string
): Promise<{ translationId: string }> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v1/video_translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HEYGEN_API_KEY}`,
    },
    body: JSON.stringify({
      video_id: videoId,
      target_language: targetLanguage,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Translation failed: ${error}`);
  }

  const data = await response.json();
  return {
    translationId: data.data?.video_translate_id || data.data?.id,
  };
}
