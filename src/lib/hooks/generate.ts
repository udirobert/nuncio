import { recordHookSpend, type UserTier } from "./tiers";

const FAL_KEY = process.env.FAL_KEY;
const FAL_BASE_URL = "https://queue.fal.run";

export interface HookGenerationResult {
  status: "complete" | "demo" | "failed";
  outputUrl?: string;
  requestId?: string;
  error?: string;
}

export async function generateHookVideo(input: {
  prompt: string;
  modelEndpoint: string;
  tier: UserTier;
  generationAllowed: boolean;
}): Promise<HookGenerationResult> {
  if (!input.generationAllowed) {
    return { status: "demo", error: "Hook generation is not allowed for this session." };
  }

  if (!FAL_KEY || !input.modelEndpoint) {
    return { status: "demo", error: "fal hook generation is not configured." };
  }

  try {
    const submit = await fetch(`${FAL_BASE_URL}/${input.modelEndpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        duration: "3",
        aspect_ratio: "16:9",
      }),
    });

    if (!submit.ok) {
      const text = await submit.text();
      return { status: "failed", error: `fal submit failed (${submit.status}): ${text.slice(0, 180)}` };
    }

    const submitted = await submit.json();
    const requestId = submitted.request_id || submitted.requestId;
    const immediateUrl = findVideoUrl(submitted);
    if (immediateUrl) {
      recordHookSpend(input.tier);
      return { status: "complete", outputUrl: immediateUrl, requestId };
    }

    if (!requestId) {
      return { status: "failed", error: "fal did not return a request id or video URL." };
    }

    for (let attempt = 0; attempt < 24; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = await fetch(`${FAL_BASE_URL}/${input.modelEndpoint}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });

      if (!status.ok) continue;
      const statusData = await status.json();
      if (statusData.status === "FAILED") {
        return { status: "failed", requestId, error: statusData.error || "fal hook generation failed." };
      }
      if (statusData.status === "COMPLETED") break;
    }

    const result = await fetch(`${FAL_BASE_URL}/${input.modelEndpoint}/requests/${requestId}`, {
      headers: { Authorization: `Key ${FAL_KEY}` },
    });

    if (!result.ok) {
      return { status: "failed", requestId, error: `fal result fetch failed (${result.status}).` };
    }

    const data = await result.json();
    const outputUrl = findVideoUrl(data);
    if (!outputUrl) {
      return { status: "failed", requestId, error: "fal result did not include a video URL." };
    }

    recordHookSpend(input.tier);
    return { status: "complete", outputUrl, requestId };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "fal hook generation failed.",
    };
  }
}

function findVideoUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;

  const directVideo = record.video;
  if (directVideo && typeof directVideo === "object" && "url" in directVideo) {
    const url = (directVideo as { url?: unknown }).url;
    if (typeof url === "string") return url;
  }

  const dataRecord = record.data;
  if (dataRecord && typeof dataRecord === "object") {
    const url = findVideoUrl(dataRecord);
    if (url) return url;
  }

  const videos = record.videos;
  if (Array.isArray(videos)) {
    const first = videos[0];
    if (first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string") {
      return (first as { url: string }).url;
    }
  }

  if (typeof record.url === "string") return record.url;
  return undefined;
}
