import type {
  CreativeProvider,
  CreativeSession,
  GeneratedAsset,
} from "./types";

/**
 * Local creative provider — works without any external creative service.
 * Generates assets via direct API calls (future: Replicate, DALL-E, Stability)
 * and stores metadata in memory for the session.
 *
 * This is the zero-dependency fallback. No vendor lock-in.
 */
export class LocalProvider implements CreativeProvider {
  readonly name = "local";

  async createSession(_targetName: string): Promise<CreativeSession> {
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
    // TODO: Wire to a direct image generation API (Replicate, DALL-E, etc.)
    // For now, return empty — HeyGen can render without a custom background
    const asset: GeneratedAsset = {
      type: "background",
      url: "",
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
    // TODO: Wire to a direct image generation API
    const asset: GeneratedAsset = {
      type: "thumbnail",
      url: "",
      prompt,
      provider: this.name,
    };

    session.assets.push(asset);
    return asset;
  }

  async storeText(
    _session: CreativeSession,
    _label: string,
    _content: string
  ): Promise<void> {
    // No-op for local provider — text is already in the pipeline state
  }

  async finalise(session: CreativeSession): Promise<CreativeSession> {
    return session;
  }

  async export(_session: CreativeSession): Promise<string | null> {
    // No export capability without an external service
    return null;
  }
}
