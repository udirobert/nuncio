import { getCreativeProvider } from "@/lib/creative";
import { LocalProvider } from "@/lib/creative/local-provider";
import type { CreativeProvider, CreativeSession } from "@/lib/creative";

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
  senderBrief?: string,
  industry?: string
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
    const visualDirection = buildVisualDirection(profile, industry);
    await provider.storeText(session, "Visual Direction", visualDirection);
    textNodesCreated++;
  } catch (e) {
    console.warn("[melius] Failed to store visual direction:", e);
  }

  // 3. MEDIA: Attempt image generation (non-blocking on failure)
  const backgroundPrompt = buildBackgroundPrompt(profile, industry);
  try {
    await provider.generateBackground(session, backgroundPrompt);
  } catch (e) {
    console.warn("[melius] Background generation failed (non-blocking):", e);
  }

  try {
    const thumbnailPrompt = buildThumbnailPrompt(profile, industry);
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

async function runCanvasFlow(
  provider: CreativeProvider,
  profile: { name: string; [key: string]: unknown },
  script: string,
  senderBrief?: string,
  industry?: string
): Promise<CanvasResult> {
  // 1. Create session
  const session: CreativeSession = await provider.createSession(profile.name);
  let textNodesCreated = 0;

  // 2. TEXT-FIRST: Create all text nodes (these are fast and always succeed)
  try {
    await provider.storeText(session, "Profile Summary", formatProfileSummary(profile));
    textNodesCreated++;
  } catch (e) {
    console.warn(`[creative:${provider.name}] Failed to store profile summary:`, e);
  }

  try {
    await provider.storeText(session, "Script", script);
    textNodesCreated++;
  } catch (e) {
    console.warn(`[creative:${provider.name}] Failed to store script:`, e);
  }

  try {
    await provider.storeText(
      session,
      "Outreach Objective",
      senderBrief || `Personalised video outreach to ${profile.name}`
    );
    textNodesCreated++;
  } catch (e) {
    console.warn(`[creative:${provider.name}] Failed to store objective:`, e);
  }

  try {
    const visualDirection = buildVisualDirection(profile, industry);
    await provider.storeText(session, "Visual Direction", visualDirection);
    textNodesCreated++;
  } catch (e) {
    console.warn(`[creative:${provider.name}] Failed to store visual direction:`, e);
  }

  // 3. MEDIA: Attempt image generation (non-blocking on failure)
  const backgroundPrompt = buildBackgroundPrompt(profile, industry);
  try {
    await provider.generateBackground(session, backgroundPrompt);
  } catch (e) {
    console.warn(`[creative:${provider.name}] Background generation failed (non-blocking):`, e);
  }

  try {
    const thumbnailPrompt = buildThumbnailPrompt(profile, industry);
    await provider.generateThumbnail(session, thumbnailPrompt);
  } catch (e) {
    console.warn(`[creative:${provider.name}] Thumbnail generation failed (non-blocking):`, e);
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
function buildVisualDirection(profile: { name: string; [key: string]: unknown }, industry?: string): string {
  const company = (profile.company as string) || "their company";
  const tone = (profile.tone as string) || "conversational";

  const industryStyles: Record<string, { style: string; background: string; avatar: string }> = {
    food: {
      style: "Warm, inviting, artisanal. Think farm-to-table restaurant aesthetic.",
      background: "Warm kitchen or dining setting, subtle culinary elements, natural lighting.",
      avatar: "Professional but approachable, warmth in expression, natural gestures.",
    },
    fitness: {
      style: "Energetic, dynamic, motivating. Clean gym or active lifestyle aesthetic.",
      background: "Modern gym or studio environment, clean lines, energetic but not chaotic.",
      avatar: "Fit, energetic, confident. Direct eye contact with motivating energy.",
    },
    construction: {
      style: "Rugged but professional. Blue-collar pride meets modern business.",
      background: "Clean job site or workshop backdrop, industrial elements, well-lit.",
      avatar: "Hard-working, trustworthy, genuine. Not overly corporate.",
    },
    tech: {
      style: "Clean, modern 16:9. Premium SaaS aesthetic.",
      background: "Minimal, warm-toned. Subtle interface-inspired shapes. No text, no faces. High trust.",
      avatar: "Professional, direct eye contact, natural gestures.",
    },
    finance: {
      style: "Professional, trustworthy, but not stuffy. Modern finance aesthetic.",
      background: "Clean office or abstract financial imagery, subtle charts/graphs as accents.",
      avatar: "Professional, confident, approachable. Not stiff or overly formal.",
    },
    healthcare: {
      style: "Clean, caring, professional. Modern healthcare aesthetic.",
      background: "Clean medical environment or abstract wellness imagery, soft colors.",
      avatar: "Caring, professional, trustworthy. Warm but competent.",
    },
    education: {
      style: "Inspiring, approachable, knowledge-focused. Modern educator aesthetic.",
      background: "Modern classroom or library setting, books, warm lighting.",
      avatar: "Inspiring, knowledgeable, approachable. Not condescending.",
    },
    marketing: {
      style: "Creative, modern, trendy. Agency aesthetic.",
      background: "Creative workspace or abstract colorful shapes, modern and vibrant.",
      avatar: "Creative, confident, expressive. Natural, not staged.",
    },
    sales: {
      style: "Confident, energetic, approachable. Modern sales aesthetic.",
      background: "Modern office or abstract success imagery, dynamic but clean.",
      avatar: "Confident, enthusiastic, genuine. Not pushy.",
    },
  };

  const industryStyle = industryStyles[industry || "tech"];
  const defaultStyle = industryStyles.tech;

  return `# Visual Direction

**Target:** ${profile.name}
**Tone:** ${tone}, warm, genuine
**Industry:** ${industry || "general"}

**Style:** ${industryStyle.style}

**Background:** ${industryStyle.background}
**Avatar:** ${industryStyle.avatar}
**Colour palette:** Warm neutrals with a single accent. Not dark mode.

**Context:** This is a personalised outreach video to someone at ${company}. It should feel like a thoughtful message from a peer, not a marketing blast.

**Do:** Feel precise, warm, premium.
**Don't:** Feel generic, corporate, automated.`;
}

/**
 * Build a contextual background image prompt.
 */
function buildBackgroundPrompt(profile: { name: string; [key: string]: unknown }, industry?: string): string {
  const company = (profile.company as string) || "";
  const interests = (profile.interests as string[]) || [];

  const industryPrompts: Record<string, string> = {
    food: "Warm kitchen or culinary environment, artisanal feel, natural ingredients, warm lighting.",
    fitness: "Modern gym or fitness studio, energetic but clean, motivational atmosphere.",
    construction: "Professional job site or workshop, clean and organized, blue-collar pride.",
    tech: "Developer platform launch: minimal, warm, precise, with subtle interface-inspired shapes.",
    finance: "Modern finance office or abstract financial patterns, professional and trustworthy.",
    healthcare: "Clean medical or wellness environment, soft colors, caring atmosphere.",
    education: "Modern classroom or library, inspiring learning environment, warm tones.",
    marketing: "Creative agency workspace, vibrant but professional, modern and trendy.",
    sales: "Dynamic modern office, success imagery, confident and energetic.",
  };

  const industryPrompt = industry ? industryPrompts[industry] : industryPrompts.tech;
  const context = [
    company && `related to ${company}`,
    interests.length > 0 && `themes: ${interests.slice(0, 2).join(", ")}`,
  ]
    .filter(Boolean)
    .join(". ");

  return `Create a clean, modern 16:9 visual background for a personalized outreach video to a professional${company ? ` at ${company}` : ""}. ${industryPrompt} ${context}. No text, no faces, high trust.`;
}

/**
 * Build a thumbnail prompt.
 */
function buildThumbnailPrompt(profile: { name: string; [key: string]: unknown }, industry?: string): string {
  const company = (profile.company as string) || "";

  const industryThumbs: Record<string, string> = {
    food: "Warm, inviting, culinary-inspired thumbnail.",
    fitness: "Energetic, dynamic, active lifestyle thumbnail.",
    construction: "Professional, rugged, blue-collar thumbnail.",
    tech: "Clean, modern, premium SaaS thumbnail.",
    finance: "Professional, trustworthy, modern finance thumbnail.",
    healthcare: "Clean, caring, medical wellness thumbnail.",
    education: "Inspiring, approachable, knowledge-focused thumbnail.",
    marketing: "Creative, vibrant, trendy thumbnail.",
    sales: "Confident, energetic, dynamic thumbnail.",
  };

  return `Professional video thumbnail for personalised outreach to ${profile.name}${company ? ` at ${company}` : ""}. ${industry ? industryThumbs[industry] : industryThumbs.tech}. No text overlay. 16:9.`;
}
