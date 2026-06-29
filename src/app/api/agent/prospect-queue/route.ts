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
  type PipelineInput,
} from "@/lib/pipeline/steps";
import { getShareStorageProvider } from "@/lib/storage";

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

  try {
    const body = await request.json();
    const { url } = body;
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const senderBrief = cleanOptionalString(body.senderBrief);
    const senderName = cleanOptionalString(body.senderName);
    const senderProfile = buildSenderProfile(body);
    const outreachIntent = buildOutreachIntent(body);
    const autoRender = body.autoRender !== false; // default true for agent mode
    const researchTier = body.researchTier as "quick" | "balanced" | "deep" | undefined;

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
    }).catch((err) => {
      console.error(`[agent-queue] ${id} unhandled:`, err);
    });

    return NextResponse.json({ queueId: id, status: "queued" });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
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
    const { profile, recentActivity, companyContext } = research;

    // Step 3: Generate Script
    const { scriptResult } = await generateOutreachScript(
      profile,
      input.senderBrief,
      input,
      { recentActivity, companyContext },
    );

    // Step 4: Review
    const { passed } = reviewScript(scriptResult, profile);

    // Step 5: Render (if autoRender enabled)
    // For the autonomous agent, render regardless of review issues —
    // the review is advisory, not blocking, in agent mode.
    let videoUrl: string | undefined;
    let videoId: string | undefined;

    if (input.autoRender) {
      const renderResult = await renderVideo(scriptResult.script, profile, input.customization);
      videoUrl = renderResult.videoUrl;
      videoId = renderResult.videoId;
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

    entry.status = "completed";
    entry.completedAt = new Date().toISOString();
    entry.result = {
      profile,
      script: scriptResult.script,
      videoUrl,
      videoId,
      shareId: share.id,
      vibeId: scriptResult.vibeId,
    };
  } catch (error) {
    entry.status = "failed";
    entry.completedAt = new Date().toISOString();
    entry.error = error instanceof Error ? error.message : "Unknown error";

    if (reservation) {
      await refundCreditReservation(reservation.id, entry.error).catch(() => {});
    }
  }
}
