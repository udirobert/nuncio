/**
 * Shared pipeline step functions — single source of truth for
 * research → synthesize → script → review → render → generate media assets.
 *
 * Both the SSE pipeline route (src/app/api/pipeline/route.ts) and
 * the agent API endpoints (src/app/api/agent/) call these functions.
 * No duplication, no divergence.
 */

import { enrich, fetchRecentActivity, enrichCompany } from "@/lib/tinyfish";
import { genblazeComposite, isGenblazeWorkerConfigured } from "@/lib/genblaze-client";
import { persistVideo, persistTrace, persistAssetManifest } from "@/lib/storage/media-store";
import type { PersistResult } from "@/lib/storage/media-store";
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
  /** Quality assessment — used to warn the user before spending render credits. */
  researchQuality?: ResearchQuality;
}

/**
 * Assessment of how much reliable data went into the profile synthesis.
 * The pipeline route uses this to warn the user (or gate auto-render)
 * before spending HeyGen credits on a low-confidence profile.
 */
export interface ResearchQuality {
  /** "high" = multiple non-tweet sources + recent activity; "medium" = some data; "low" = thin/degraded. */
  confidence: "high" | "medium" | "low";
  /** Number of distinct enriched markdown sources that contributed content. */
  sourceCount: number;
  /** Number of recent-activity posts found (0 if API degraded). */
  recentPostCount: number;
  /** True if any source relied on TinyFish Search fallback (vs direct fetch). */
  usedSearchFallback: boolean;
  /** Non-fatal warnings collected during research (TinyFish API errors, etc). */
  warnings: string[];
  /** Human-readable summary for the activity panel. */
  summary: string;
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

  const warnings: string[] = [];
  let markdown: string[];
  let usedSearchFallback = false;

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

    // Collect warnings from degraded enrichment results (TinyFish API errors)
    for (const r of enrichment) {
      if (r.warning) warnings.push(r.warning);
      if (r.source === "search") usedSearchFallback = true;
    }

    if (markdown.length === 0) {
      // If we have API-level warnings, surface them as the error message
      // instead of the generic login-wall message.
      if (warnings.length > 0) {
        emitter?.error("researcher", warnings.join("; "));
        throw new Error(
          `Could not access profile: ${warnings[0]} The page may also be behind a login wall.`
        );
      }
      throw new Error("Could not access profile. The page may be behind a login wall.");
    }

    const results = enrichment.map((r) => ({
      url,
      success: r.success,
      markdown: r.markdown,
      reason: r.success ? undefined : (r.warning || "Enrichment failed"),
    }));
    emitter?.message("researcher", formatResearchSummary(results));
    emitter?.stageComplete("researcher", "Research complete");
  }

  // ── Fetch recent activity BEFORE synthesis ──────────────────────────
  // Previously this ran after synthesis, so the LLM had already committed
  // to a characterization before seeing recent posts. Now we fetch it
  // first and include it in the synthesis input so the LLM can weigh
  // tweets against profile data rather than having tweets bolted on later.
  let recentActivity: string | undefined;
  let recentActivityPosts: import("@/lib/tinyfish").ActivityPost[] | undefined;
  let recentActivityWarning: string | undefined;

  if (researchTier === "quick" || !researchTier) {
    const activity = await fetchRecentActivity(url);
    if (activity) {
      recentActivity = activity.markdown;
      recentActivityPosts = activity.posts.length > 0 ? activity.posts : undefined;
      if (activity.warning) {
        recentActivityWarning = activity.warning;
        warnings.push(activity.warning);
      }
    }
  }

  // Synthesize — include recent activity in the enrichment so the LLM
  // has the full picture (identity + recent posts) before committing.
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

  // Prepend recent activity to the enrichment so synthesis sees it.
  // The LLM prompt already handles "Profile URL at top, other data below."
  const synthesisInput = recentActivity
    ? [recentActivity, ...markdown]
    : markdown;

  const profile = await synthesise(synthesisInput, { senderContext });

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

  // ── Company context (still after synthesis — needs profile.company) ──
  let companyContext: string | undefined;
  if (researchTier === "quick" || !researchTier) {
    if (profile.company && profile.company !== "there") {
      const ctx = await enrichCompany(profile.company);
      if (ctx) companyContext = ctx;
    }
  }

  // ── Assess research quality ─────────────────────────────────────────
  const researchQuality = assessResearchQuality({
    sourceCount: markdown.length,
    recentPostCount: recentActivityPosts?.length || 0,
    usedSearchFallback,
    warnings,
    hasRecentActivityWarning: !!recentActivityWarning,
  });

  if (researchQuality.confidence === "low") {
    emitter?.error("researcher",
      `Low-confidence profile: ${researchQuality.summary}`);
  } else if (researchQuality.confidence === "medium" && warnings.length > 0) {
    emitter?.thought("researcher",
      `Research degraded: ${warnings.join("; ")}`);
  }

  return {
    profile,
    markdown,
    recentActivity,
    recentActivityPosts,
    companyContext,
    researchQuality,
  };
}

// ── Research quality assessment ──────────────────────────────────────

/**
 * Assess how much reliable data went into the profile synthesis.
 *
 * The goal is to prevent the "wasted credit" problem: the user pastes a
 * Twitter link, TinyFish is degraded, the pipeline produces a thin profile
 * from 1-2 tweet snippets, and the user only discovers the poor quality
 * after spending a HeyGen render credit.
 *
 * Confidence levels:
 * - "high": 3+ sources AND recent activity found, no API warnings.
 * - "medium": 1-2 sources, or search fallback used, or recent activity
 *   unavailable but identity data is present.
 * - "low": single source via search fallback, OR API errors, OR zero
 *   recent activity AND search fallback used.
 */
function assessResearchQuality(params: {
  sourceCount: number;
  recentPostCount: number;
  usedSearchFallback: boolean;
  warnings: string[];
  hasRecentActivityWarning: boolean;
}): ResearchQuality {
  const { sourceCount, recentPostCount, usedSearchFallback, warnings, hasRecentActivityWarning } = params;

  const hasApiErrors = warnings.some((w) =>
    w.includes("out of credits") || w.includes("invalid") || w.includes("unavailable")
  );

  let confidence: ResearchQuality["confidence"];

  if (sourceCount >= 3 && recentPostCount > 0 && !hasApiErrors) {
    confidence = "high";
  } else if (sourceCount >= 1 && !hasApiErrors && (recentPostCount > 0 || !usedSearchFallback)) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  const parts: string[] = [`${sourceCount} source(s)`];
  if (recentPostCount > 0) parts.push(`${recentPostCount} recent post(s)`);
  if (usedSearchFallback) parts.push("search fallback used");
  if (hasApiErrors) parts.push(`${warnings.length} API warning(s)`);
  if (hasRecentActivityWarning) parts.push("recent activity degraded");

  const summary = parts.join(", ");

  return {
    confidence,
    sourceCount,
    recentPostCount,
    usedSearchFallback,
    warnings,
    summary,
  };
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

// ── Step 6: Generate Media Assets (Genblaze + B2) ────────────────────

/**
 * Media assets generated by the Genblaze composite pipeline and persisted to B2.
 * This is the single source of truth for all generated media accompanying a share.
 */
export interface MediaAssets {
  /** B2-persisted video URL (HeyGen render → B2). */
  videoUrl: string;
  /** Genblaze-generated thumbnail URL (GMI Cloud → B2). */
  thumbnailUrl?: string;
  /** Genblaze-generated soundscape URL (ElevenLabs SFX → B2). */
  soundscapeUrl?: string;
  /** Genblaze-generated TTS narration URL (ElevenLabs v3 → B2). */
  narrationUrl?: string;
  /** Genblaze composite manifest URI (provenance). */
  manifestUri?: string;
  /** Genblaze composite manifest hash (content-addressed provenance). */
  manifestHash?: string;
  /** B2-persisted pipeline trace URL. */
  traceUrl?: string;
  /** B2 asset manifest URL (index of all assets for this share). */
  assetManifestUrl?: string;
  /** SHA-256 hashes for each asset. */
  hashes: Record<string, string | undefined>;
  /** Genblaze provider attribution for the share page trace. */
  genblazeProviders?: string[];
  /** Whether the Genblaze worker was used (false = fallback to direct calls). */
  usedGenblaze: boolean;
}

/**
 * Generate supporting media assets (thumbnail, soundscape, narration) via the
 * Genblaze composite pipeline, persist the rendered video to B2, and write a
 * per-share asset manifest + pipeline trace.
 *
 * This step makes Genblaze integral to the main pipeline flow, not a bolt-on.
 * When the Genblaze worker is configured, a single `nuncio-composite` Pipeline
 * run orchestrates GMI Cloud (thumbnail) + ElevenLabs (soundscape + narration)
 * across IMAGE and AUDIO modalities, with automatic B2 storage and provenance
 * manifests. When unconfigured, falls back gracefully (video still persists to B2).
 *
 * Called after `renderVideo` in the pipeline route.
 */
export async function generateMediaAssets(
  videoUrl: string,
  script: string,
  profile: Profile,
  shareId: string,
  hookConcept: string,
  soundscapePrompt: string,
  emitter?: PipelineActivityEmitter,
): Promise<MediaAssets> {
  const hashes: Record<string, string | undefined> = {};
  const genblazeProviders: string[] = [];
  let thumbnailUrl: string | undefined;
  let soundscapeUrl: string | undefined;
  let narrationUrl: string | undefined;
  let manifestUri: string | undefined;
  let manifestHash: string | undefined;
  let usedGenblaze = false;

  // ── Persist video to B2 ────────────────────────────────────────────
  // HeyGen renders have signed URLs that expire (~24h). Persist to B2 for
  // durable, presigned-URL-served access. Non-blocking: falls back to
  // the temporary URL if B2 is unconfigured.
  emitter?.thought("producer", "Persisting video to B2...");
  const persistedAssets: PersistResult[] = [];
  const videoPersist = await persistVideo(videoUrl, shareId);
  const durableVideoUrl = videoPersist.url;
  if (videoPersist.result) {
    hashes.video = videoPersist.result.sha256;
    persistedAssets.push(videoPersist.result);
  }

  // ── Genblaze composite pipeline ───────────────────────────────────
  // One Pipeline run across two providers (GMI Cloud + ElevenLabs) and
  // two modalities (IMAGE + AUDIO). Generates thumbnail, soundscape, and
  // narration with a single manifest and B2 sink.
  if (isGenblazeWorkerConfigured()) {
    emitter?.thought("producer", "Generating media via Genblaze composite pipeline...");

    try {
      const composite = await genblazeComposite(
        script, // narration text
        shareId,
        {
          soundscapePrompt: soundscapePrompt || "Ambient professional soundscape. Subtle, non-distracting.",
          thumbnailModel: "seedream-5.0-lite",
        },
      );

      if (composite) {
        usedGenblaze = true;
        manifestUri = composite.manifest_uri;
        manifestHash = composite.manifest_hash;

        for (const asset of composite.assets) {
          if (asset.modality === "IMAGE") {
            thumbnailUrl = asset.url;
            hashes.thumbnail = asset.sha256;
            genblazeProviders.push(`gmi-cloud/${asset.model}`);
          } else if (asset.provider?.includes("elevenlabs") && asset.model === "sound-fx") {
            soundscapeUrl = asset.url;
            hashes.soundscape = asset.sha256;
            genblazeProviders.push("elevenlabs/sound-fx");
          } else if (asset.provider?.includes("elevenlabs")) {
            narrationUrl = asset.url;
            hashes.narration = asset.sha256;
            genblazeProviders.push("elevenlabs/eleven_v3");
          }

          persistedAssets.push({
            url: asset.url,
            key: asset.url.split("/").slice(-2).join("/"),
            provider: "genblaze",
            sha256: asset.sha256,
          });
        }

        emitter?.message("producer", `Genblaze: ${composite.assets.length} assets via ${genblazeProviders.join(", ")}`);
      }
    } catch (error) {
      emitter?.error("producer", `Genblaze generation failed, continuing with video only: ${error instanceof Error ? error.message : "unknown"}`);
    }
  } else {
    emitter?.thought("producer", "Genblaze worker not configured, skipping composite media generation");
  }

  // ── Persist pipeline trace + asset manifest to B2 ─────────────────
  const trace = {
    schema: "nuncio.pipeline.v2",
    shareId,
    video: {
      provider: "heygen",
      url: durableVideoUrl,
      sha256: hashes.video,
    },
    genblaze: usedGenblaze
      ? {
          pipeline: "nuncio-composite",
          providers: genblazeProviders,
          manifestUri,
          manifestHash,
          assets: {
            thumbnail: thumbnailUrl ? { url: thumbnailUrl, sha256: hashes.thumbnail } : undefined,
            soundscape: soundscapeUrl ? { url: soundscapeUrl, sha256: hashes.soundscape } : undefined,
            narration: narrationUrl ? { url: narrationUrl, sha256: hashes.narration } : undefined,
          },
        }
      : undefined,
    b2: {
      provider: "backblaze-b2",
      persistedAssets: persistedAssets.length,
      metadata: {
        app: "nuncio",
        role: "composite",
        pipeline: usedGenblaze ? "genblaze" : "direct",
      },
    },
    timestamp: new Date().toISOString(),
  };

  let traceUrl: string | undefined;
  let assetManifestUrl: string | undefined;
  try {
    const traceResult = await persistTrace(trace, shareId);
    traceUrl = traceResult.url;
    if (traceResult.result) persistedAssets.push(traceResult.result);

    const manifestResult = await persistAssetManifest(shareId, persistedAssets);
    assetManifestUrl = manifestResult.url;
  } catch (error) {
    console.warn("[pipeline] Trace/manifest persistence failed:", error);
  }

  emitter?.stageComplete("producer", usedGenblaze
    ? `Media assets generated via Genblaze + persisted to B2 (${persistedAssets.length} assets)`
    : `Video persisted to B2 (${persistedAssets.length} assets)`);

  return {
    videoUrl: durableVideoUrl,
    thumbnailUrl,
    soundscapeUrl,
    narrationUrl,
    manifestUri,
    manifestHash,
    traceUrl,
    assetManifestUrl,
    hashes,
    genblazeProviders: genblazeProviders.length > 0 ? genblazeProviders : undefined,
    usedGenblaze,
  };
}
