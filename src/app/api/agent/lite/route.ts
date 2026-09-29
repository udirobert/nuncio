/**
 * Public "lite" agent endpoint — research + script only, no render, no auth.
 *
 * Built for the OpenClaw/Plow Agent Index distribution: any install of the
 * nuncio agent image can produce a researched first-touch draft without
 * holding a credential. Rate-limited per IP; renders still require
 * NUNCIO_AGENT_TOKEN via /api/agent/prospect-queue.
 *
 * Deliberately free and stateless — the funnel endpoint. Cost is bounded by
 * the per-IP rate limit and the "quick" research tier (single-provider
 * TinyFish, no deep research, no HeyGen).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { TinyFishApiError } from "@/lib/tinyfish";
import {
  buildOutreachIntent,
  buildSenderProfile,
  cleanOptionalString,
  generateOutreachScript,
  researchAndSynthesize,
  reviewScript,
  type PipelineInput,
} from "@/lib/pipeline/steps";

const MAX_URL_LENGTH = 2048;
const MAX_BRIEF_LENGTH = 4000;

export async function GET() {
  return NextResponse.json({
    service: "nuncio-lite",
    usage:
      'POST { "url": "<prospect profile URL>", "senderBrief?": "...", "senderName?": "..." } → { profile, script }',
    limits: `${RATE_LIMITS.agentLite.maxRequests} requests per ${RATE_LIMITS.agentLite.windowSeconds / 3600}h per IP`,
    upgrade:
      "Render this as a personalized video or live avatar session at https://nuncio.persidian.com",
  });
}

export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  const limit = await checkRateLimit(clientId, "agentLite", RATE_LIMITS.agentLite);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const url = cleanOptionalString(body.url);
  if (!url || url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "url must be http or https" }, { status: 400 });
  }

  const senderBrief = cleanOptionalString(body.senderBrief)?.slice(0, MAX_BRIEF_LENGTH);

  const input: PipelineInput = {
    url,
    senderBrief,
    senderName: cleanOptionalString(body.senderName),
    senderProfile: buildSenderProfile(body),
    outreachIntent: buildOutreachIntent(body),
    researchTier: "quick",
    deepResearchEnabled: false,
    userTier: "free",
    autoRender: false,
    scriptVariants: false,
    languageOverride: cleanOptionalString(body.languageOverride),
  };

  try {
    const { profile, recentActivity, companyContext, researchQuality } =
      await researchAndSynthesize(input);

    const { scriptResult } = await generateOutreachScript(profile, senderBrief, input, {
      recentActivity,
      companyContext,
    });

    const review = reviewScript(scriptResult, profile);

    return NextResponse.json({
      profile,
      script: scriptResult.script,
      vibeId: scriptResult.vibeId,
      review,
      researchQuality,
      upgrade: {
        message: "Render this outreach as a personalized video or live avatar session",
        url: "https://nuncio.persidian.com",
      },
    });
  } catch (error) {
    if (error instanceof TinyFishApiError) {
      return NextResponse.json(
        { error: "Research provider unavailable", detail: error.message, kind: error.kind },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    // Profile access / identification failures are client-fixable input problems.
    const status = /could not (access|identify)/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
