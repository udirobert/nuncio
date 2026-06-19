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
  default_voice_id?: string;
  tags?: string[];
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
    return await createVideoViaAgent(script, recipientName, customization);
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
  recipientName?: string,
  customization?: VideoCustomization
): Promise<VideoResult> {
  // Build a structured Video Agent prompt following HeyGen Skills best practices
  const agentPrompt = buildVideoAgentPrompt(script, recipientName, customization);

  const body: Record<string, unknown> = {
    prompt: agentPrompt,
    mode: "generate",
    incognito_mode: true,
  };

  // Pass avatar_id and voice_id directly — the Video Agent API accepts these
  const avatarId = customization?.avatarId || HEYGEN_AVATAR_ID;
  if (avatarId) body.avatar_id = avatarId;

  const voiceId = customization?.voiceId || HEYGEN_VOICE_ID;
  if (voiceId) body.voice_id = voiceId;

  // Enable captions if requested (v3 API supports caption as top-level field)
  if (customization?.captions) {
    body.caption = { file_format: "srt", style: "default" };
  }

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/video-agents`, {
    method: "POST",
    headers: heygenHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
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

export interface AvatarFilter {
  avatar_type?: "studio_avatar" | "digital_twin" | "photo_avatar";
  ownership?: "public" | "private";
  gender?: string;
  limit?: number;
}

/**
 * Fetch available avatar looks from HeyGen v3 API.
 * Returns looks (outfits/styles) with preview images/videos and tags.
 */
export async function getAvatars(filter?: AvatarFilter): Promise<HeyGenAvatar[]> {
  const params = new URLSearchParams();
  if (filter?.avatar_type) params.set("avatar_type", filter.avatar_type);
  if (filter?.ownership) params.set("ownership", filter.ownership);
  if (filter?.gender) params.set("gender", filter.gender);
  params.set("limit", String(filter?.limit || 30));

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/avatars/looks?${params}`, {
    headers: heygenHeaders(),
  });
  if (!response.ok) {
    // Fallback to v2 if v3 fails
    const v2Response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v2/avatars`, {
      headers: heygenHeaders(),
    });
    if (!v2Response.ok) throw new Error("Failed to fetch avatars");
    const v2Data = await v2Response.json();
    return v2Data.data?.avatars || v2Data.data || [];
  }
  const data = await response.json();
  const looks = data.data || [];
  // Normalise v3 look fields to our interface
  return looks.map((look: Record<string, unknown>) => ({
    avatar_id: look.id || look.avatar_id,
    avatar_name: (look.name as string) || "Avatar",
    gender: (look.gender as string) || "unknown",
    preview_image_url: (look.preview_image_url as string) || "",
    preview_video_url: (look.preview_video_url as string) || undefined,
    default_voice_id: (look.default_voice_id as string) || undefined,
    tags: (look.tags as string[]) || [],
  }));
}

export interface VoiceFilter {
  language?: string;
  gender?: string;
  type?: "public" | "private";
  engine?: string;
  limit?: number;
}

/**
 * Fetch available voices from HeyGen v3 API.
 * Supports filtering by language, gender, engine.
 */
export async function getVoices(filter?: VoiceFilter): Promise<HeyGenVoice[]> {
  const params = new URLSearchParams();
  if (filter?.language) params.set("language", filter.language);
  if (filter?.gender) params.set("gender", filter.gender);
  if (filter?.type) params.set("type", filter.type);
  if (filter?.engine) params.set("engine", filter.engine);
  params.set("limit", String(filter?.limit || 20));

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/voices?${params}`, {
    headers: heygenHeaders(),
  });
  if (!response.ok) {
    // Fallback to v2 if v3 fails
    const v2Response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v2/voices`, {
      headers: heygenHeaders(),
    });
    if (!v2Response.ok) throw new Error("Failed to fetch voices");
    const v2Data = await v2Response.json();
    return v2Data.data?.voices || v2Data.data || [];
  }
  const data = await response.json();
  const voices = data.data || [];
  return voices.map((v: Record<string, unknown>) => ({
    voice_id: v.voice_id || v.id,
    name: (v.name as string) || "Voice",
    gender: (v.gender as string) || "unknown",
    language: (v.language as string) || undefined,
    preview_audio: (v.preview_audio_url as string) || (v.preview_audio as string) || undefined,
  }));
}

export interface VideoCustomization {
  avatarId?: string;
  voiceId?: string;
  soundscapeVibe?: string;
  background?: { type: "color"; value: string } | { type: "image"; url: string };
  width?: number;
  height?: number;
  captions?: boolean;
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

  // Add callback URL for webhook-based completion if PUBLIC_URL is set
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (publicUrl) {
    const base = publicUrl.startsWith("http") ? publicUrl : `https://${publicUrl}`;
    payload.callback_url = `${base}/api/webhook/heygen`;
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
${customization?.width && customization?.height ? `- Resolution: ${customization.width}x${customization.height}` : ""}
${customization?.captions ? `- Enable burned-in captions/subtitles (style: "default") so the script text appears on screen as the avatar speaks.` : ""}`;
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

// ─── Phase 3: Personal Identity ──────────────────────────────────────────────

export interface PhotoAvatarResult {
  avatarId: string;
  groupId: string;
  status: "processing" | "completed" | "failed";
  previewImageUrl?: string;
}

/**
 * Create a Photo Avatar from a single headshot image.
 * Returns immediately with a processing status — poll via getAvatarStatus().
 */
export async function createPhotoAvatar(
  imageUrl: string,
  name?: string
): Promise<PhotoAvatarResult> {
  if (!HEYGEN_API_KEY) throw new Error("HEYGEN_API_KEY is not configured");

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/avatars`, {
    method: "POST",
    headers: heygenHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      type: "photo",
      image_url: imageUrl,
      name: name || "My Avatar",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Photo Avatar creation failed: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const item = data.data || data;
  return {
    avatarId: item.avatar_item_id || item.look_id || item.id,
    groupId: item.avatar_group_id || item.group_id || "",
    status: item.status === "completed" ? "completed" : "processing",
    previewImageUrl: item.preview_image_url || imageUrl,
  };
}

/**
 * Get avatar training/processing status.
 */
export async function getAvatarStatus(avatarId: string): Promise<{ status: "processing" | "completed" | "failed"; previewImageUrl?: string }> {
  if (!HEYGEN_API_KEY) throw new Error("HEYGEN_API_KEY is not configured");

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/avatars/looks/${avatarId}`, {
    headers: heygenHeaders(),
  });

  if (!response.ok) {
    return { status: "processing" };
  }

  const data = await response.json();
  const look = data.data || data;
  const status = look.status === "completed" ? "completed" : look.status === "failed" ? "failed" : "processing";
  return { status, previewImageUrl: look.preview_image_url || undefined };
}

export interface VoiceCloneResult {
  voiceId: string;
  status: "processing" | "complete" | "failed";
  name?: string;
}

/**
 * Clone a voice from an audio file URL.
 * Returns immediately — poll via getVoiceCloneStatus().
 */
export async function cloneVoice(
  audioUrl: string,
  name?: string
): Promise<VoiceCloneResult> {
  if (!HEYGEN_API_KEY) throw new Error("HEYGEN_API_KEY is not configured");

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/voices/clone`, {
    method: "POST",
    headers: heygenHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      audio_url: audioUrl,
      name: name || "My Voice",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voice clone failed: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const item = data.data || data;
  return {
    voiceId: item.voice_clone_id || item.voice_id || item.id,
    status: item.status === "complete" ? "complete" : "processing",
    name: name || "My Voice",
  };
}

/**
 * Get voice clone processing status.
 */
export async function getVoiceCloneStatus(voiceId: string): Promise<{ status: "processing" | "complete" | "failed" }> {
  if (!HEYGEN_API_KEY) throw new Error("HEYGEN_API_KEY is not configured");

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/voices/${voiceId}`, {
    headers: heygenHeaders(),
  });

  if (!response.ok) {
    return { status: "processing" };
  }

  const data = await response.json();
  const voice = data.data || data;
  return { status: voice.status === "complete" ? "complete" : voice.status === "failed" ? "failed" : "processing" };
}
