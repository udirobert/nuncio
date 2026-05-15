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
export async function synthesise(
  enrichment: string[],
  options?: { forceFallback?: boolean }
): Promise<Profile> {
  if (options?.forceFallback) {
    return fallbackProfile(enrichment);
  }

  const systemPrompt = `You are a profile synthesis agent. Given enriched social profile data, produce a structured JSON profile. Respond ONLY with valid JSON matching this schema: { "name": string, "current_role": string, "company": string, "notable_work": string[], "interests": string[], "tone": "formal" | "conversational" | "technical", "personalization_hooks": string[] }. Do not fabricate information not present in the source data. Do not wrap in markdown code blocks. Output raw JSON only.`;

  const userMessage = `Synthesise the following enriched profile data into a structured profile:\n\n${enrichment.join("\n\n---\n\n")}`;

  try {
    const text = await chatCompletion(systemPrompt, userMessage);
    const parsed = parseProfileJson(text);
    if (parsed) return parsed;
  } catch (error) {
    console.warn("[script] Profile synthesis failed, using heuristic fallback:", error);
  }

  return fallbackProfile(enrichment);
}

/**
 * Pass 2: Generate a personalised video script from the profile and sender brief.
 */
export async function generateScript(
  profile: Profile,
  senderBrief?: string,
  options?: { forceFallback?: boolean }
): Promise<string> {
  if (options?.forceFallback) {
    return fallbackScript(profile, senderBrief);
  }

  const systemPrompt = `You are a video script writer. Given a structured profile and an optional sender brief, write a personalised 45-90 second video script (under 200 words). The script must reference at least 2 specific details from the profile. Write in first person as the sender. Be conversational and genuine — not salesy or generic. Respond with ONLY the script text, no JSON wrapping, no markdown, no labels.`;

  const userMessage = `Profile:\n${JSON.stringify(profile, null, 2)}\n\n${senderBrief ? `Sender brief: ${senderBrief}` : "Write a general introduction/outreach script."}`;

  try {
    const text = await chatCompletion(systemPrompt, userMessage);
    if (text.trim().length > 20) return text.trim();
  } catch (error) {
    console.warn("[script] Script generation failed, using heuristic fallback:", error);
  }

  return fallbackScript(profile, senderBrief);
}

function parseProfileJson(text: string): Profile | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1],
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<Profile>;
      if (parsed.name) {
        return normaliseProfile(parsed);
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function normaliseProfile(profile: Partial<Profile>): Profile {
  return {
    name: profile.name || "there",
    current_role: profile.current_role || "",
    company: profile.company || "",
    notable_work: Array.isArray(profile.notable_work) ? profile.notable_work : [],
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    tone: profile.tone === "formal" || profile.tone === "technical" ? profile.tone : "conversational",
    personalization_hooks: Array.isArray(profile.personalization_hooks)
      ? profile.personalization_hooks
      : [],
  };
}

function fallbackProfile(enrichment: string[]): Profile {
  const text = enrichment.join("\n");
  const lines = text
    .split("\n")
    .map(cleanProfileLine)
    .filter(isUsefulProfileLine);
  const name = inferName(lines) || "there";
  const hooks = lines
    .filter((line) => line.length > 20 && line.length < 140)
    .filter((line) => line !== name)
    .slice(0, 4);

  return {
    name,
    current_role: "",
    company: "",
    notable_work: hooks.slice(0, 2),
    interests: hooks.slice(2, 4),
    tone: "conversational",
    personalization_hooks: hooks,
  };
}

function cleanProfileLine(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulProfileLine(line: string): boolean {
  if (!line) return false;
  const lower = line.toLowerCase();
  const noisy = [
    "block or report",
    "contact github support",
    "this user’s behavior",
    "this user's behavior",
    "skip to content",
    "sign in",
    "sign up",
    "sponsor",
    "followers",
    "following",
  ];
  return !noisy.some((phrase) => lower.includes(phrase));
}

function inferName(lines: string[]): string | null {
  const properName = lines.find((line) => /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line));
  if (properName) {
    return properName.split(/\s+/).slice(0, 2).join(" ");
  }

  const handleLine = lines.find((line) => /^[a-zA-Z0-9_.-]{2,32}$/.test(line));
  return handleLine || null;
}

function fallbackScript(profile: Profile, senderBrief?: string): string {
  const hooks = profile.personalization_hooks.filter(Boolean).slice(0, 2);
  const hookSentence = hooks.length
    ? `I noticed ${hooks.join(" and ").replace(/\.$/, "")}, which stood out as especially relevant.`
    : `I came across your work and wanted to reach out with a specific note.`;
  const briefSentence = senderBrief
    ? `I am reaching out because ${senderBrief.replace(/\.$/, "")}.`
    : `I am reaching out because I think there may be a useful conversation here.`;

  return `Hey ${profile.name} — ${hookSentence} ${briefSentence} I would love to share what I am building and get your perspective. If you are open to it, would you be willing to take a quick look or find 15 minutes next week?`;
}
