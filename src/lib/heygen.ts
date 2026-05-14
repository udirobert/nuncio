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
 * Create a video using HeyGen's Video Agent with Avatar V.
 */
export async function createVideo(
  script: string,
  assetUrls?: string[]
): Promise<VideoResult> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

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
 * Poll HeyGen for video generation status.
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  if (!HEYGEN_API_KEY) {
    throw new Error("HEYGEN_API_KEY is not configured");
  }

  const response = await fetchWithRetry(`${HEYGEN_BASE_URL}/v3/videos/${videoId}`, {
    headers: {
      Authorization: `Bearer ${HEYGEN_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HeyGen API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    status: data.data.status,
    videoUrl: data.data.video_url || undefined,
  };
}
