import { NextRequest, NextResponse } from "next/server";
import { captureServerEvent, mcpDistinctId } from "@/lib/analytics-server";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { applyPost, checkPre, subjectForRequest } from "@/lib/governance/service";
import { TinyFishApiError } from "@/lib/tinyfish";
import { chatCompletion } from "@/lib/llm";
import {
  buildOutreachIntent,
  buildSenderProfile,
  cleanOptionalString,
  generateOutreachScript,
  researchAndSynthesize,
  reviewScript,
  type PipelineInput,
} from "@/lib/pipeline/steps";

export const runtime = "nodejs";

/**
 * Free ChatGPT / MCP tool — `research_and_draft`.
 *
 * Wraps the same quick-tier research + script path as /api/agent/lite, then
 * optionally drafts a channel-ready first message (studio/draft shape).
 * No render, no livelink, no in-plugin checkout.
 *
 *   curl -X POST http://localhost:3000/api/mcp/research-and-draft \
 *     -H 'content-type: application/json' \
 *     -d '{"url":"https://linkedin.com/in/example","channel":"linkedin","senderName":"Alex"}'
 */

const MAX_URL_LENGTH = 2048;
const MAX_BRIEF_LENGTH = 4000;
const PRODUCT_URL = "https://nuncio.persidian.com";
const PLANS_URL = "https://nuncio.persidian.com/pricing";

const CHANNEL_GUIDELINES: Record<string, string> = {
  email:
    "Write a short email (subject line + 2-3 sentence body). Professional but warm. Include a clear CTA to open a personal first-touch link — the sender's AI twin can answer questions on the other side.",
  linkedin:
    "Write a LinkedIn DM. Keep it under 300 characters. Casual-professional tone. Reference something specific about the recipient.",
  twitter:
    "Write a tweet or Twitter DM. Max 280 characters for tweet, slightly longer for DM. Punchy, no fluff.",
  whatsapp:
    "Write a WhatsApp message. Very casual, 1-2 sentences max. Like texting a colleague.",
};

const DEMO_RESULT = {
  ok: true,
  tool: "nuncio.research-and-draft",
  demo: true,
  summary:
    "Demo prospect Jordan Lee (Head of Growth at Northwind) — draft ready for LinkedIn. Labelled sample; live research skipped.",
  profile: {
    name: "Jordan Lee",
    title: "Head of Growth",
    company: "Northwind",
    summary: "Scaled PLG motion; posts about outbound experiments and AI SDR tooling.",
  },
  script:
    "Hey Jordan — saw your note on testing AI-assisted first touches. I put together a short personal intro from my twin that reacts to your recent Growth Unhinged thread. Open the link when you have a minute?",
  draft:
    "Hey Jordan — loved your take on AI-assisted first touches. I recorded a short personal intro that reacts to your Growth Unhinged thread — mind if I send the link?",
  channel: "linkedin",
  upgrade: {
    message:
      "Turn this draft into a personalized video or live avatar session on nuncio (existing account / product site — not in-plugin checkout).",
    url: PRODUCT_URL,
    plansUrl: PLANS_URL,
  },
};

async function draftChannelMessage(input: {
  channel: string;
  recipientName: string;
  senderName?: string;
  script: string;
  recentActivity?: string;
}): Promise<string> {
  const guidelines = CHANNEL_GUIDELINES[input.channel] || CHANNEL_GUIDELINES.email;
  const systemPrompt =
    "You draft short outreach messages to accompany a personal first-touch link. Write ONLY the message — no preamble, no quotes, no explanation. The message should feel human, create curiosity about the link without spoiling it, reference something specific to the recipient, and be ready to copy-paste as-is.";
  const userMessage = `Draft a ${input.channel} message for:
- Recipient: ${input.recipientName}
- Sender: ${input.senderName || "the sender"}
- Twin's talking points: ${input.script.slice(0, 300)}
${input.recentActivity ? `- Recipient's recent activity: ${input.recentActivity.slice(0, 400)}` : ""}

GUIDELINES: ${guidelines}
${input.channel === "email" ? "\nFormat as:\nSubject: [subject line]\n\n[body]" : ""}`;

  return chatCompletion(systemPrompt, userMessage, { maxTokens: 300 });
}

export async function GET() {
  return NextResponse.json({
    service: "nuncio-research-and-draft",
    tool: "research_and_draft",
    price: "free",
    usage:
      'POST { "url": "<prospect profile URL>", "senderBrief?": "...", "senderName?": "...", "channel?": "email|linkedin|twitter|whatsapp", "demo?": true }',
    limits: `${RATE_LIMITS.mcpResearchDraft.maxRequests} requests per ${RATE_LIMITS.mcpResearchDraft.windowSeconds / 3600}h per IP`,
    upgrade: {
      message: "Render or live-link this outreach on the product site with an existing account.",
      url: PRODUCT_URL,
      plansUrl: PLANS_URL,
    },
  });
}

export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  const limit = await checkRateLimit(
    clientId,
    "mcpResearchDraft",
    RATE_LIMITS.mcpResearchDraft,
  );
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

  if (body.demo === true) {
    const channel =
      typeof body.channel === "string" && body.channel in CHANNEL_GUIDELINES
        ? body.channel
        : "linkedin";
    captureServerEvent({
      distinctId: mcpDistinctId(request),
      event: "mcp_tool_call",
      properties: {
        tool: "research_and_draft",
        channel,
        demo: true,
        source: request.headers.get("x-nuncio-mcp-bridge") === "jsonrpc" ? "jsonrpc" : "rest",
      },
    });
    return NextResponse.json({ ...DEMO_RESULT, channel });
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

  // Governance pre-hook: the call, its arguments and the caller, before
  // anything executes. A denial's reason is policy text — show it verbatim.
  const subject = subjectForRequest(request);
  const pre = await checkPre(subject, "mcp.research_and_draft", { host: parsed.hostname });
  if (pre.decision === "deny") {
    return NextResponse.json({ error: pre.reason || "Denied by policy" }, { status: 403 });
  }

  const senderBrief = cleanOptionalString(body.senderBrief)?.slice(0, MAX_BRIEF_LENGTH);
  const senderName = cleanOptionalString(body.senderName);
  const channelRaw = cleanOptionalString(body.channel)?.toLowerCase() || "email";
  const channel = channelRaw in CHANNEL_GUIDELINES ? channelRaw : "email";

  // Usage scoreboard: one event per accepted call. The JSON-RPC stub proxies
  // through this route, so instrumenting here counts REST + MCP calls once.
  captureServerEvent({
    distinctId: mcpDistinctId(request),
    event: "mcp_tool_call",
    properties: {
      tool: "research_and_draft",
      channel,
      demo: false,
      source: request.headers.get("x-nuncio-mcp-bridge") === "jsonrpc" ? "jsonrpc" : "rest",
    },
  });

  const input: PipelineInput = {
    url,
    senderBrief,
    senderName,
    senderProfile: buildSenderProfile(body),
    outreachIntent: buildOutreachIntent(body),
    researchTier: "quick",
    deepResearchEnabled: false,
    userTier: "free",
    autoRender: false,
    scriptVariants: false,
    languageOverride: cleanOptionalString(body.languageOverride),
    governanceSubject: subject,
  };

  try {
    const { profile, recentActivity, companyContext, researchQuality } =
      await researchAndSynthesize(input);

    const { scriptResult } = await generateOutreachScript(profile, senderBrief, input, {
      recentActivity,
      companyContext,
    });

    const review = reviewScript(scriptResult, profile);
    const draft = await draftChannelMessage({
      channel,
      recipientName: profile.name || "there",
      senderName,
      script: scriptResult.script,
      recentActivity,
    });

    const summary =
      `${profile.name || "Prospect"}` +
      (profile.company ? ` at ${profile.company}` : "") +
      ` — researched (quick tier) and drafted a ${channel} first message. ` +
      `To render as video or open a live link, use an existing nuncio account at ${PRODUCT_URL} (not in-plugin checkout).`;

    // Governance post-hook: what may come back is policy, not the pipeline's
    // choice. Anonymous callers get contact identifiers stripped from the
    // payload (post.anonymous-contact-redaction).
    const { value: governedBody } = await applyPost(subject, "mcp.research_and_draft", {
      ok: true,
      tool: "nuncio.research-and-draft",
      summary,
      profile,
      script: scriptResult.script,
      vibeId: scriptResult.vibeId,
      draft,
      channel,
      review,
      researchQuality,
      upgrade: {
        message:
          "Turn this draft into a personalized video or live avatar session on nuncio (existing account / product site — not in-plugin checkout).",
        url: PRODUCT_URL,
        plansUrl: PLANS_URL,
      },
    });

    return NextResponse.json(governedBody);
  } catch (error) {
    if (error instanceof TinyFishApiError) {
      return NextResponse.json(
        { error: "Research provider unavailable", detail: error.message, kind: error.kind },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /could not (access|identify)/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
