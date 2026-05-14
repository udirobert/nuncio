import { fetchWithRetry } from "@/lib/retry";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5-20250514";

export interface Profile {
  name: string;
  current_role: string;
  company: string;
  notable_work: string[];
  interests: string[];
  tone: "formal" | "conversational" | "technical";
  personalization_hooks: string[];
}

/**
 * Pass 1: Merge enriched profile data into a structured profile JSON.
 */
export async function synthesise(enrichment: string[]): Promise<Profile> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are a profile synthesis agent. Given enriched social profile data, produce a structured JSON profile. Respond ONLY with valid JSON matching this schema: { name, current_role, company, notable_work: string[], interests: string[], tone: 'formal' | 'conversational' | 'technical', personalization_hooks: string[] }. Do not fabricate information not present in the source data.",
      messages: [
        {
          role: "user",
          content: `Synthesise the following enriched profile data into a structured profile:\n\n${enrichment.join("\n\n---\n\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  return JSON.parse(text);
}

/**
 * Pass 2: Generate a personalised video script from the profile and sender brief.
 */
export async function generateScript(
  profile: Profile,
  senderBrief?: string
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You are a video script writer. Given a structured profile and an optional sender brief, write a personalised 45-90 second video script (under 200 words). The script must reference at least 2 specific details from the profile. Write in first person as the sender. Be conversational and genuine — not salesy or generic. Respond with ONLY the script text, no JSON wrapping.",
      messages: [
        {
          role: "user",
          content: `Profile:\n${JSON.stringify(profile, null, 2)}\n\n${senderBrief ? `Sender brief: ${senderBrief}` : "Write a general introduction/outreach script."}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
