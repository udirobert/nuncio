import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";

const EXTRACTION_PROMPT = `You are a structured data extractor for a video outreach tool called nuncio.

Given a conversation transcript between a user and a voice agent, extract the following fields:
- name: Recipient's full name
- company: Recipient's company/organization
- role: Recipient's role/title
- url: Profile URL (LinkedIn, Twitter, etc.) if mentioned
- senderName: The user's own name
- senderBrief: Why they are reaching out (the pitch/context in 1-2 sentences)
- archetype: Best hook type — one of: "auto", "mirror", "origin", "future_cast", "inside_joke", "day_in_the_life"
- tone: One of: "conversational", "formal", "technical"

Rules:
- Extract ONLY what was explicitly stated. Do not infer or make up information.
- For archetype, pick the best match based on the outreach reason. Default to "auto" if unclear.
- For tone, default to "conversational" if not specified.
- Return valid JSON only. No markdown, no explanation.

Return format:
{"name":"...","company":"...","role":"...","url":"...","senderName":"...","senderBrief":"...","archetype":"...","tone":"..."}`;

export async function POST(request: NextRequest) {
  try {
    const { transcript, linkUrl } = await request.json();

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: "transcript is required (array of {role, text})" },
        { status: 400 }
      );
    }

    const conversationText = transcript
      .map((t: { role: string; text: string }) => `${t.role === "user" ? "User" : "Agent"}: ${t.text}`)
      .join("\n");

    const userMessage = `Transcript:\n${conversationText}\n\nExtract the structured profile from this conversation.`;

    const raw = await chatCompletion(EXTRACTION_PROMPT, userMessage, {
      maxTokens: 512,
    });

    // Parse the JSON response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to extract profile from conversation" },
        { status: 500 }
      );
    }

    const profile = JSON.parse(jsonMatch[0]);

    // Merge in the manually provided link URL if the agent didn't capture one
    if (linkUrl && (!profile.url || profile.url.trim() === "")) {
      profile.url = linkUrl;
    }

    return NextResponse.json(profile);
  } catch (err) {
    console.error("[voice/extract] Error:", err);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
