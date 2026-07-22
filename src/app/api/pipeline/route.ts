import { NextRequest } from "next/server";
import type { Profile, SenderProfile } from "@/lib/claude";
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
import { PipelineActivityEmitter } from "@/lib/pipeline/activity-emitter";
import { formatProfileSummary } from "@/lib/pipeline/format";
import { getBandActivityProvider } from "@/lib/storage";
import {
  buildSenderProfile,
  buildOutreachIntent,
  cleanOptionalString,
  researchAndSynthesize,
  generateOutreachScript,
  reviewScript,
  renderVideo,
  type PipelineInput,
} from "@/lib/pipeline/steps";

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
  recentActivityPosts?: import("@/lib/tinyfish").ActivityPost[];
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

        // Resume from checkpoint if available
        const resumeSessionId = body.resumeSessionId as string | undefined;
        let resumedProfile: Profile | undefined;

        if (resumeSessionId) {
          try {
            const prevEvents = await getBandActivityProvider().getEvents(resumeSessionId);
            const checkpoints = prevEvents.filter((e) => e.eventType === "checkpoint");
            const profileCp = checkpoints.find((e) => e.agent === "researcher" && e.metadata?.profile);

            if (profileCp) {
              resumedProfile = profileCp.metadata!.profile as Profile;
              emitter.thought("system", "Resuming from profile checkpoint...");
            }
          } catch { /* no checkpoints available, run full pipeline */ }
        }

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

        const pipelineInput: PipelineInput = {
          url,
          senderName,
          senderBrief,
          senderProfile,
          outreachIntent,
          deliveryMode: body.deliveryMode === "livelink" ? "livelink" : "video",
          researchTier: researchTier as "quick" | "balanced" | "deep" | undefined,
          deepResearchEnabled,
          languageOverride,
          scriptVariants: body.scriptVariants === true,
          autoRender: body.autoRender === true,
          customization: body.customization,
          archetype,
          userTier: subject.anonymous ? "trial" : await resolveUserPlan(subject, request),
        };

        // ── Steps 1+2: Research & Synthesize ───────────────────────────
        let profile: Profile;
        let recentActivity: string | undefined;
        let recentActivityPosts: import("@/lib/tinyfish").ActivityPost[] | undefined;
        let companyContext: string | undefined;

        if (resumedProfile) {
          profile = resumedProfile;
          emitter.message("researcher", formatProfileSummary(profile));
          emitter.stageComplete("researcher", "Resumed from checkpoint");
          send({ phase: "compose" });
        } else {
          send({ phase: "enrich" });
          const research = await researchAndSynthesize(pipelineInput, emitter);
          profile = research.profile;
          recentActivity = research.recentActivity;
          recentActivityPosts = research.recentActivityPosts;
          companyContext = research.companyContext;

          emitter.checkpoint("researcher", "Profile checkpoint", { profile });
          send({ phase: "synthesise" });
        }

        // ── Step 3: Generate Script ─────────────────────────────────────
        send({ phase: "compose" });
        const { scriptResult, variantA, variantB } = await generateOutreachScript(
          profile,
          senderBrief,
          pipelineInput,
          { recentActivity, companyContext },
          emitter,
        );

        // ── Step 4: Review ──────────────────────────────────────────────
        const { passed } = reviewScript(scriptResult, profile, emitter);

        // ── Step 5: Optional Auto-Render ────────────────────────────────
        let videoUrl: string | undefined;
        let videoId: string | undefined;

        if (pipelineInput.autoRender && passed) {
          try {
            const renderCost = estimateCreditCost("video.render");
            const renderReservation = await reserveCredits({
              subject,
              action: "video.render",
              amount: renderCost,
              reason: "Pipeline: render personalized video",
              provider: "heygen",
            });

            const renderResult = await renderVideo(
              scriptResult.script,
              profile,
              pipelineInput.customization,
              emitter,
            );
            videoUrl = renderResult.videoUrl;
            videoId = renderResult.videoId;
            await commitCreditReservation(renderReservation.id);
          } catch (renderError) {
            emitter.error("producer", `Render failed: ${renderError instanceof Error ? renderError.message : "unknown"}`);
          }
        }

        // ── Done ────────────────────────────────────────────────────────
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
          recentActivityPosts,
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
        } else if (error instanceof Error && error.message.includes("Could not access profile")) {
          send({ error: error.message });
        } else if (error instanceof Error && error.message.includes("Could not identify a person")) {
          send({ error: error.message });
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
