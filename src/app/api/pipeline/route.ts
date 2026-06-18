import { NextRequest } from "next/server";
import { enrich, fetchRecentActivity, enrichCompany } from "@/lib/tinyfish";
import { synthesise, generateScript, generateScriptVariants } from "@/lib/claude";
import type { Profile, IntentId, ScriptResult, SenderProfile, OutreachIntentProfile } from "@/lib/claude";
import { chooseArchetype } from "@/lib/hooks/select";
import { pickFormat, type HookArchetypeId } from "@/lib/hooks/archetypes";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditBalance,
  getCreditSubject,
  InsufficientCreditsError,
  reserveCredits,
} from "@/lib/billing/credits";
import { ResearchOrchestrator } from "@/lib/research/orchestrator";
import type { QualityTier } from "@/lib/research/types";
import { PipelineActivityEmitter } from "@/lib/pipeline/activity-emitter";
import {
  formatResearchSummary,
  formatProfileSummary,
  formatScriptDraft,
  formatReview,
} from "@/lib/pipeline/format";

interface EnrichResponse {
  profile: Profile;
  script: string;
  scriptVariantA?: string;
  scriptVariantB?: string;
  vibeId: string;
  vibeReasoning: string;
  hook: {
    archetype: string;
    reasoning: string;
    concept: string;
    prompt: string;
    format: string;
    formatReasoning: string;
  };
  suggestedAngles?: import("@/lib/claude").TopicalAngle[];
  sourceAttribution?: import("@/lib/claude").SourceAttribution;
  researchTier?: "quick" | "balanced" | "deep";
  recentActivity?: string;
}

function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function buildSenderProfile(body: Record<string, unknown>): SenderProfile | undefined {
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

function buildOutreachIntent(body: Record<string, unknown>): OutreachIntentProfile | undefined {
  const relationshipWarmth = body.relationshipWarmth;
  const outreachIntent: OutreachIntentProfile = {
    goal: cleanOptionalString(body.outreachGoal),
    desiredOutcome: cleanOptionalString(body.desiredOutcome),
    reasonForReachingOutNow: cleanOptionalString(body.reasonForReachingOutNow),
    relationshipWarmth:
      relationshipWarmth === "cold" || relationshipWarmth === "warm" || relationshipWarmth === "existing"
        ? relationshipWarmth
        : undefined,
    tonePreference: cleanOptionalString(body.tonePreference),
  };
  return Object.values(outreachIntent).some(Boolean) ? outreachIntent : undefined;
}

async function resolveUserPlan(
  subject: import("@/lib/billing/credits").CreditSubject,
  request: NextRequest,
): Promise<"trial" | "free" | "pro" | "studio"> {
  if (subject.anonymous) return "trial";
  try {
    const { readAccountSession } = await import("@/lib/auth/session");
    const session = readAccountSession(request);
    if (!session) return "free";
    const { getAccountStorageProvider } = await import("@/lib/storage");
    const workspace = await getAccountStorageProvider().getWorkspace(session.workspaceId);
    if (!workspace) return "free";
    return (workspace.plan || "free") as "free" | "pro" | "studio";
  } catch {
    return "free";
  }
}

async function autoPopulateSenderContext(
  request: NextRequest,
): Promise<{ senderName?: string; senderBrief?: string; senderProfile?: SenderProfile }> {
  try {
    const { readAccountSession } = await import("@/lib/auth/session");
    const session = readAccountSession(request);
    if (!session) return {};
    const { getAccountStorageProvider } = await import("@/lib/storage");
    const workspace = await getAccountStorageProvider().getWorkspace(session.workspaceId);
    if (!workspace) return {};

    const senderProfile: SenderProfile = {};
    if (workspace.senderBusiness) senderProfile.business = workspace.senderBusiness;
    if (workspace.senderBrand) senderProfile.brand = workspace.senderBrand;
    if (workspace.senderPersonality) senderProfile.personality = workspace.senderPersonality;
    if (workspace.senderAudience) senderProfile.audience = workspace.senderAudience;
    if (workspace.senderOffer) senderProfile.offer = workspace.senderOffer;
    if (workspace.senderProofPoints) {
      const pp = workspace.senderProofPoints.split("\n").map((s) => s.trim()).filter(Boolean);
      if (pp.length > 0) senderProfile.proofPoints = pp;
    }

    return {
      senderName: workspace.lastSenderName || undefined,
      senderBrief: workspace.lastSenderBrief || undefined,
      senderProfile: Object.values(senderProfile).some(Boolean) ? senderProfile : undefined,
    };
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const body = await request.json();
        const { url, sessionId, archetype } = body;
        const researchTier = body.researchTier as string | undefined;
        const deepResearchEnabled = body.deepResearchEnabled === true;
        const languageOverride = body.language as string | undefined;

        const emitter = new PipelineActivityEmitter(sessionId || crypto.randomUUID());

        // Auto-populate sender context from workspace
        const accountContext = await autoPopulateSenderContext(request);
        const senderName = cleanOptionalString(body.senderName) || accountContext.senderName;
        const senderBrief = cleanOptionalString(body.senderBrief) || accountContext.senderBrief;
        const clientSenderProfile = buildSenderProfile(body as Record<string, unknown>);
        const senderProfile = clientSenderProfile || accountContext.senderProfile;
        const outreachIntent = buildOutreachIntent(body as Record<string, unknown>);

        const subject = getCreditSubject(request);
        const researchCost = estimateCreditCost("profile.research");
        const scriptCost = estimateCreditCost("script.generate");
        const deepCost = deepResearchEnabled ? estimateCreditCost("research.deep") : 0;
        const totalCost = researchCost + scriptCost + deepCost;

        const reservation = await reserveCredits({
          subject,
          action: "script.generate",
          amount: totalCost,
          reason: "Pipeline: research + script generation",
          provider: "tinyfish+llm",
        });

        if (!url) {
          send({ error: "url is required" });
          emitter.error("researcher", "No URL provided");
          controller.close();
          return;
        }

        // ── Step 1: Research ───────────────────────────────────────────
        emitter.thought("researcher", `Researching ${url}...`);
        send({ phase: "enrich" });

        const effectiveTier: QualityTier = researchTier === "balanced" || researchTier === "deep"
          ? researchTier
          : "quick";

        let profile: Profile;

        if (effectiveTier !== "quick" || deepResearchEnabled) {
          const orchestrator = new ResearchOrchestrator({
            qualityTier: effectiveTier,
            userTier: subject.anonymous ? "trial" : (await resolveUserPlan(subject, request)) || "free",
            enableDeepResearch: deepResearchEnabled,
            senderBrief: senderBrief,
          });

          const researchResult = await orchestrator.research(url);
          const markdown = researchResult.sources
            .filter((s) => s.content)
            .map((s) => s.content || "")
            .filter(Boolean);

          if (markdown.length === 0) {
            send({ error: "Could not access profile. Try a different URL or platform." });
            emitter.error("researcher", "Could not access profile");
            controller.close();
            return;
          }

          emitter.message("researcher", `Enriched via ${researchResult.sources.length} source(s)`);
          emitter.stageComplete("researcher", "Research complete");

          // ── Step 2: Synthesize ─────────────────────────────────────────
          emitter.thought("researcher", "Synthesizing recipient profile...");
          send({ phase: "synthesise" });

          profile = await synthesise(markdown, {
            senderContext: {
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
            },
          });
        } else {
          const enrichment_0 = await enrich([url], { discoverRelated: true });
          const results = enrichment_0.map((r) => ({
            url: url,
            success: r.success,
            markdown: r.markdown,
            reason: r.success ? undefined : "Enrichment failed",
          }));

          const markdown = enrichment_0.filter((r) => r.success).map((r) => r.markdown);

          if (markdown.length === 0) {
            send({ error: "Could not access profile. The page may be behind a login wall." });
            emitter.error("researcher", "Could not access profile");
            controller.close();
            return;
          }

          emitter.message("researcher", formatResearchSummary(results));
          emitter.stageComplete("researcher", "Research complete");

          // ── Step 2: Synthesize ─────────────────────────────────────────
          emitter.thought("researcher", "Synthesizing recipient profile...");
          send({ phase: "synthesise" });

          profile = await synthesise(markdown, {
            senderContext: {
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
            },
          });
        }

        if (profile.name === "there") {
          send({ error: "Could not identify a person from this profile. Try a different URL." });
          emitter.error("researcher", "Could not identify person");
          controller.close();
          return;
        }

        emitter.message("researcher", formatProfileSummary(profile));

        if (languageOverride) {
          profile.language = languageOverride;
        }
        if (senderProfile) {
          profile.sender_profile = senderProfile;
        }
        if (outreachIntent) {
          profile.outreach_intent = outreachIntent;
        }

        // ── Step 3: Generate Script ──────────────────────────────────────
        emitter.thought("copywriter", "Drafting personalized outreach script...");
        send({ phase: "compose" });

        let recentActivity: string | undefined;
        let companyContext: string | undefined;

        if (researchTier === "quick" || !researchTier) {
          const activity = await fetchRecentActivity(url);
          if (activity) recentActivity = activity.markdown;
          if (profile.company && profile.company !== "there") {
            const ctx = await enrichCompany(profile.company);
            if (ctx) companyContext = ctx;
          }
        }

        const scriptOptions = {
          intent: undefined as IntentId | undefined,
          senderName: typeof senderName === "string" ? senderName.trim() || undefined : undefined,
          recentActivity,
          companyContext,
          senderProfile,
          outreachIntent,
          toneInstruction: outreachIntent?.tonePreference
            ? `Honor this sender preference where it still feels natural: ${outreachIntent.tonePreference}.`
            : undefined,
        };

        let scriptResult: ScriptResult;
        let variantA: string | undefined;
        let variantB: string | undefined;

        const wantsVariants = body.scriptVariants === true;
        if (wantsVariants) {
          const variants = await generateScriptVariants(profile, senderBrief, scriptOptions);
          scriptResult = variants.variantA;
          variantA = variants.variantA.script;
          variantB = variants.variantB.script;
        } else {
          scriptResult = await generateScript(profile, senderBrief, scriptOptions);
        }

        emitter.message("copywriter", formatScriptDraft(scriptResult, profile));
        emitter.stageComplete("copywriter", "Script draft complete");

        // ── Step 4: Review ───────────────────────────────────────────────
        emitter.thought("reviewer", "Reviewing script for quality...");

        const wordCount = scriptResult.script.trim().split(/\s+/).filter(Boolean).length;
        const issues: { category: string; detail: string }[] = [];
        const FORBIDDEN = ["guaranteed", "guarantee", "100%", "no risk", "risk-free", "act now", "limited time", "buy now", "click here"];

        if (wordCount < 50) issues.push({ category: "Length", detail: `Script is ${wordCount} words (minimum 50).` });
        if (wordCount > 350) issues.push({ category: "Length", detail: `Script is ${wordCount} words (maximum 350).` });
        const lower = scriptResult.script.toLowerCase();
        for (const term of FORBIDDEN) {
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

        emitter.message("reviewer", formatReview(issues, wordCount));
        emitter.stageComplete("reviewer", issues.length === 0 ? "Script approved" : "Edits requested");

        // ── Step 5: Optional Auto-Render ──────────────────────────────────
        const autoRender = body.autoRender === true;
        let videoUrl: string | undefined;
        let videoId: string | undefined;

        if (autoRender && issues.length === 0) {
          emitter.thought("producer", "Starting video render...");

          try {
            const { createVideo } = await import("@/lib/heygen");
            const renderCost = estimateCreditCost("video.render");
            const renderReservation = await reserveCredits({
              subject,
              action: "video.render",
              amount: renderCost,
              reason: "Pipeline: render personalized video",
              provider: "heygen",
            });

            const renderResult = await createVideo(
              scriptResult.script,
              undefined,
              profile.name,
              body.customization,
            );
            videoId = renderResult.videoId;
            emitter.thought("producer", `Render submitted: ${videoId}. Polling for completion...`);

            const { pollVideoUntilReady } = await import("@/lib/pipeline/video-poller");
            const pollResult = await pollVideoUntilReady(videoId!, {
              onProgress: (attempt, max) => {
                if (attempt % 6 === 1) {
                  emitter.thought("producer", `Render in progress... (${attempt}/${max})`);
                }
              },
            });

            videoUrl = pollResult.videoUrl;
            emitter.stageComplete("producer", "Video rendered");
            await commitCreditReservation(renderReservation.id);
          } catch (renderError) {
            emitter.error("producer", `Render failed: ${renderError instanceof Error ? renderError.message : "unknown"}`);
          }
        }

        // ── Done ─────────────────────────────────────────────────────────
        const hookChoice = chooseArchetype(profile, senderBrief, archetype as HookArchetypeId | undefined);
        const hookFormat = pickFormat(profile);

        await commitCreditReservation(reservation.id);

        const response: EnrichResponse = {
          profile,
          script: scriptResult.script,
          scriptVariantA: variantA,
          scriptVariantB: variantB,
          vibeId: scriptResult.vibeId,
          vibeReasoning: scriptResult.vibeReasoning,
          hook: {
            archetype: hookChoice.archetype.label,
            reasoning: hookChoice.reasoning,
            concept: hookChoice.concept,
            prompt: hookChoice.prompt,
            format: hookFormat.label,
            formatReasoning: hookFormat.reasoning,
          },
          suggestedAngles: profile.suggestedAngles?.length ? profile.suggestedAngles : undefined,
          sourceAttribution: profile.sourceAttribution,
          researchTier: (researchTier as "quick" | "balanced" | "deep" | undefined) || "quick",
          recentActivity,
        };

        if (videoUrl) {
          emitter.complete("producer", "Video ready", {
            script: scriptResult.script,
            profile,
            videoUrl,
            videoId,
          });
          send({ type: "ready", result: response, videoUrl, videoId });
        } else {
          emitter.complete("producer", "Script ready for review", {
            script: scriptResult.script,
            profile,
          });
          send({
            type: "done",
            result: response,
            creditsCharged: totalCost,
            creditsBalance: await getCreditBalance(subject),
          });
        }

        controller.close();
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          send({
            error: error.message,
            requiredCredits: error.required,
            availableCredits: error.available,
            insufficientCredits: true,
          });
        } else {
          console.error("[pipeline] Fatal:", error);
          send({ error: "Something went wrong during pipeline execution" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
