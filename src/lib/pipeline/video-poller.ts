/**
 * Server-side video polling with activity callbacks.
 *
 * Replaces the client-side polling loop in `handleRenderVideo`.
 * The pipeline route uses this to watch a HeyGen render job and
 * emit progress events to the collaborative panel.
 */

import { getVideoStatus } from "@/lib/heygen";
import { getVideoStatusFromCache } from "@/lib/video-status-cache";

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 60;

export interface PollOptions {
  onProgress?: (attempt: number, max: number) => void;
}

export interface PollResult {
  videoUrl: string;
  videoId: string;
}

export async function pollVideoUntilReady(
  videoId: string,
  options: PollOptions = {},
): Promise<PollResult> {
  const { onProgress } = options;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Check webhook cache first
    const cached = getVideoStatusFromCache(videoId);
    if (cached) {
      if (cached.status === "completed" && cached.videoUrl) {
        return { videoUrl: cached.videoUrl, videoId };
      }
      if (cached.status === "failed") {
        throw new Error(cached.failureMessage || "Video generation failed");
      }
    }

    const status = await getVideoStatus(videoId);

    if (status.status === "completed" && status.videoUrl) {
      return { videoUrl: status.videoUrl, videoId };
    }
    if (status.status === "failed") {
      throw new Error(status.failureMessage || "Video generation failed");
    }

    onProgress?.(attempt + 1, MAX_ATTEMPTS);

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Video render timed out — it may still be running.");
}
