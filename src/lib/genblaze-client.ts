/**
 * Client for the Genblaze media orchestration worker.
 *
 * The worker (workers/genblaze/) wraps the Genblaze Python SDK to generate
 * audio and image assets with automatic B2 storage and provenance manifests.
 * Called when GENBLAZE_WORKER_URL is configured; falls back gracefully.
 */

const WORKER_URL = process.env.GENBLAZE_WORKER_URL;

export interface GenblazeAsset {
  url: string;
  sha256?: string;
  content_type: string;
  manifest_uri?: string;
  manifest_hash?: string;
}

export interface GenblazeResult {
  asset: GenblazeAsset;
  provider: string;
  pipeline: string;
  elapsed_ms: number;
}

export function isGenblazeWorkerConfigured(): boolean {
  return Boolean(WORKER_URL);
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Genblaze worker error (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Generate TTS audio via Genblaze worker (ElevenLabs through Genblaze pipeline).
 * Returns B2-hosted URL with provenance manifest.
 */
export async function genblazeTts(
  text: string,
  shareId: string,
  voiceId?: string
): Promise<GenblazeResult | null> {
  if (!WORKER_URL) return null;
  try {
    return (await post("/generate", {
      type: "tts",
      prompt: text,
      share_id: shareId,
      voice_id: voiceId,
    })) as GenblazeResult;
  } catch (error) {
    console.warn("[genblaze] TTS generation failed:", error);
    return null;
  }
}

/**
 * Generate soundscape audio via Genblaze worker.
 */
export async function genblazeSoundscape(
  prompt: string,
  shareId: string,
  duration?: number
): Promise<GenblazeResult | null> {
  if (!WORKER_URL) return null;
  try {
    return (await post("/generate", {
      type: "soundscape",
      prompt,
      share_id: shareId,
      duration,
    })) as GenblazeResult;
  } catch (error) {
    console.warn("[genblaze] Soundscape generation failed:", error);
    return null;
  }
}

/**
 * Generate a thumbnail image via Genblaze worker (GMI Cloud).
 */
export async function genblazeThumbnail(
  prompt: string,
  shareId: string
): Promise<GenblazeResult | null> {
  if (!WORKER_URL) return null;
  try {
    return (await post("/generate", {
      type: "thumbnail",
      prompt,
      share_id: shareId,
    })) as GenblazeResult;
  } catch (error) {
    console.warn("[genblaze] Thumbnail generation failed:", error);
    return null;
  }
}

export interface GenblazeCompositeAsset {
  url: string;
  sha256?: string;
  content_type: string;
  modality?: string;
  provider?: string;
  model?: string;
}

export interface GenblazeCompositeResult {
  assets: GenblazeCompositeAsset[];
  manifest_uri?: string;
  manifest_hash?: string;
  steps: number;
  pipeline: string;
  elapsed_ms: number;
}

/**
 * Multi-step composite generation: thumbnail (GMI Cloud) + soundscape (ElevenLabs)
 * + TTS narration (ElevenLabs) in a single Genblaze Pipeline run.
 * One manifest, one B2 sink, three assets across two providers.
 */
export async function genblazeComposite(
  scriptHook: string,
  shareId: string,
  opts?: {
    soundscapePrompt?: string;
    voiceId?: string;
    thumbnailModel?: string;
    duration?: number;
  }
): Promise<GenblazeCompositeResult | null> {
  if (!WORKER_URL) return null;
  try {
    return (await post("/generate/composite", {
      type: "composite",
      prompt: scriptHook,
      share_id: shareId,
      soundscape_prompt: opts?.soundscapePrompt,
      voice_id: opts?.voiceId,
      model: opts?.thumbnailModel,
      duration: opts?.duration,
    })) as GenblazeCompositeResult;
  } catch (error) {
    console.warn("[genblaze] Composite generation failed:", error);
    return null;
  }
}
