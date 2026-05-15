import type {
  CreativeProvider,
  CreativeSession,
  GeneratedAsset,
} from "./types";

/**
 * Local creative provider — works without any external creative service.
 * Records creative prompts and stores metadata in memory for the session.
 *
 * This is the zero-dependency fallback. No vendor lock-in.
 */
export class LocalProvider implements CreativeProvider {
  readonly name = "local";

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
    // Local fallback records the prompt but does not generate media assets.
    // HeyGen can still render without a custom background.
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
    // Local fallback records the prompt but does not generate media assets.
    const asset: GeneratedAsset = {
      type: "thumbnail",
      url: "",
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
