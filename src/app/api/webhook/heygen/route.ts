import { NextRequest, NextResponse } from "next/server";
import { setVideoStatus } from "@/lib/video-status-cache";

/**
 * HeyGen webhook callback endpoint.
 * Called when a video render completes or fails.
 * Stores status in an in-memory cache for fast retrieval by the polling endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // HeyGen webhook payload: { event_type, event_data: { video_id, url, status, ... } }
    const eventType = body.event_type || body.type;
    const eventData = body.event_data || body.data || body;
    const videoId = eventData.video_id || eventData.videoId;

    if (!videoId) {
      console.warn("[webhook/heygen] No video_id in payload:", JSON.stringify(body).slice(0, 500));
      return NextResponse.json({ received: true });
    }

    console.info("[webhook/heygen] Received:", { eventType, videoId, status: eventData.status });

    if (eventData.status === "completed" || eventType === "video.completed") {
      const videoUrl = eventData.url || eventData.video_url || eventData.download_url;
      setVideoStatus(videoId, "completed", videoUrl);
    } else if (eventData.status === "failed" || eventType === "video.failed") {
      setVideoStatus(videoId, "failed", undefined, eventData.error || eventData.message || "Video generation failed");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook/heygen] Error processing webhook:", error);
    return NextResponse.json({ received: true });
  }
}
