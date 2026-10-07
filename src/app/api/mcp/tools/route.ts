import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * MCP / ChatGPT plugin tool discovery for nuncio.
 *
 * Trigger phrase: "write my first message to this prospect"
 * Free wedge: research_and_draft (research + draft in-chat)
 * Paid follow-up: render / live link via existing account or product URL —
 * not in-plugin checkout.
 *
 *   curl -i https://nuncio.persidian.com/api/mcp/tools
 */

const researchAndDraftInput = {
  type: "object",
  description:
    "Research a public prospect profile and draft a first outreach message. Use when the user asks to write a first message, cold outreach opener, or first touch to a prospect. Do NOT use for video render, live avatar sessions, or sending email — those require the product site / an existing account.",
  properties: {
    url: {
      type: "string",
      description:
        "Public profile URL to research (LinkedIn, X/Twitter, personal site, company page).",
    },
    senderName: {
      type: "string",
      description: "Name of the person sending the outreach (optional).",
    },
    senderBrief: {
      type: "string",
      description:
        "Short context about the sender, offer, or why they are reaching out (optional).",
    },
    channel: {
      type: "string",
      enum: ["email", "linkedin", "twitter", "whatsapp"],
      description:
        "Delivery channel for the short copy-paste draft. Defaults to email.",
    },
    demo: {
      type: "boolean",
      description:
        "If true, skip live research and return a labelled sample draft (for directory review).",
    },
  },
  required: ["url"],
  examples: [
    {
      url: "https://linkedin.com/in/example",
      senderName: "Alex",
      senderBrief: "We help SDRs book demos with personalized video first-touches.",
      channel: "linkedin",
    },
    { demo: true, url: "https://example.com" },
  ],
} as const;

const researchAndDraftOutput = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    tool: { type: "string", const: "nuncio.research-and-draft" },
    summary: {
      type: "string",
      description: "Plain-text takeaway the calling agent can quote verbatim.",
    },
    profile: {
      type: "object",
      description: "Synthesised prospect profile (name, company, hooks).",
    },
    script: {
      type: "string",
      description: "Talking-points script for a first touch (AI twin / video).",
    },
    draft: {
      type: "string",
      description: "Channel-ready copy-paste first message.",
    },
    channel: { type: "string" },
    upgrade: {
      type: "object",
      description:
        "Informational next step only — render or live link on the product site / existing account. Never initiate checkout in-plugin.",
      properties: {
        message: { type: "string" },
        url: { type: "string" },
        plansUrl: { type: "string" },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nuncio",
    protocol: "mcp-http",
    triggerPhrase: "write my first message to this prospect",
    tools: [
      {
        name: "research_and_draft",
        title: "Research prospect and draft first message",
        description:
          "Use when the user wants to write a first message to a prospect, cold outreach opener, or personalized first touch. Researches a public profile URL and returns a channel-ready draft plus talking points. Free. Do not use for rendering video, starting a live avatar session, or sending messages — those live on nuncio.persidian.com with an existing account.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
        inputSchema: researchAndDraftInput,
        outputSchema: researchAndDraftOutput,
        endpoint: "POST /api/mcp/research-and-draft",
        price: "free",
      },
    ],
    paidFollowUp: {
      actions: ["video render", "live avatar / livelink"],
      where: "https://nuncio.persidian.com",
      note: "Existing account entitlements or informational plans page only — no in-plugin digital checkout.",
    },
  });
}
