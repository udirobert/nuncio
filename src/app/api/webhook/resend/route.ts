/**
 * Resend inbound webhook — receives `email.received` events when prospects
 * reply to outreach emails. Verifies the Svix signature, fetches the email
 * body, and classifies the reply intent using the same LLM fallback chain
 * as the agent reply-webhook.
 *
 * POST /api/webhook/resend
 *   Headers: svix-id, svix-timestamp, svix-signature
 *   Body: { type: "email.received", data: { email_id, from, subject, ... } }
 *
 * This endpoint does NOT require NUNCIO_AGENT_TOKEN — it authenticates via
 * Svix webhook signature verification using RESEND_WEBHOOK_SECRET.
 *
 * Requires:
 * - RESEND_API_KEY — to fetch email body via resend.emails.receiving.get()
 * - RESEND_WEBHOOK_SECRET — to verify Svix signature
 */

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";

type ReplyIntent = "interested" | "not_now" | "unsubscribe" | "question" | "unknown";

const SYSTEM_PROMPT = `You are an SDR reply classifier. Classify the prospect's email reply into exactly one category:

- "interested" — prospect wants to learn more, schedule a call, or see a demo
- "not_now" — prospect is polite but deferring ("maybe later", "too busy right now", "reach out next quarter")
- "unsubscribe" — prospect explicitly asks to stop receiving emails
- "question" — prospect asks a specific question about the product/service
- "unknown" — cannot determine intent or irrelevant

Respond with ONLY a JSON object: {"intent": "<category>", "reason": "<one sentence>"}`;

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!webhookSecret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  if (!resendApiKey) {
    console.error("[resend-webhook] RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Resend API key not configured" }, { status: 503 });
  }

  // Verify Svix signature
  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[resend-webhook] Missing Svix headers");
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  let event: { type: string; data: { email_id: string; from: string; subject: string; message_id?: string } };

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    }) as typeof event;
  } catch (err) {
    console.error("[resend-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`[resend-webhook] Received event: ${event.type} from ${event.data.from}`);

  if (event.type !== "email.received") {
    console.log(`[resend-webhook] Ignoring event type: ${event.type}`);
    return NextResponse.json({ received: true });
  }

  try {
    // Fetch the email body — Resend webhooks only include metadata
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);
    const { data: email, error } = await resend.emails.receiving.get(event.data.email_id);

    if (error || !email) {
      console.error("[resend-webhook] Failed to fetch email body:", error);
      return NextResponse.json({ error: "Failed to fetch email" }, { status: 500 });
    }

    const replyBody = email.text || email.html || "";
    const from = event.data.from;
    const subject = event.data.subject || "(no subject)";
    const messageId = event.data.message_id;

    console.log(`[resend-webhook] Classifying reply from ${from}: "${subject}" (${replyBody.length} chars)`);

    // Classify intent via LLM
    let intent: ReplyIntent = "unknown";
    let reason = "";

    try {
      const userMessage = `From: ${from}\nSubject: ${subject}\n\n${replyBody.slice(0, 2000)}`;
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

    // Forward to the reply-webhook endpoint so the agent can poll for replies.
    // The reply-webhook stores replies in-memory and the agent polls
    // GET /api/agent/reply-webhook?intent=interested to discover them.
    const agentToken = process.env.NUNCIO_AGENT_TOKEN;
    if (agentToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const internalResponse = await fetch(`${appUrl}/api/agent/reply-webhook`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${agentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          subject,
          text: replyBody,
          inReplyTo: messageId,
        }),
      });

      if (internalResponse.ok) {
        const result = await internalResponse.json();
        console.log(`[resend-webhook] Forwarded to reply-webhook: replyId=${result.replyId}, intent=${result.intent}`);
        return NextResponse.json({
          received: true,
          replyId: result.replyId,
          intent: result.intent,
          suggestedAction: result.suggestedAction,
        });
      }
    }

    // Fallback: return the classification directly
    const suggestedAction = {
      interested: "propose_meeting",
      not_now: "schedule_follow_up",
      unsubscribe: "remove_from_list",
      question: "answer_and_engage",
      unknown: "review_manually",
    }[intent];

    console.log(`[resend-webhook] Classified (fallback): intent=${intent}, action=${suggestedAction}`);

    return NextResponse.json({
      received: true,
      from,
      subject,
      intent,
      reason,
      suggestedAction,
    });
  } catch (error) {
    console.error("[resend-webhook] Error processing event:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
