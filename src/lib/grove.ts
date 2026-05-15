/**
 * Grove storage integration.
 * Provides permanent, publicly-accessible storage for rendered videos.
 *
 * Why Grove:
 * - HeyGen video URLs are signed and expire after a period
 * - Grove gives us permanent URLs we control
 * - Free, public, immutable storage (chain_id=37111 for Lens testnet)
 * - No API key required for uploads
 *
 * Flow:
 * 1. HeyGen renders video → returns temporary signed URL
 * 2. We download the video from HeyGen
 * 3. Upload to Grove → get permanent gateway URL
 * 4. Store the Grove URL in our share records
 * 5. Serve the Grove URL to recipients (never expires)
 */

const GROVE_API_URL = process.env.GROVE_API_URL || "https://api.grove.storage";
const GROVE_CHAIN_ID = process.env.GROVE_CHAIN_ID || "37111";

export interface GroveUploadResult {
  storageKey: string;
  gatewayUrl: string;
  uri: string;
}

/**
 * Upload a video file to Grove for permanent storage.
 * Uses the one-step upload (no storage key pre-allocation needed).
 */
export async function uploadVideoToGrove(
  videoBuffer: ArrayBuffer | Uint8Array,
  contentType: string = "video/mp4"
): Promise<GroveUploadResult> {
  const body = videoBuffer instanceof Uint8Array ? videoBuffer : new Uint8Array(videoBuffer);

  const response = await fetch(
    `${GROVE_API_URL}/?chain_id=${GROVE_CHAIN_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: body as unknown as BodyInit,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grove upload failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    storageKey: data.storage_key,
    gatewayUrl: data.gateway_url,
    uri: data.uri,
  };
}

/**
 * Upload JSON metadata to Grove (e.g., share record, video metadata).
 */
export async function uploadJsonToGrove(
  data: Record<string, unknown>
): Promise<GroveUploadResult> {
  const json = JSON.stringify(data);
  const response = await fetch(
    `${GROVE_API_URL}/?chain_id=${GROVE_CHAIN_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: json,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grove JSON upload failed (${response.status}): ${text}`);
  }

  const result = await response.json();
  return {
    storageKey: result.storage_key,
    gatewayUrl: result.gateway_url,
    uri: result.uri,
  };
}

/**
 * Download a video from a temporary URL (e.g., HeyGen signed URL)
 * and re-upload to Grove for permanent storage.
 *
 * Returns the permanent Grove gateway URL.
 */
export async function persistVideoToGrove(
  temporaryVideoUrl: string
): Promise<GroveUploadResult> {
  // Download from temporary URL
  const downloadResponse = await fetch(temporaryVideoUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download video: ${downloadResponse.status}`);
  }

  const contentType = downloadResponse.headers.get("content-type") || "video/mp4";
  const buffer = await downloadResponse.arrayBuffer();

  // Upload to Grove
  const result = await uploadVideoToGrove(buffer, contentType);

  console.log(`[grove] Video persisted: ${result.gatewayUrl}`);
  return result;
}

/**
 * Check if Grove is enabled/configured.
 */
export function isGroveEnabled(): boolean {
  return process.env.GROVE_ENABLED !== "false";
}
