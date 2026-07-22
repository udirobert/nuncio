/**
 * Shared pipeline step functions — single source of truth for
 * research → synthesize → script → review → render.
 *
 * Both the SSE pipeline route (src/app/api/pipeline/route.ts) and
 * the agent API endpoints (src/app/api/agent/) call these functions.
 * No duplication, no divergence.
 */

import { enrich, fetchRecentActivity, enrichCompany } from "@/lib/tinyfish";
import { synthesise, generateScript, generateScriptVariants } from "@/lib/claude";
import type { Profile, IntentId, ScriptResult, SenderProfile, OutreachIntentProfile } from "@/lib/claude";
import { ResearchOrchestrator } from "@/lib/research/orchestrator";
import type { QualityTier } from "@/lib/research/types";
import type { PipelineActivityEmitter } from "./activity-emitter";
import { formatResearchSummary, formatProfileSummary, formatScriptDraft, formatReview } from "./format";

// ── Types ────────────────────────────────────────────────────────────

export interface PipelineInput {
  url: string;
  senderName?: string;
  senderBrief?: string;
  senderProfile?: SenderProfile;
  outreachIntent?: OutreachIntentProfile;
  /** How the outreach should be delivered. `livelink` prepares a live avatar session; `video` renders an MP4. */
  deliveryMode?: "video" | "livelink";
  researchTier?: "quick" | "balanced" | "deep";
  deepResearchEnabled?: boolean;
  languageOverride?: string;
  scriptVariants?: boolean;
  autoRender?: boolean;
  customization?: Record<string, unknown>;
  archetype?: string;
  userTier?: "trial" | "free" | "pro" | "studio";
}

export interface ResearchResult {
  profile: Profile;
  markdown: string[];
  recentActivity?: string;
  recentActivityPosts?: import("@/lib/tinyfish").ActivityPost[];
  companyContext?: string;
}

export interface ScriptOutput {
  scriptResult: ScriptResult;
  variantA?: string;
  variantB?: string;
}

export interface ReviewResult {
  issues: { category: string; detail: string }[];
  wordCount: number;
  passed: boolean;
}

export interface RenderResult {
  videoUrl: string;
  videoId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

export function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function buildSenderProfile(body: Record<string, unknown>): SenderProfile | undefined {
  const senderProfile: SenderProfile = {
    business: cleanOptionalString(body.senderBusiness),
    brand: cleanOptionalString(body.senderBrand),
    personality: cleanOptionalString(body.senderPersonality),
    audience: cleanOptionalString(body.senderAudience),
    offer: cleanOptionalString(body.senderOffer),
    proofPoints: cleanStringArray(body.senderProofPoints),
  };
  return Object.values(senderProfile).some(Boolean) ? senderProfile : undefined;
}

export function buildOutreachIntent(body: Record<string, unknown>): OutreachIntentProfile | undefined {
  const relationshipWarmth = body.relationshipWarmth;
  const playbook: OutreachIntentProfile["playbook"] = {
    wants: cleanOptionalString(body.wants),
    canOffer: cleanOptionalString(body.canOffer),
    wiggleRoom: cleanOptionalString(body.wiggleRoom),
    constraints: cleanStringArray(body.constraints),
  };
  const outreachIntent: OutreachIntentProfile = {
    goal: cleanOptionalString(body.outreachGoal),
    desiredOutcome: cleanOptionalString(body.desiredOutcome),
    reasonForReachingOutNow: cleanOptionalString(body.reasonForReachingOutNow),
    relationshipWarmth:
      relationshipWarmth === "cold" || relationshipWarmth === "warm" || relationshipWarmth === "existing"
        ? relationshipWarmth
        : undefined,
    tonePreference: cleanOptionalString(body.tonePreference),
    playbook: Object.values(playbook).some(Boolean) ? playbook : undefined,
  };
  return Object.values(outreachIntent).some(Boolean) ? outreachIntent : undefined;
}

// ── Step 1+2: Research & Synthesize ──────────────────────────────────

export async function researchAndSynthesize(
  input: PipelineInput,
  emitter?: PipelineActivityEmitter,
): Promise<ResearchResult> {
  const { url, researchTier, deepResearchEnabled, senderBrief, senderName, senderProfile, outreachIntent, languageOverride } = input;

  emitter?.thought("researcher", `Researching ${url}...`);

  const effectiveTier: QualityTier =
    researchTier === "balanced" || researchTier === "deep" ? researchTier : "quick";

  let markdown: string[];

  if (effectiveTier !== "quick" || deepResearchEnabled) {
    const orchestrator = new ResearchOrchestrator({
      qualityTier: effectiveTier,
      userTier: input.userTier || "free",
      enableDeepResearch: deepResearchEnabled,
      senderBrief,
    });

    const researchResult = await orchestrator.research(url);
    markdown = researchResult.sources
      .filter((s) => s.content)
      .map((s) => s.content || "")
      .filter(Boolean);

    if (markdown.length === 0) {
      throw new Error("Could not access profile. Try a different URL or platform.");
    }

    emitter?.message("researcher", `Enriched via ${researchResult.sources.length} source(s)`);
    emitter?.stageComplete("researcher", "Research complete");
  } else {
    const enrichment = await enrich([url], { discoverRelated: true });
    markdown = enrichment.filter((r) => r.success).map((r) => r.markdown);

    if (markdown.length === 0) {
      throw new Error("Could not access profile. The page may be behind a login wall.");
    }

    const results = enrichment.map((r) => ({
      url,
      success: r.success,
      markdown: r.markdown,
      reason: r.success ? undefined : "Enrichment failed",
    }));
    emitter?.message("researcher", formatResearchSummary(results));
    emitter?.stageComplete("researcher", "Research complete");
  }

  // Synthesize
  emitter?.thought("researcher", "Synthesizing recipient profile...");

  const senderContext = {
    senderBrief,
    senderName,
    senderBusiness: senderProfile?.business,
    senderBrand: senderProfile?.brand,
    senderPersonality: senderProfile?.personality,
    senderAudience: senderProfile?.audience,
    senderOffer: senderProfile?.offer,
    senderProofPoints: senderProfile?.proofPoints,
    outreachGoal: outreachIntent?.goal,
    desiredOutcome: outreachIntent?.desiredOutcome,
    relationshipWarmth: outreachIntent?.relationshipWarmth,
    reasonForReachingOutNow: outreachIntent?.reasonForReachingOutNow,
    tonePreference: outreachIntent?.tonePreference,
    playbook: outreachIntent?.playbook,
  };

  const profile = await synthesise(markdown, { senderContext });

  if (profile.name === "there") {
    throw new Error("Could not identify a person from this profile. Try a different URL.");
  }

  if (languageOverride) {
    profile.language = languageOverride;
  }
  if (senderProfile) {
    profile.sender_profile = senderProfile;
  }
  if (outreachIntent) {
    profile.outreach_intent = outreachIntent;
  }

  emitter?.message("researcher", formatProfileSummary(profile));

  // Quick-mode enrichment (recent activity + company context)
  let recentActivity: string | undefined;
  let recentActivityPosts: import("@/lib/tinyfish").ActivityPost[] | undefined;
  let companyContext: string | undefined;

  if (researchTier === "quick" || !researchTier) {
    const activity = await fetchRecentActivity(url);
    if (activity) {
      recentActivity = activity.markdown;
      recentActivityPosts = activity.posts.length > 0 ? activity.posts : undefined;
    }
    if (profile.company && profile.company !== "there") {
      const ctx = await enrichCompany(profile.company);
      if (ctx) companyContext = ctx;
    }
  }

  return { profile, markdown, recentActivity, recentActivityPosts, companyContext };
}

// ── Step 3: Generate Script ──────────────────────────────────────────

export async function generateOutreachScript(
  profile: Profile,
  senderBrief: string | undefined,
  input: PipelineInput,
  enrichment: { recentActivity?: string; companyContext?: string } = {},
  emitter?: PipelineActivityEmitter,
): Promise<ScriptOutput> {
  emitter?.thought("copywriter", "Drafting personalized outreach script...");

  const { senderName, outreachIntent, scriptVariants } = input;

  const scriptOptions = {
    intent: undefined as IntentId | undefined,
    senderName: typeof senderName === "string" ? senderName.trim() || undefined : undefined,
    recentActivity: enrichment.recentActivity,
    companyContext: enrichment.companyContext,
    senderProfile: input.senderProfile,
    outreachIntent,
    toneInstruction: outreachIntent?.tonePreference
      ? `Honor this sender preference where it still feels natural: ${outreachIntent.tonePreference}.`
      : undefined,
  };

  let scriptResult: ScriptResult;
  let variantA: string | undefined;
  let variantB: string | undefined;

  if (scriptVariants) {
    const variants = await generateScriptVariants(profile, senderBrief, scriptOptions);
    scriptResult = variants.variantA;
    variantA = variants.variantA.script;
    variantB = variants.variantB.script;
  } else {
    scriptResult = await generateScript(profile, senderBrief, scriptOptions);
  }

  emitter?.message("copywriter", formatScriptDraft(scriptResult, profile));
  emitter?.stageComplete("copywriter", "Script draft complete");
  emitter?.checkpoint("copywriter", "Script checkpoint", {
    script: scriptResult.script,
    variantA,
    variantB,
    vibeId: scriptResult.vibeId,
  });

  return { scriptResult, variantA, variantB };
}

// ── Step 4: Review ───────────────────────────────────────────────────

const FORBIDDEN_TERMS = [
  "guaranteed", "guarantee", "100%", "no risk", "risk-free",
  "act now", "limited time", "buy now", "click here",
];

export function reviewScript(
  scriptResult: ScriptResult,
  profile: Profile,
  emitter?: PipelineActivityEmitter,
): ReviewResult {
  emitter?.thought("reviewer", "Reviewing script for quality...");

  const wordCount = scriptResult.script.trim().split(/\s+/).filter(Boolean).length;
  const issues: { category: string; detail: string }[] = [];

  if (wordCount < 50) issues.push({ category: "Length", detail: `Script is ${wordCount} words (minimum 50).` });
  if (wordCount > 350) issues.push({ category: "Length", detail: `Script is ${wordCount} words (maximum 350).` });

  const lower = scriptResult.script.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) issues.push({ category: "Compliance", detail: `Forbidden term: "${term}".` });
  }

  if (!/[.!?]/.test(scriptResult.script)) {
    issues.push({ category: "Quality", detail: "No sentence-ending punctuation found." });
  }

  if (profile.name && profile.name !== "there") {
    const firstName = profile.name.split(" ")[0].toLowerCase();
    if (!lower.includes(firstName)) {
      issues.push({ category: "Personalization", detail: `Recipient's name not mentioned.` });
    }
  }

  emitter?.message("reviewer", formatReview(issues, wordCount));
  emitter?.stageComplete("reviewer", issues.length === 0 ? "Script approved" : "Edits requested");

  return { issues, wordCount, passed: issues.length === 0 };
}

// ── Step 5: Render Video ─────────────────────────────────────────────

export async function renderVideo(
  script: string,
  profile: Profile,
  customization: Record<string, unknown> | undefined,
  emitter?: PipelineActivityEmitter,
): Promise<RenderResult> {
  emitter?.thought("producer", "Starting video render...");

  const { createVideo } = await import("@/lib/heygen");
  const { pollVideoUntilReady } = await import("@/lib/pipeline/video-poller");

  const renderResult = await createVideo(script, undefined, profile.name, customization);
  const videoId = renderResult.videoId;

  emitter?.thought("producer", `Render submitted: ${videoId}. Polling for completion...`);

  const pollResult = await pollVideoUntilReady(videoId, {
    onProgress: (attempt, max) => {
      if (attempt % 6 === 1) {
        emitter?.thought("producer", `Render in progress... (${attempt}/${max})`);
      }
    },
  });

  emitter?.stageComplete("producer", "Video rendered");

  return { videoUrl: pollResult.videoUrl, videoId: pollResult.videoId };
}
