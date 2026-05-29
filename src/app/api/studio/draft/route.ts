import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";

const CHANNEL_GUIDELINES: Record<string, string> = {
  email: "Write a short email (subject line + 2-3 sentence body). Professional but warm. Include a clear CTA to watch the video.",
  linkedin: "Write a LinkedIn DM. Keep it under 300 characters. Casual-professional tone. Reference something specific about the recipient.",
  twitter: "Write a tweet or Twitter DM. Max 280 characters for tweet, slightly longer for DM. Punchy, no fluff.",
  whatsapp: "Write a WhatsApp message. Very casual, 1-2 sentences max. Like texting a colleague.",
};

export async function POST(request: NextRequest) {
  try {
    const { channel, recipientName, senderName, script, recentActivity } = await request.json();

    if (!channel || !recipientName) {
      return NextResponse.json({ error: "channel and recipientName required" }, { status: 400 });
    }

    const guidelines = CHANNEL_GUIDELINES[channel] || CHANNEL_GUIDELINES.email;

    const systemPrompt = `You draft short outreach messages to accompany personalised videos. Write ONLY the message — no preamble, no quotes, no explanation. The message should feel human (not templated), create curiosity about the video without spoiling it, reference something specific to the recipient, and be ready to copy-paste as-is.`;

    const userMessage = `Draft a ${channel} message for:
- Recipient: ${recipientName}
- Sender: ${senderName || "the sender"}
- Video script summary: ${script ? script.slice(0, 300) : "A personalised video message"}
${recentActivity ? `- Recipient's recent activity: ${recentActivity.slice(0, 400)}` : ""}

GUIDELINES: ${guidelines}
${channel === "email" ? "\nFormat as:\nSubject: [subject line]\n\n[body]" : ""}`;

    const draft = await chatCompletion(systemPrompt, userMessage, { maxTokens: 300 });

    return NextResponse.json({ draft, channel });
  } catch (err) {
    console.error("[studio/draft] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 }
    );
  }
}
