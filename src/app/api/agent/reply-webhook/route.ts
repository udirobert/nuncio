/**
 * Agent reply-webhook endpoint — receives email replies from prospects
 * and classifies their intent using the existing LLM fallback chain.
 *
 * POST /api/agent/reply-webhook
 *   Body: { from, subject, body, inReplyTo? }
 *   Returns: { replyId, intent, suggestedAction }
 *
 * Intents: "interested" | "not_now" | "unsubscribe" | "question" | "unknown"
 *
 * Uses chatCompletion() from src/lib/llm.ts — same LLM fallback chain
 * as the rest of the app. DRY.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAgentRequest } from "@/lib/agent-auth";
import { chatCompletion } from "@/lib/llm";
import { getShareStorageProvider } from "@/lib/storage";

type ReplyIntent = "interested" | "not_now" | "unsubscribe" | "question" | "unknown";

interface ReplyRecord {
  id: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  intent: ReplyIntent;
  shareId?: string;
  createdAt: string;
}

// In-memory reply log (same pattern as prospect-queue)
const replies = new Map<string, ReplyRecord>();

const SYSTEM_PROMPT = `You are an SDR reply classifier. Classify the prospect's email reply into exactly one category:

- "interested" — prospect wants to learn more, schedule a call, or see a demo
- "not_now" — prospect is polite but deferring ("maybe later", "too busy right now", "reach out next quarter")
- "unsubscribe" — prospect explicitly asks to stop receiving emails
- "question" — prospect asks a specific question about the product/service
- "unknown" — cannot determine intent or irrelevant

Respond with ONLY a JSON object: {"intent": "<category>", "reason": "<one sentence>"}`;

export async function POST(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { from, subject, text, inReplyTo } = body;

    if (!from || (!text && !body.body)) {
      return NextResponse.json(
        { error: "from and text (or body) are required" },
        { status: 400 },
      );
    }

    const replyBody = text || body.body;
    const replyId = crypto.randomUUID().slice(0, 12);

    // Classify intent via LLM
    let intent: ReplyIntent = "unknown";
    let reason = "";

    try {
      const userMessage = `From: ${from}\nSubject: ${subject || "(no subject)"}\n\n${replyBody.slice(0, 2000)}`;
      const response = await chatCompletion(SYSTEM_PROMPT, userMessage, { maxTokens: 100 });

      const parsed = JSON.parse(response.trim().replace(/^```json?\n?|\n?```$/g, ""));
      if (parsed.intent && ["interested", "not_now", "unsubscribe", "question", "unknown"].includes(parsed.intent)) {
        intent = parsed.intent;
        reason = parsed.reason || "";
      }
    } catch {
      // LLM classification failed — heuristic fallback
      const lower = replyBody.toLowerCase();
      if (lower.includes("unsubscribe") || lower.includes("stop emailing") || lower.includes("remove me")) {
        intent = "unsubscribe";
      } else if (lower.includes("yes") || lower.includes("interested") || lower.includes("call") || lower.includes("meeting") || lower.includes("demo")) {
        intent = "interested";
      } else if (lower.includes("later") || lower.includes("busy") || lower.includes("not now") || lower.includes("next quarter")) {
        intent = "not_now";
      } else if (replyBody.includes("?")) {
        intent = "question";
      }
    }

    // Try to link to original share record
    let shareId: string | undefined;
    if (inReplyTo) {
      try {
        const shareProvider = getShareStorageProvider();
        const share = await shareProvider.get(inReplyTo);
        if (share) shareId = share.id;
      } catch { /* not critical */ }
    }

    const record: ReplyRecord = {
      id: replyId,
      from,
      subject: subject || "(no subject)",
      body: replyBody,
      inReplyTo,
      intent,
      shareId,
      createdAt: new Date().toISOString(),
    };
    replies.set(replyId, record);

    const suggestedAction = {
      interested: "propose_meeting",
      not_now: "schedule_follow_up",
      unsubscribe: "remove_from_list",
      question: "answer_and_engage",
      unknown: "review_manually",
    }[intent];

    return NextResponse.json({ replyId, intent, reason, suggestedAction, shareId });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

// ── GET: List replies (for agent polling) ─────────────────────────────

export async function GET(request: NextRequest) {
  const auth = validateAgentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const intent = request.nextUrl.searchParams.get("intent");
  let entries = Array.from(replies.values());
  if (intent) {
    entries = entries.filter((r) => r.intent === intent);
  }

  return NextResponse.json({
    replies: entries.map((r) => ({
      id: r.id,
      from: r.from,
      subject: r.subject,
      intent: r.intent,
      shareId: r.shareId,
      createdAt: r.createdAt,
    })),
  });
}
