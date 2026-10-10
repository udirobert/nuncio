/**
 * Agent prospect-queue endpoint — the autonomous agent's main entry point.
 *
 * POST /api/agent/prospect-queue
 *   Enqueue a prospect for end-to-end processing (research → script → render).
 *   Returns immediately with a queueId for polling.
 *
 * GET /api/agent/prospect-queue/:id
 *   Poll prospect processing status.
 *
 * Uses the shared pipeline step functions (src/lib/pipeline/steps.ts) —
 * same code path as the studio pipeline route. DRY.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import {
  checkPre,
  consumeApprovalGrant,
  requestApproval,
} from "@/lib/governance/service";
import {
  reserveCredits,
  commitCreditReservation,
  refundCreditReservation,
  estimateCreditCost,
} from "@/lib/billing/credits";
import {
  buildSenderProfile,
  buildOutreachIntent,
  cleanOptionalString,
  researchAndSynthesize,
  generateOutreachScript,
  reviewScript,
  renderVideo,
  generateMediaAssets,
  type PipelineInput,
} from "@/lib/pipeline/steps";
import { chooseArchetype } from "@/lib/hooks/select";
import { getShareStorageProvider } from "@/lib/storage";
import { mark, traced } from "@/lib/neatlogs";

// ── In-memory queue (same pattern as batch processor) ─────────────────

interface QueueEntry {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  prospectUrl: string;
  senderBrief?: string;
  senderName?: string;
  result?: {
    profile?: import("@/lib/claude").Profile;
    script?: string;
    videoUrl?: string;
    videoId?: string;
    shareId?: string;
    vibeId?: string;
    researchQuality?: import("@/lib/pipeline/steps").ResearchQuality;
    needsReview?: boolean;
    mediaAssets?: {
      usedGenblaze: boolean;
      providers?: string[];
      thumbnailUrl?: string;
      soundscapeUrl?: string;
      manifestUri?: string;
    };
  };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const queue = new Map<string, QueueEntry>();

// ── POST: Enqueue ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return traced(
    { name: "hermes.enqueue", kind: "WORKFLOW", endUserId: auth.workspaceId },
    async (span) => {
  try {
    const body = await request.json();
    const { url } = body;
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Governance pre-hook on the queue call itself (domain denylist, audit).
    const subject = { class: "agent" as const, workspaceId: auth.workspaceId };
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
    }
    span.setAttribute("nuncio.prospect.host", host);
    const queuePre = await checkPre(subject, "agent.prospect-queue", { host });
    span.setAttribute("nuncio.governance.queue_decision", queuePre.decision);
    if (queuePre.decision === "deny") {
      span.setAttribute("nuncio.outcome", "denied");
      await mark("nuncio.governance.denied");
      return NextResponse.json({ error: queuePre.reason || "Denied by policy" }, { status: 403 });
    }

    const senderBrief = cleanOptionalString(body.senderBrief);
    const senderName = cleanOptionalString(body.senderName);
    const senderProfile = buildSenderProfile(body);
    const outreachIntent = buildOutreachIntent(body);
    const autoRender = body.autoRender !== false; // default true for agent mode
    const researchTier = body.researchTier as "quick" | "balanced" | "deep" | undefined;

    // Auto-render is a separately governed action: policy can deny it or
    // require a human approval. A grant token (single-use, bound to this
    // url) satisfies the requirement on retry.
    if (autoRender) {
      const grantToken = request.headers.get("x-nuncio-approval-grant")?.trim();
      const renderPayload = { url };
      if (grantToken) {
        const consumed = await consumeApprovalGrant(grantToken, "agent.render", renderPayload);
        if (!consumed.ok) {
          return NextResponse.json({ error: consumed.error }, { status: 403 });
        }
      } else {
        const renderPre = await checkPre(subject, "agent.render", { autoRender: true });
        span.setAttribute("nuncio.governance.render_decision", renderPre.decision);
        if (renderPre.decision === "deny") {
          span.setAttribute("nuncio.outcome", "denied");
          await mark("nuncio.governance.denied");
          return NextResponse.json(
            { error: renderPre.reason || "Denied by policy" },
            { status: 403 },
          );
        }
        if (renderPre.decision === "require_approval") {
          const req = await requestApproval({
            subject,
            tool: "agent.render",
            payload: renderPayload,
            summary:
              `Auto-render video for prospect ${host} ` +
              `(workspace ${auth.workspaceId})`,
            estimatedCredits: estimateCreditCost("video.render"),
            callbackUrl: request.headers.get("x-nuncio-approval-callback") ?? undefined,
          });
          if (!req.ok) {
            return NextResponse.json({ error: req.error }, { status: req.status });
          }
          const approval = req.approval;
          span.setAttribute("nuncio.outcome", "pending_approval");
          span.setAttribute("nuncio.approval.id", approval.id);
          await mark("nuncio.governance.pending_approval");
          return NextResponse.json(
            {
              status: "pending_approval",
              approvalId: approval.id,
              deduplicated: req.deduplicated,
              reason: renderPre.reason,
              retry:
                "Once approved, POST the same body again with header x-nuncio-approval-grant: <token>",
              callback:
                "Send x-nuncio-approval-callback: <url> on this request to have the grant POSTed to you on approval",
              approvalStatusUrl: `/api/agent/approvals?id=${approval.id}`,
            },
            { status: 202 },
          );
        }
      }
    }

    const id = crypto.randomUUID().slice(0, 12);
    const entry: QueueEntry = {
      id,
      status: "queued",
      prospectUrl: url,
      senderBrief,
      senderName,
      createdAt: new Date().toISOString(),
    };
    queue.set(id, entry);

    // Fire-and-forget async processing
    // Agent mode runs at studio tier with deep research enabled so that
    // Firecrawl/EXA providers load — the autonomous agent needs the richest
    // research data to craft quality outreach without human intervention.
    const agentTier = (body.userTier as "trial" | "free" | "pro" | "studio") || "studio";
    const deepResearch = body.deepResearchEnabled !== false; // default true for agent

    processQueueEntry(id, auth.subject, {
      url,
      senderBrief,
      senderName,
      senderProfile,
      outreachIntent,
      researchTier: researchTier || "deep",
      deepResearchEnabled: deepResearch,
      userTier: agentTier,
      autoRender,
      customization: body.customization,
      archetype: body.archetype,
      scriptVariants: false,
      governanceSubject: subject,
    }).catch((err) => {
      console.error(`[agent-queue] ${id} unhandled:`, err);
    });

    span.setAttribute("nuncio.outcome", "queued");
    span.setAttribute("nuncio.queue.id", id);
    return NextResponse.json({ queueId: id, status: "queued" });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
  });
}

// ── GET: Poll status ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    // List all queue entries
    const entries = Array.from(queue.values()).map((e) => ({
      id: e.id,
      status: e.status,
      prospectUrl: e.prospectUrl,
      createdAt: e.createdAt,
      completedAt: e.completedAt,
      error: e.error,
    }));
    return NextResponse.json({ queue: entries });
  }

  const entry = queue.get(id);
  if (!entry) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}

// ── Async processing ──────────────────────────────────────────────────

async function processQueueEntry(
  id: string,
  subject: import("@/lib/billing/credits").CreditSubject,
  input: PipelineInput,
) {
  const entry = queue.get(id);
  if (!entry) return;

  await traced(
    {
      name: "hermes.prospect_run",
      kind: "WORKFLOW",
      sessionId: id,
      endUserId: subject.workspaceId,
      input: { url: input.url, autoRender: input.autoRender, researchTier: input.researchTier },
    },
    async (span) => {
  span.setAttribute("nuncio.queue.id", id);
  span.setAttribute("nuncio.channel", "hermes");
  span.setAttribute("nuncio.prospect.host", (() => { try { return new URL(input.url).hostname; } catch { return "invalid"; } })());

  entry.status = "processing";
  entry.startedAt = new Date().toISOString();

  let reservation: { id: string } | undefined;

  try {
    // Reserve credits
    const researchCost = estimateCreditCost("profile.research");
    const scriptCost = estimateCreditCost("script.generate");
    const renderCost = input.autoRender ? estimateCreditCost("video.render") : 0;
    const totalCost = researchCost + scriptCost + renderCost;

    reservation = await reserveCredits({
      subject,
      action: "script.generate",
      amount: totalCost,
      reason: `Agent queue: ${input.url}`,
      provider: "tinyfish+llm+heygen",
    });

    // Steps 1+2: Research & Synthesize
    const research = await researchAndSynthesize(input);
    const { profile, recentActivity, companyContext, researchQuality } = research;
    span.setAttribute("nuncio.research.confidence", researchQuality?.confidence || "unknown");

    // Step 3: Generate Script
    const { scriptResult } = await generateOutreachScript(
      profile,
      input.senderBrief,
      input,
      { recentActivity, companyContext },
    );

    // Step 4: Review (advisory in agent mode — doesn't gate rendering)
    await reviewScript(scriptResult, profile);

    // Step 5: Render (if autoRender enabled)
    // For the autonomous agent, render regardless of review issues —
    // the review is advisory, not blocking, in agent mode.
    // However, if research quality is low, skip auto-render and flag for
    // human review (hybrid mode) — don't burn a HeyGen credit on a
    // low-confidence profile.
    let videoUrl: string | undefined;
    let videoId: string | undefined;
    let mediaAssets: import("@/lib/pipeline/steps").MediaAssets | undefined;
    const lowConfidence = researchQuality?.confidence === "low";
    if (input.autoRender && lowConfidence) {
      span.setAttribute("nuncio.auto_render.blocked_low_confidence", true);
      await mark("nuncio.guardrail.low_confidence.blocked");
    }

    // Pre-generate shareId so media assets can be grouped under it
    // before the ShareRecord is created.
    const shareId = crypto.randomUUID();

    if (input.autoRender && !lowConfidence) {
      const renderResult = await renderVideo(scriptResult.script, profile, input.customization);
      videoUrl = renderResult.videoUrl;
      videoId = renderResult.videoId;

      // Step 6: Generate media assets via Genblaze composite pipeline + persist to B2
      // Same shared step as the studio pipeline — DRY. Generates thumbnail,
      // soundscape, and narration via Genblaze, persists all assets to B2 with
      // provenance manifests. Non-blocking: failures don't invalidate the video.
      try {
        const hookChoice = chooseArchetype(profile, input.senderBrief);
        const soundscapePrompt = `Ambient professional soundscape for: ${hookChoice.archetype.label}. Subtle, non-distracting, high quality.`;

        mediaAssets = await generateMediaAssets(
          videoUrl,
          scriptResult.script,
          profile,
          shareId,
          hookChoice.concept,
          soundscapePrompt,
        );
        if (mediaAssets.videoUrl) videoUrl = mediaAssets.videoUrl;
      } catch (mediaError) {
        span.setAttribute("nuncio.media.failed", true);
        await mark("nuncio.media.failed", "TOOL");
        console.warn("[agent-queue] Media asset generation failed:", mediaError);
      }
    }

    // Persist as ShareRecord
    const shareProvider = getShareStorageProvider();
    const share = await shareProvider.create({
      videoUrl,
      videoId,
      recipientName: profile.name,
      senderName: input.senderName,
      workspaceId: subject.workspaceId,
      profile,
      videoStyle: "agent",
      language: profile.language,
    });

    await commitCreditReservation(reservation.id);

    span.setAttribute("nuncio.outcome", videoUrl ? "completed_with_video" : "completed");
    span.setAttribute("nuncio.share.id", share.id);
    if (lowConfidence) span.setAttribute("nuncio.needs_review", true);

    entry.status = "completed";
    entry.completedAt = new Date().toISOString();
    entry.result = {
      profile,
      script: scriptResult.script,
      videoUrl,
      videoId,
      shareId: share.id,
      vibeId: scriptResult.vibeId,
      researchQuality,
      needsReview: lowConfidence,
      mediaAssets: mediaAssets ? {
        usedGenblaze: mediaAssets.usedGenblaze,
        providers: mediaAssets.genblazeProviders,
        thumbnailUrl: mediaAssets.thumbnailUrl,
        soundscapeUrl: mediaAssets.soundscapeUrl,
        manifestUri: mediaAssets.manifestUri,
      } : undefined,
    };
  } catch (error) {
    entry.status = "failed";
    entry.completedAt = new Date().toISOString();
    entry.error = error instanceof Error ? error.message : "Unknown error";
    span.setAttribute("nuncio.outcome", "failed");
    span.setAttribute("nuncio.error", entry.error);

    if (reservation) {
      await refundCreditReservation(reservation.id, entry.error).catch(() => {});
    }
  }
  });
}
