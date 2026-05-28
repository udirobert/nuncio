import { fetchWithRetry } from "@/lib/retry";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
const HEYGEN_VOICE_ID = process.env.HEYGEN_VOICE_ID;
const HEYGEN_BASE_URL = "https://api.heygen.com";

function heygenHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "x-api-key": HEYGEN_API_KEY || "",
    Authorization: `Bearer ${HEYGEN_API_KEY}`,
    ...extra,
  };
}

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url?: string;
}

export interface HeyGenVoice {
  voice_id: string;
  name: string;
  gender: string;
  language?: string;
  preview_audio?: string;
}

export interface VideoResult {
  videoId: string;
  sessionId?: string;
}

export interface VideoStatus {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  videoId?: string;
  sessionId?: string;
  failureMessage?: string;
}

/**
 * Create a video using HeyGen's Video Agent API (Avatar V engine).
 * The Video Agent handles scene composition, avatar selection, and rendering
 * from a structured prompt — the recommended approach for agentic workflows.
 *
 * Falls back to /v2/video/generate direct API if Video Agent is unavailable.
 * Both paths use the Avatar V engine.
 */
export async function createVideo(
  script: string,
  assetUrls?: string[],
  recipientName?: string,
  customization?: VideoCustomization
): Promise<VideoResult> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

  // Try Video Agent API first (preferred for hackathon judging)
  try {
    return await createVideoViaAgent(script, recipientName);
  } catch (error) {
    console.warn("[heygen] Video Agent failed, falling back to direct API:", error);
    return await createVideoDirect(script, assetUrls, customization);
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

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/video-agents`, {
    method: "POST",
    headers: heygenHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      prompt: agentPrompt,
      mode: "generate",
      incognito_mode: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video Agent API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const sessionId = data.data?.session_id || data.session_id;
  const videoId = data.data?.video_id || data.video_id || sessionId;
  return { videoId, sessionId };
}

/**
 * Fetch available avatars from HeyGen.
 */
export async function getAvatars(): Promise<HeyGenAvatar[]> {
  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v2/avatars`, {
    headers: heygenHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch avatars");
  const data = await response.json();
  return data.data?.avatars || data.data || [];
}

/**
 * Fetch available voices from HeyGen.
 */
export async function getVoices(): Promise<HeyGenVoice[]> {
  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v2/voices`, {
    headers: heygenHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch voices");
  const data = await response.json();
  return data.data?.voices || data.data || [];
}

export interface VideoCustomization {
  avatarId?: string;
  voiceId?: string;
  soundscapeVibe?: string;
  background?: { type: "color"; value: string } | { type: "image"; url: string };
  width?: number;
  height?: number;
}

/**
 * Direct /v2/video/generate API — Avatar V scene composition.
 * Used as fallback if Video Agent is unavailable.
 */
async function createVideoDirect(
  script: string,
  assetUrls?: string[],
  customization?: VideoCustomization
): Promise<VideoResult> {
  const avatarId = customization?.avatarId || HEYGEN_AVATAR_ID;
  const voiceId = customization?.voiceId || HEYGEN_VOICE_ID;
  const width = customization?.width || 1920;
  const height = customization?.height || 1080;

  if (!avatarId || !voiceId) {
    throw new Error("HEYGEN_AVATAR_ID and HEYGEN_VOICE_ID must be configured");
  }

  const payload: Record<string, unknown> = {
    video_inputs: [
      {
        character: {
          type: "avatar",
          avatar_id: avatarId,
        },
        voice: {
          type: "text",
          input_text: script,
          voice_id: voiceId,
        },
      },
    ],
    dimension: {
      width,
      height,
    },
  };

  // Apply background from customization or from Melius assets
  const bgUrl = customization?.background?.type === "image"
    ? customization.background.url
    : assetUrls?.[0];

  if (customization?.background?.type === "color") {
    (payload.video_inputs as Record<string, unknown>[])[0] = {
      ...((payload.video_inputs as Record<string, unknown>[])[0]),
      background: {
        type: "color",
        value: customization.background.value,
      },
    };
  } else if (bgUrl) {
    // Covers: user's explicit image background, or Melius assetUrls[0] as fallback
    payload.video_inputs = [
      {
        ...((payload.video_inputs as Record<string, unknown>[])[0]),
        background: {
          type: "image",
          url: bgUrl,
        },
      },
    ];
  }

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v2/video/generate`, {
    method: "POST",
    headers: heygenHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HeyGen API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  return { videoId: data.data?.video_id || data.video_id };
}

/**
 * Build a structured Video Agent prompt following HeyGen Skills guidelines.
 * Scene structure: Intro → Main delivery → CTA
 */
function buildVideoAgentPrompt(script: string, recipientName?: string, customization?: VideoCustomization): string {
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
- Avatar V engine — natural gestures and facial expressions
${customization?.avatarId || HEYGEN_AVATAR_ID ? `- Avatar ID: ${customization?.avatarId || HEYGEN_AVATAR_ID}` : ""}
${customization?.voiceId || HEYGEN_VOICE_ID ? `- Voice ID: ${customization?.voiceId || HEYGEN_VOICE_ID}` : ""}
${customization?.width && customization?.height ? `- Resolution: ${customization.width}x${customization.height}` : ""}`;
}

/**
 * Poll HeyGen for video generation status.
 * Works with both Video Agent and direct API videos.
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

  const videoStatus = await getDirectVideoStatus(videoId);
  if (videoStatus) {
    console.info("[heygen] direct video status", {
      requestedId: videoId,
      status: videoStatus.status,
      hasVideoUrl: Boolean(videoStatus.videoUrl),
      failureMessage: videoStatus.failureMessage,
    });
    return videoStatus;
  }

  const sessionStatus = await getVideoAgentSessionStatus(videoId);
  if (sessionStatus) {
    console.info("[heygen] video agent session status", {
      requestedId: videoId,
      sessionId: sessionStatus.sessionId,
      videoId: sessionStatus.videoId,
      status: sessionStatus.status,
      failureMessage: sessionStatus.failureMessage,
    });
    if (sessionStatus.videoId && sessionStatus.videoId !== videoId) {
      const resolvedVideo = await getDirectVideoStatus(sessionStatus.videoId);
      if (resolvedVideo) {
        console.info("[heygen] resolved agent video status", {
          requestedId: videoId,
          resolvedVideoId: sessionStatus.videoId,
          status: resolvedVideo.status,
          hasVideoUrl: Boolean(resolvedVideo.videoUrl),
          failureMessage: resolvedVideo.failureMessage,
        });
        return { ...resolvedVideo, sessionId: videoId, videoId: sessionStatus.videoId };
      }
    }
    return sessionStatus;
  }

  throw new Error(`HeyGen API error: could not find video or session ${videoId}`);
}

async function getDirectVideoStatus(videoId: string): Promise<VideoStatus | null> {
  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${videoId}`, {
    headers: heygenHeaders(),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const payload = data.data || data;
  console.info("[heygen] raw direct status", {
    videoId,
    rawStatus: payload.status,
    hasVideoUrl: Boolean(payload.video_url || payload.videoUrl),
  });
  return {
    status: normaliseStatus(payload.status),
    videoUrl: payload.video_url || payload.videoUrl || undefined,
    videoId,
    failureMessage: payload.failure_message || payload.failureMessage || undefined,
  };
}

async function getVideoAgentSessionStatus(sessionId: string): Promise<VideoStatus | null> {
  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/video-agents/${sessionId}`, {
    headers: heygenHeaders(),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const payload = data.data || data;
  console.info("[heygen] raw agent session status", {
    sessionId,
    rawStatus: payload.status,
    videoId: payload.video_id || payload.videoId || undefined,
  });
  return {
    status: normaliseStatus(payload.status),
    videoId: payload.video_id || payload.videoId || undefined,
    sessionId,
    failureMessage: payload.failure_message || payload.failureMessage || undefined,
  };
}

function normaliseStatus(status: unknown): VideoStatus["status"] {
  if (status === "completed" || status === "done" || status === "success") {
    return "completed";
  }
  if (status === "failed" || status === "error") {
    return "failed";
  }
  if (
    status === "processing" ||
    status === "in_progress" ||
    status === "running" ||
    status === "queued" ||
    status === "generating" ||
    status === "rendering"
  ) {
    return "processing";
  }
  return "pending";
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
    headers: heygenHeaders({
      "Content-Type": "application/json",
    }),
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
