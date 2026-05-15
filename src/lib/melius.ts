import { getCreativeProvider } from "@/lib/creative";
import type { CreativeSession } from "@/lib/creative";
import type { CanvasProof } from "@/lib/artifacts";

export interface CanvasResult extends CanvasProof {
  canvasId: string;
  assetUrls: string[];
  canvasUrl?: string;
  exportUrl?: string;
  provider: string;
  assetCount: number;
}

/**
 * Create a creative session with assets for the video.
 * Uses whichever creative provider is configured (Melius or local).
 *
 * This is the public API the canvas route calls.
 * It doesn't know or care whether Melius is behind it.
 */
export async function createCanvas(
  profile: { name: string; [key: string]: unknown },
  script: string
): Promise<CanvasResult> {
  const provider = getCreativeProvider();

  // 1. Create session
  const session: CreativeSession = await provider.createSession(profile.name);

  // 2. Store the script and profile as text nodes
  await provider.storeText(session, "Script", script);
  await provider.storeText(
    session,
    "Profile Summary",
    JSON.stringify(profile, null, 2)
  );

  // 3. Generate background image
  const backgroundPrompt = buildBackgroundPrompt(profile);
  await provider.generateBackground(session, backgroundPrompt);

  // 4. Generate thumbnail
  const thumbnailPrompt = `Professional video thumbnail for a personalised outreach video to ${profile.name}. Clean, minimal, modern.`;
  await provider.generateThumbnail(session, thumbnailPrompt);

  // 5. Finalise (wait for any pending generations)
  const finalised = await provider.finalise(session);

  // 6. Export (optional — may return null for local provider)
  const exportUrl = await provider.export(finalised);

  // Collect asset URLs (filter out empty strings from local provider)
  const assetUrls = finalised.assets
    .map((a) => a.url)
    .filter((url) => url !== "");

  return {
    canvasId: finalised.id,
    assetUrls,
    assetCount: assetUrls.length,
    canvasUrl: finalised.canvasUrl,
    exportUrl: exportUrl || undefined,
    provider: provider.name,
  };
}

/**
 * Build a contextual background image prompt based on the target's profile.
 */
function buildBackgroundPrompt(profile: {
  name: string;
  [key: string]: unknown;
}): string {
  const company = (profile.company as string) || "";
  const interests = (profile.interests as string[]) || [];

  const context = [
    company && `related to ${company}`,
    interests.length > 0 && `themes: ${interests.slice(0, 2).join(", ")}`,
  ]
    .filter(Boolean)
    .join(". ");

  return `Abstract, professional background for a personalised video. Subtle, modern, clean. ${context}. No text, no faces. 16:9 aspect ratio.`;
}
