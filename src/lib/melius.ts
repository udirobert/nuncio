import { getCreativeProvider } from "@/lib/creative";
import type { CreativeSession } from "@/lib/creative";

export interface CanvasResult {
  canvasId: string;
  assetUrls: string[];
  canvasUrl?: string;
  exportUrl?: string;
  provider: string;
  assetCount: number;
  textNodesCreated: number;
}

/**
 * Create a creative session with assets for the video.
 * Uses whichever creative provider is configured (Melius or local).
 *
 * Strategy: TEXT-FIRST CANVAS
 * 1. Create all text nodes immediately (profile, script, visual direction, objective)
 * 2. Attempt image generation (background, thumbnail) — non-blocking on failure
 * 3. Finalise with audit comment
 *
 * This ensures the Melius canvas is always a meaningful deliverable,
 * even if image generation is slow or fails.
 */
export async function createCanvas(
  profile: { name: string; [key: string]: unknown },
  script: string,
  senderBrief?: string
): Promise<CanvasResult> {
  const provider = getCreativeProvider();

  // 1. Create session
  const session: CreativeSession = await provider.createSession(profile.name);
  let textNodesCreated = 0;

  // 2. TEXT-FIRST: Create all text nodes (these are fast and always succeed)
  try {
    await provider.storeText(session, "Profile Summary", formatProfileSummary(profile));
    textNodesCreated++;
  } catch (e) {
    console.warn("[melius] Failed to store profile summary:", e);
  }

  try {
    await provider.storeText(session, "Script", script);
    textNodesCreated++;
  } catch (e) {
    console.warn("[melius] Failed to store script:", e);
  }

  try {
    await provider.storeText(
      session,
      "Outreach Objective",
      senderBrief || `Personalised video outreach to ${profile.name}`
    );
    textNodesCreated++;
  } catch (e) {
    console.warn("[melius] Failed to store objective:", e);
  }

  try {
    const visualDirection = buildVisualDirection(profile);
    await provider.storeText(session, "Visual Direction", visualDirection);
    textNodesCreated++;
  } catch (e) {
    console.warn("[melius] Failed to store visual direction:", e);
  }

  // 3. MEDIA: Attempt image generation (non-blocking on failure)
  const backgroundPrompt = buildBackgroundPrompt(profile);
  try {
    await provider.generateBackground(session, backgroundPrompt);
  } catch (e) {
    console.warn("[melius] Background generation failed (non-blocking):", e);
  }

  try {
    const thumbnailPrompt = buildThumbnailPrompt(profile);
    await provider.generateThumbnail(session, thumbnailPrompt);
  } catch (e) {
    console.warn("[melius] Thumbnail generation failed (non-blocking):", e);
  }

  // 4. Finalise with audit comment
  const finalised = await provider.finalise(session);

  // 5. Export (optional)
  const exportUrl = await provider.export(finalised);

  // Collect asset URLs (filter out empty strings)
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
    textNodesCreated,
  };
}

/**
 * Format the profile as a readable summary for the canvas node.
 */
function formatProfileSummary(profile: { name: string; [key: string]: unknown }): string {
  const lines = [`# ${profile.name}`];

  if (profile.current_role) lines.push(`**Role:** ${profile.current_role}`);
  if (profile.company) lines.push(`**Company:** ${profile.company}`);

  const work = profile.notable_work as string[] | undefined;
  if (work?.length) {
    lines.push("", "**Notable work:**");
    work.forEach((w) => lines.push(`- ${w}`));
  }

  const interests = profile.interests as string[] | undefined;
  if (interests?.length) {
    lines.push("", "**Interests:** " + interests.join(", "));
  }

  const hooks = profile.personalization_hooks as string[] | undefined;
  if (hooks?.length) {
    lines.push("", "**Personalisation hooks:**");
    hooks.forEach((h) => lines.push(`- ${h}`));
  }

  return lines.join("\n");
}

/**
 * Build visual direction text for the canvas.
 * This tells the creative team (or future AI) what the video should look like.
 */
function buildVisualDirection(profile: { name: string; [key: string]: unknown }): string {
  const company = (profile.company as string) || "their company";
  const tone = (profile.tone as string) || "conversational";

  return `# Visual Direction

**Target:** ${profile.name}
**Tone:** ${tone}, warm, genuine
**Style:** Clean, modern 16:9. Premium SaaS aesthetic.

**Background:** Minimal, warm-toned. Subtle interface-inspired shapes. No text, no faces. High trust.
**Avatar:** Professional, direct eye contact, natural gestures.
**Colour palette:** Warm neutrals with a single accent. Not dark mode.

**Context:** This is a personalised outreach video to someone at ${company}. It should feel like a thoughtful message from a peer, not a marketing blast.

**Do:** Feel precise, warm, premium.
**Don't:** Feel generic, corporate, automated.`;
}

/**
 * Build a contextual background image prompt.
 */
function buildBackgroundPrompt(profile: { name: string; [key: string]: unknown }): string {
  const company = (profile.company as string) || "";
  const interests = (profile.interests as string[]) || [];

  const context = [
    company && `related to ${company}`,
    interests.length > 0 && `themes: ${interests.slice(0, 2).join(", ")}`,
  ]
    .filter(Boolean)
    .join(". ");

  return `Create a clean, modern 16:9 visual background for a personalized outreach video to a professional${company ? ` at ${company}` : ""}. The style should feel like a developer platform launch: minimal, warm, precise, with subtle interface-inspired shapes. ${context}. No text, no faces, high trust, premium SaaS aesthetic.`;
}

/**
 * Build a thumbnail prompt.
 */
function buildThumbnailPrompt(profile: { name: string; [key: string]: unknown }): string {
  const company = (profile.company as string) || "";
  return `Professional video thumbnail for personalised outreach to ${profile.name}${company ? ` at ${company}` : ""}. Clean, minimal, modern. Warm tones. No text overlay. 16:9.`;
}
