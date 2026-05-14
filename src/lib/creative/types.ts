/**
 * Creative provider abstraction layer.
 * Decouples asset generation and storage from any single vendor.
 */

export interface GeneratedAsset {
  type: "background" | "thumbnail" | "overlay";
  url: string;
  prompt: string;
  provider: string;
}

export interface CreativeSession {
  id: string;
  provider: string;
  assets: GeneratedAsset[];
  canvasUrl?: string;
  exportUrl?: string;
}

export interface CreativeProvider {
  readonly name: string;

  /**
   * Create a new creative session for a target person.
   */
  createSession(targetName: string): Promise<CreativeSession>;

  /**
   * Generate a background image for the video.
   */
  generateBackground(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset>;

  /**
   * Generate a thumbnail image.
   */
  generateThumbnail(
    session: CreativeSession,
    prompt: string
  ): Promise<GeneratedAsset>;

  /**
   * Store text content (script, profile summary) in the session.
   */
  storeText(
    session: CreativeSession,
    label: string,
    content: string
  ): Promise<void>;

  /**
   * Finalise the session — trigger any pending generations and wait.
   * Returns updated session with all asset URLs populated.
   */
  finalise(session: CreativeSession): Promise<CreativeSession>;

  /**
   * Export all assets as a downloadable bundle.
   * Returns a URL to the export (ZIP, folder, etc).
   */
  export(session: CreativeSession): Promise<string | null>;
}
