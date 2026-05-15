import type {
  CreativeProvider,
  CreativeSession,
  GeneratedAsset,
} from "./types";

const FAL_KEY = process.env.FAL_KEY;
const FAL_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell";
const FAL_BASE_URL = "https://queue.fal.run";

/**
 * Local creative provider — works without Melius.
 * If FAL_KEY is set, generates lightweight images via fal.ai; otherwise it
 * records creative prompts and lets HeyGen render without custom assets.
 *
 * This is the zero-dependency fallback. No vendor lock-in.
 */
export class LocalProvider implements CreativeProvider {
  readonly name = FAL_KEY ? "fal" : "local";

  async createSession(): Promise<CreativeSession> {
    return {
      id: `local-${Date.now()}`,
      provider: this.name,
      assets: [],
    };
  }

  async generateBackground(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset> {
    const url = await generateFalImage(prompt, "landscape_16_9");
    const asset: GeneratedAsset = {
      type: "background",
      url: url || "",
      prompt,
      provider: this.name,
    };

    session.assets.push(asset);
    return asset;
  }

  async generateThumbnail(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset> {
    const url = await generateFalImage(prompt, "landscape_16_9");
    const asset: GeneratedAsset = {
      type: "thumbnail",
      url: url || "",
      prompt,
      provider: this.name,
    };

    session.assets.push(asset);
    return asset;
  }

  async storeText(): Promise<void> {
    // No-op for local provider — text is already in the pipeline state
  }

  async finalise(session: CreativeSession): Promise<CreativeSession> {
    return session;
  }

  async export(): Promise<string | null> {
    // No export capability without an external service
    return null;
  }
}

async function generateFalImage(
  prompt: string,
  imageSize: "landscape_16_9" | "square_hd"
): Promise<string | null> {
  if (!FAL_KEY) return null;

  try {
    const submit = await fetch(`${FAL_BASE_URL}/${FAL_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
        output_format: "jpeg",
      }),
    });

    if (!submit.ok) {
      console.warn(`[fal] submit failed: ${submit.status}`);
      return null;
    }

    const submitted = await submit.json();
    const requestId = submitted.request_id || submitted.requestId;
    if (!requestId) {
      return submitted.images?.[0]?.url || null;
    }

    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = await fetch(`${FAL_BASE_URL}/${FAL_MODEL}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });

      if (!status.ok) continue;
      const statusData = await status.json();
      if (statusData.status === "COMPLETED") break;
      if (statusData.status === "FAILED") return null;
    }

    const result = await fetch(`${FAL_BASE_URL}/${FAL_MODEL}/requests/${requestId}`, {
      headers: { Authorization: `Key ${FAL_KEY}` },
    });

    if (!result.ok) return null;
    const data = await result.json();
    return data.images?.[0]?.url || data.data?.images?.[0]?.url || null;
  } catch (error) {
    console.warn("[fal] image generation failed:", error);
    return null;
  }
}
