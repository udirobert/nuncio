import { chatCompletion } from "@/lib/llm";

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
  const systemPrompt = `You are a profile synthesis agent. Given enriched social profile data, produce a structured JSON profile. Respond ONLY with valid JSON matching this schema: { "name": string, "current_role": string, "company": string, "notable_work": string[], "interests": string[], "tone": "formal" | "conversational" | "technical", "personalization_hooks": string[] }. Do not fabricate information not present in the source data. Do not wrap in markdown code blocks. Output raw JSON only.`;

  const userMessage = `Synthesise the following enriched profile data into a structured profile:\n\n${enrichment.join("\n\n---\n\n")}`;

  const text = await chatCompletion(systemPrompt, userMessage);
  return JSON.parse(text);
}

/**
 * Pass 2: Generate a personalised video script from the profile and sender brief.
 */
export async function generateScript(
  profile: Profile,
  senderBrief?: string
): Promise<string> {
  const systemPrompt = `You are a video script writer. Given a structured profile and an optional sender brief, write a personalised 45-90 second video script (under 200 words). The script must reference at least 2 specific details from the profile. Write in first person as the sender. Be conversational and genuine — not salesy or generic. Respond with ONLY the script text, no JSON wrapping, no markdown, no labels.`;

  const userMessage = `Profile:\n${JSON.stringify(profile, null, 2)}\n\n${senderBrief ? `Sender brief: ${senderBrief}` : "Write a general introduction/outreach script."}`;

  const text = await chatCompletion(systemPrompt, userMessage);
  return text;
}
