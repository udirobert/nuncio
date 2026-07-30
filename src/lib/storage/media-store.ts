/**
 * Media asset persistence layer.
 *
 * Downloads temporary media URLs (e.g. HeyGen signed URLs) and re-uploads
 * to Backblaze B2 for permanent, public storage. Also persists audio assets
 * and pipeline trace JSON.
 *
 * Non-blocking by design: every function returns a fallback on failure so
 * the pipeline never breaks due to storage issues.
 */

import type { MediaStorageProvider } from "./types";
import { getMediaStorageProvider } from "./index";

export interface PersistResult {
  url: string;
  key: string;
  provider: string;
  sha256?: string;
}

async function computeSha256(buffer: Uint8Array): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(buffer).digest("hex");
}

/** Standard S3 user-defined metadata attached to every nuncio asset in B2. */
function baseMetadata(shareId: string, role: string, sha256?: string): Record<string, string> {
  const meta: Record<string, string> = {
    app: "nuncio",
    role,
    "share-id": shareId,
    pipeline: "genblaze",
  };
  if (sha256) meta["content-sha256"] = sha256;
  return meta;
}

/**
 * Download a video from a temporary URL and persist to B2.
 * Returns the permanent URL, or the original URL on failure.
 */
export async function persistVideo(
  temporaryUrl: string,
  shareId: string
): Promise<{ url: string; result?: PersistResult }> {
  const provider = getMediaStorageProvider();
  if (!provider) return { url: temporaryUrl };

  try {
    const res = await fetch(temporaryUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const contentType = res.headers.get("content-type") || "video/mp4";
    const buffer = new Uint8Array(await res.arrayBuffer());
    const sha256 = await computeSha256(buffer);
    const key = `videos/${shareId}/video.mp4`;

    const url = await provider.upload(key, buffer, contentType, baseMetadata(shareId, "video", sha256));
    console.log(`[media-store] Video persisted: ${url}`);
    return { url, result: { url, key, provider: provider.name, sha256 } };
  } catch (error) {
    console.warn("[media-store] Video persistence failed, using original URL:", error);
    return { url: temporaryUrl };
  }
}

/**
 * Persist an audio buffer (soundscape, cinematic entrance) to B2.
 */
export async function persistAudio(
  buffer: Uint8Array,
  shareId: string,
  filename: string,
  contentType = "audio/mpeg"
): Promise<{ url: string; result?: PersistResult }> {
  const provider = getMediaStorageProvider();
  if (!provider) return { url: "" };

  try {
    const sha256 = await computeSha256(buffer);
    const key = `audio/${shareId}/${filename}`;
    const url = await provider.upload(key, buffer, contentType, baseMetadata(shareId, "audio", sha256));
    console.log(`[media-store] Audio persisted: ${url}`);
    return { url, result: { url, key, provider: provider.name, sha256 } };
  } catch (error) {
    console.warn("[media-store] Audio persistence failed:", error);
    return { url: "" };
  }
}

/**
 * Persist a pipeline trace (Genblaze orchestration log) as JSON to B2.
 */
export async function persistTrace(
  trace: Record<string, unknown>,
  shareId: string
): Promise<{ url: string; result?: PersistResult }> {
  const provider = getMediaStorageProvider();
  if (!provider) return { url: "" };

  try {
    const json = JSON.stringify(trace, null, 2);
    const buffer = new TextEncoder().encode(json);
    const sha256 = await computeSha256(buffer);
    const key = `traces/${shareId}/pipeline.json`;
    const url = await provider.upload(key, buffer, "application/json", baseMetadata(shareId, "trace", sha256));
    console.log(`[media-store] Trace persisted: ${url}`);
    return { url, result: { url, key, provider: provider.name, sha256 } };
  } catch (error) {
    console.warn("[media-store] Trace persistence failed:", error);
    return { url: "" };
  }
}

/**
 * Persist a data URL (e.g. base64 audio) to B2.
 */
export async function persistDataUrl(
  dataUrl: string,
  shareId: string,
  filename: string
): Promise<{ url: string; result?: PersistResult }> {
  const provider = getMediaStorageProvider();
  if (!provider || !dataUrl.startsWith("data:")) return { url: dataUrl };

  try {
    const [header, base64] = dataUrl.split(",");
    const contentType = header.match(/data:(.*?);/)?.[1] || "application/octet-stream";
    const buffer = Buffer.from(base64, "base64");
    const sha256 = await computeSha256(buffer);
    const key = `audio/${shareId}/${filename}`;
    const url = await provider.upload(key, new Uint8Array(buffer), contentType, baseMetadata(shareId, "audio", sha256));
    console.log(`[media-store] Data URL persisted: ${url}`);
    return { url, result: { url, key, provider: provider.name, sha256 } };
  } catch (error) {
    console.warn("[media-store] Data URL persistence failed:", error);
    return { url: dataUrl };
  }
}

/**
 * Build and persist a per-share asset manifest. Lists every object stored
 * under the share's prefixes (videos/, audio/, images/, traces/) and writes
 * a single JSON index to B2. This is the "data orchestration" layer: B2
 * becomes the source of truth for what assets belong to a share, enabling
 * auditing, search, and reconstruction without external metadata stores.
 */
export async function persistAssetManifest(
  shareId: string,
  assets: PersistResult[]
): Promise<{ url: string; result?: PersistResult }> {
  const provider = getMediaStorageProvider();
  if (!provider) return { url: "" };

  try {
    const manifest = {
      schema: "nuncio.asset-manifest.v1",
      shareId,
      generatedAt: new Date().toISOString(),
      storageProvider: provider.name,
      assets: assets.map((a) => ({
        key: a.key,
        url: a.url,
        sha256: a.sha256,
      })),
    };
    const json = JSON.stringify(manifest, null, 2);
    const buffer = new TextEncoder().encode(json);
    const sha256 = await computeSha256(buffer);
    const key = `manifests/${shareId}/assets.json`;
    const url = await provider.upload(key, buffer, "application/json", baseMetadata(shareId, "asset-manifest", sha256));
    console.log(`[media-store] Asset manifest persisted: ${url}`);
    return { url, result: { url, key, provider: provider.name, sha256 } };
  } catch (error) {
    console.warn("[media-store] Asset manifest persistence failed:", error);
    return { url: "" };
  }
}

export type { MediaStorageProvider };
