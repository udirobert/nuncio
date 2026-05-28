import { chatCompletion } from "../llm";
import type { VoiceExtractedProfile, ConversationTurn } from "./types";

const SYSTEM_PROMPT = `You are the voice agent for nuncio — a personalised video outreach platform. Your job is to have a natural, warm conversation with the user and help them set up a video campaign.

Your goal is to gather the following information:
1. **Profile URL** — Where can we find the recipient? LinkedIn, Twitter/X, GitHub, etc.
2. **Recipient name** — Who are they reaching out to?
3. **Recipient company/role** — Where do they work, what do they do?
4. **Sender name** — The user's own name (how they sign off in the video)
5. **Brief** — Why are they reaching out? What's the context?
6. **Vibe/archetype** — What kind of hook works? (e.g. warm intro, investor pitch, conference followup, re-engage, founder-to-founder)
7. **Tone** — Formal, conversational, or technical?

Rules:
- Be warm, conversational, and efficient. Don't ask everything at once — ask natural follow-ups.
- Acknowledge what the user says before asking for more.
- When you have enough info (at least name + brief + url), tell the user you're ready and ask if they want to proceed.
- Keep responses short (2-3 sentences max per turn).
- Never be robotic or checklist-like. Sound like a helpful teammate.

OUTPUT FORMAT:
After the user's message, respond conversationally in plain text. Then append a machine-readable block:

---EXTRACT---
{"name":"...","company":"...","role":"...","url":"...","senderName":"...","senderBrief":"...","archetype":"...","tone":"...","isComplete":false,"missingFields":["url"],"lastAgentMessage":"..."}
---END---

The EXTRACT block must be valid JSON matching this schema:
{
  name: string (full name if known),
  company: string,
  role: string,
  url: string (the profile URL if known),
  senderName: string,
  senderBrief: string (what the outreach is about),
  archetype: string (one of: "auto", "mirror", "origin", "future_cast", "inside_joke", "day_in_the_life"),
  tone: string (one of: "conversational", "formal", "technical"),
  isComplete: boolean (true when you have enough to proceed),
  missingFields: string[] (fields still needed),
  lastAgentMessage: string (your conversational response, same as above)
}
`;

/**
 * Process a conversation turn in the voice agent.
 *
 * @param history - Full conversation history (accumulated across turns).
 * @param userTranscript - The latest user utterance text.
 * @returns Agent response text and extracted profile data.
 */
export async function processConversationTurn(
  history: ConversationTurn[],
  userTranscript: string
): Promise<{ agentResponse: string; extracted: VoiceExtractedProfile }> {
  // Build a compact conversation summary from history
  // We use the last N turns to keep context window manageable
  const recentTurns = history.slice(-6);
  const conversationLines = recentTurns
    .map((t) => `${t.role === "user" ? "User" : "Agent"}: ${t.text}`)
    .join("\n");

  const userMessage = `Previous conversation:\n${conversationLines}\n\nUser said: "${userTranscript}"\n\nAdd the latest information to your EXTRACT block. Respond naturally first, then include the EXTRACT block.`;

  const raw = await chatCompletion(SYSTEM_PROMPT, userMessage, {
    maxTokens: 1024,
  });

  const extractMatch = raw.match(
    /---EXTRACT---\s*(\{[\s\S]*?\})\s*---END---/
  );

  let extracted: VoiceExtractedProfile;
  let agentResponse: string;

  if (extractMatch) {
    try {
      extracted = JSON.parse(extractMatch[1]);
      agentResponse =
        extracted.lastAgentMessage ||
        raw.replace(/---EXTRACT---[\s\S]*$/, "").trim();
    } catch {
      extracted = createDefaultExtract();
      agentResponse = raw.replace(/---EXTRACT---[\s\S]*$/, "").trim();
    }
  } else {
    extracted = createDefaultExtract();
    agentResponse = raw;
  }

  return { agentResponse, extracted };
}

function createDefaultExtract(): VoiceExtractedProfile {
  return {
    isComplete: false,
    missingFields: ["name", "url", "senderBrief"],
    lastAgentMessage: "I didn't quite catch that. Could you say it again?",
  };
}

export function formatProfileSummary(
  profile: VoiceExtractedProfile
): string {
  const parts: string[] = [];
  if (profile.name) parts.push(`Recipient: ${profile.name}`);
  if (profile.company) parts.push(`at ${profile.company}`);
  if (profile.role) parts.push(`(${profile.role})`);
  if (profile.senderName) parts.push(`From: ${profile.senderName}`);
  if (profile.senderBrief) parts.push(`Brief: ${profile.senderBrief}`);
  if (profile.url) parts.push(`URL: ${profile.url}`);
  return parts.join(" · ");
}
