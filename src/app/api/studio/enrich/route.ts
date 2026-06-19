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

export interface EnrichResponse {
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
  recentActivityPosts?: import("@/lib/tinyfish").ActivityPost[];
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

async function resolveUserPlan(
  subject: import("@/lib/billing/credits").CreditSubject,
  request: NextRequest
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
        const { url, senderBrief, senderName, intent, archetype } = body;
        const researchTier = body.researchTier as string | undefined;
        const deepResearchEnabled = body.deepResearchEnabled === true;
        const senderProfile = buildSenderProfile(body as Record<string, unknown>);
        const outreachIntent = buildOutreachIntent(body as Record<string, unknown>);
        const clientProfile = body.profile as Profile | undefined;
        const languageOverride = body.language as string | undefined;

        const subject = getCreditSubject(request);
        const researchCost = estimateCreditCost("profile.research");
        const scriptCost = estimateCreditCost("script.generate");
        const deepCost = deepResearchEnabled ? estimateCreditCost("research.deep") : 0;
        const totalCost = researchCost + scriptCost + deepCost;

        const reservation = await reserveCredits({
          subject,
          action: "script.generate",
          amount: totalCost,
          reason: deepResearchEnabled
            ? "Deep research profile and generate script (studio)"
            : "Research profile and generate script (studio)",
          provider: clientProfile ? "llm" : "tinyfish+llm",
        });

        let profile: Profile;

        if (clientProfile) {
          profile = clientProfile;
          if (languageOverride) {
            profile.language = languageOverride;
          }
        } else {
          if (!url) {
            send({ error: "url is required" });
            controller.close();
            return;
          }

          send({ phase: "enrich" });

          // Phase 9: Use ResearchOrchestrator for deep/balanced research, fall back to TinyFish for quick
          const effectiveTier: QualityTier = researchTier === "balanced" || researchTier === "deep"
            ? researchTier
            : "quick";

          if (effectiveTier !== "quick" || deepResearchEnabled) {
            // Deep research path: use the orchestrator for multi-provider enrichment
            const orchestrator = new ResearchOrchestrator({
              qualityTier: effectiveTier,
              userTier: subject.anonymous ? "trial" : (await resolveUserPlan(subject, request)) || "free",
              enableDeepResearch: deepResearchEnabled,
              senderBrief: cleanOptionalString(senderBrief),
            });

            const researchResult = await orchestrator.research(url);
            const markdown = researchResult.sources
              .filter((s) => s.content)
              .map((s) => s.content || "")
              .filter(Boolean);

            if (markdown.length === 0) {
              send({ error: "Could not access profile. Try a different URL or platform." });
              controller.close();
              return;
            }

            send({ phase: "synthesise" });

            profile = await synthesise(markdown, {
              senderContext: {
                senderBrief: cleanOptionalString(senderBrief),
                senderName: cleanOptionalString(senderName),
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
            // Quick path: existing TinyFish enrichment (preserved unchanged)
            const enrichment_0 = await enrich([url], { discoverRelated: true });
            const markdown = enrichment_0.filter((r) => r.success).map((r) => r.markdown);

            if (markdown.length === 0) {
              send({ error: "Could not access profile. The page may be behind a login wall — try a different URL or platform." });
              controller.close();
              return;
            }

            send({ phase: "synthesise" });

            profile = await synthesise(markdown, {
              senderContext: {
                senderBrief: cleanOptionalString(senderBrief),
                senderName: cleanOptionalString(senderName),
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
            send({ error: "Could not identify a person from this profile. Try a different URL or platform." });
            controller.close();
            return;
          }
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

        send({ phase: "compose" });

        let recentActivity: string | undefined;
        let recentActivityPosts: import("@/lib/tinyfish").ActivityPost[] | undefined;
        let companyContext: string | undefined;

        // Only fetch activity + company context for quick tier (deep/balanced already have it via orchestrator)
        if (researchTier === "quick" || !researchTier) {
          if (url) {
            const activity = await fetchRecentActivity(url);
            if (activity) {
              recentActivity = activity.markdown;
              recentActivityPosts = activity.posts.length > 0 ? activity.posts : undefined;
            }
          }
          if (profile.company && profile.company !== "there") {
            const ctx = await enrichCompany(profile.company);
            if (ctx) companyContext = ctx;
          }
        }

        const scriptOptions = {
          intent: intent as IntentId | undefined,
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
          suggestedAngles: profile.suggestedAngles && profile.suggestedAngles.length > 0
            ? profile.suggestedAngles
            : undefined,
          sourceAttribution: profile.sourceAttribution,
          researchTier: (researchTier as "quick" | "balanced" | "deep" | undefined) || "quick",
          recentActivity,
          recentActivityPosts,
        };

        send({
          type: "done",
          result: response,
          creditsCharged: totalCost,
          creditsBalance: await getCreditBalance(subject),
        });

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
          console.error("[enrich] Fatal:", error);
          send({ error: "Something went wrong during enrichment" });
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
