import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";

const CAMPAIGN_EXTRACTION_PROMPT = `You are a structured data extractor for a video outreach tool called nuncio.

Given a conversation transcript between a user and a voice agent, extract the following fields:
- name: Recipient's full name
- company: Recipient's company/organization
- role: Recipient's role/title
- url: Profile URL (LinkedIn, Twitter, etc.) if mentioned
- senderName: The user's own name
- senderBrief: Why they are reaching out (the pitch/context in 1-2 sentences)
- archetype: Best hook type — one of: "auto", "mirror", "origin", "future_cast", "inside_joke", "day_in_the_life"
- tone: One of: "conversational", "formal", "technical"

Also extract the user's sender playbook if they mention it:
- offer: What the sender can offer in this conversation (e.g. a demo, an intro, a specific insight)
- wants: What the sender wants from the conversation (e.g. a meeting, feedback, a referral)
- wiggleRoom: Where the sender has flexibility (price, time, scope, etc.)
- constraints: Array of hard limits the agent must not cross (return as a JSON array of strings)

Rules:
- Extract ONLY what was explicitly stated. Do not infer or make up information.
- For archetype, pick the best match based on the outreach reason. Default to "auto" if unclear.
- For tone, default to "conversational" if not specified.
- Return valid JSON only. No markdown, no explanation.

Return format:
{"name":"","company":"","role":"","url":"","senderName":"","senderBrief":"","archetype":"auto","tone":"conversational","offer":"","wants":"","wiggleRoom":"","constraints":[]}`;

const PLAYBOOK_EXTRACTION_PROMPT = `You are a structured data extractor for a conversational SDR tool called nuncio.

Given a conversation transcript between a user and a voice agent, extract the sender's reusable playbook and identity. This is about the sender (the user), not the recipient.

Extract the following fields:
- senderName: The user's own name (how they sign off)
- senderBusiness: What they sell or build (1 sentence)
- senderBrand: How they want to come across (e.g. "sharp but friendly", "technical founder", "warm advisor")
- senderAudience: Who their ideal buyer is (1 sentence)
- senderOffer: The concrete value they can offer a recipient
- senderProofPoints: Array of evidence or trust signals (return as a JSON array of strings; e.g. ["YC S24", "used by 50+ teams"])
- offer: What they can offer in a live conversation (e.g. a demo, an intro, a specific insight)
- wants: What they want from the conversation (e.g. a meeting, feedback, a referral)
- wiggleRoom: Where they have flexibility (price, time, scope, etc.)
- constraints: Array of hard limits the agent must not cross (return as a JSON array of strings; e.g. ["never mention competitors by name"])
- bookingUrl: Calendar/booking URL if mentioned

Rules:
- Extract ONLY what was explicitly stated. Do not invent facts.
- If the user did not mention a field, return an empty string or empty array as appropriate.
- Return valid JSON only. No markdown, no explanation.

Return format:
{"senderName":"","senderBusiness":"","senderBrand":"","senderAudience":"","senderOffer":"","senderProofPoints":[],"offer":"","wants":"","wiggleRoom":"","constraints":[],"bookingUrl":""}`;

export async function POST(request: NextRequest) {
  try {
    const { transcript, linkUrl, mode } = await request.json();

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
    const prompt = mode === "playbook" ? PLAYBOOK_EXTRACTION_PROMPT : CAMPAIGN_EXTRACTION_PROMPT;

    const raw = await chatCompletion(prompt, userMessage, {
      maxTokens: 768,
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
