import { chatCompletion } from "@/lib/llm";

export interface SenderProfile {
  business?: string;
  brand?: string;
  personality?: string;
  audience?: string;
  offer?: string;
  proofPoints?: string[];
}

export interface SenderPlaybook {
  /** What the sender wants from this conversation. */
  wants?: string;
  /** What the sender can offer the recipient. */
  canOffer?: string;
  /** Where the sender has flexibility (price, time, scope, etc.). */
  wiggleRoom?: string;
  /** Hard limits the agent must not cross. */
  constraints?: string[];
}

export interface OutreachIntentProfile {
  goal?: string;
  desiredOutcome?: string;
  reasonForReachingOutNow?: string;
  relationshipWarmth?: "cold" | "warm" | "existing";
  tonePreference?: string;
  /** Playbook for live / agentic conversations. */
  playbook?: SenderPlaybook;
}

export interface RelevanceSignal {
  label: string;
  evidence: string;
  relevanceToOutreach: string;
  confidence: "high" | "medium" | "low";
  source?: string;
}

export interface TopicalAngle {
  id: string;
  label: string;
  description: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  relevanceToOutreach: string;
  suggestedArchetype?: string;
}

export interface SourceAttribution {
  factCount: number;
  inferenceCount: number;
  sourcesScanned: number;
  providerBreakdown?: Record<string, number>;
}

export interface Profile {
  name: string;
  current_role: string;
  company: string;
  notable_work: string[];
  interests: string[];
  tone: "formal" | "conversational" | "technical";
  personalization_hooks: string[];
  language: string;
  sender_profile?: SenderProfile;
  outreach_intent?: OutreachIntentProfile;
  relevance_signals?: RelevanceSignal[];
  suggestedAngles?: TopicalAngle[];
  sourceAttribution?: SourceAttribution;
}

/**
 * Pass 1: Merge enriched profile data into a structured profile JSON.
 */
export async function synthesise(
  enrichment: string[],
  options?: {
    forceFallback?: boolean;
    senderContext?: {
      senderBrief?: string;
      senderName?: string;
      senderBusiness?: string;
      senderBrand?: string;
      senderPersonality?: string;
      senderAudience?: string;
      senderOffer?: string;
      senderProofPoints?: string[];
      outreachGoal?: string;
      desiredOutcome?: string;
      relationshipWarmth?: "cold" | "warm" | "existing";
      reasonForReachingOutNow?: string;
      tonePreference?: string;
    };
  }
): Promise<Profile> {
  if (options?.forceFallback) {
    return fallbackProfile(enrichment);
  }

  const systemPrompt = `You are a profile synthesis agent. Given enriched social profile data, produce a structured JSON profile. Respond ONLY with valid JSON matching this schema: { "name": string, "current_role": string, "company": string, "notable_work": string[], "interests": string[], "tone": "formal" | "conversational" | "technical", "personalization_hooks": string[], "language": string, "sender_profile"?: { "business"?: string, "brand"?: string, "personality"?: string, "audience"?: string, "offer"?: string, "proofPoints"?: string[] }, "outreach_intent"?: { "goal"?: string, "desiredOutcome"?: string, "reasonForReachingOutNow"?: string, "relationshipWarmth"?: "cold" | "warm" | "existing", "tonePreference"?: string, "playbook"?: { "wants"?: string, "canOffer"?: string, "wiggleRoom"?: string, "constraints"?: string[] } }, "relevance_signals"?: [{ "label": string, "evidence": string, "relevanceToOutreach": string, "confidence": "high" | "medium" | "low", "source"?: string }], "suggestedAngles"?: [{ "id": string, "label": string, "description": string, "evidence": string, "confidence": "high" | "medium" | "low", "relevanceToOutreach": string, "suggestedArchetype"?: string }], "sourceAttribution"?: { "factCount": number, "inferenceCount": number, "sourcesScanned": number } }. Do not fabricate information not present in the source data. Do not wrap in markdown code blocks. Output raw JSON only. IMPORTANT: The "name" field MUST be the PROFILE OWNER's real full name (first + last). The data starts with a Profile URL — that is the person you are profiling. Other people mentioned in search results are NOT the profile owner. If you cannot determine the profile owner's name, return "name": "". Never use generic labels like "Help Center", "User", "Profile", or other people's names. The "language" field should be the ISO 639-1 code of the primary language used in the profile content (e.g. "en", "es", "fr", "de", "ja", "zh", "pt", "ar", "hi", "it", "nl", "ko", "ru"). Default to "en" if uncertain. When sender context is provided, infer a compact sender profile, 3-5 outreach relevance signals, and 2-4 suggested angles. Each angle should propose a distinct outreach approach backed by evidence from the profile data. Assign each angle a confidence label and suggest which hook archetype fits best (mirror, origin, inside_joke, future_cast, or day_in_the_life). Favor high-signal, recent, and credible connections over generic compliments. Populate sourceAttribution with the total number of factual findings vs inferences and the rough count of unique sources scanned.`;

  const senderContextBlock = options?.senderContext
    ? `\n\nSender context:\n${JSON.stringify(options.senderContext, null, 2)}`
    : "";

  const userMessage = `Synthesise the following enriched profile data into a structured profile. IMPORTANT: The profile owner is the person whose URL appears at the top — only extract THEIR name, role, and details. Other people mentioned in replies, comments, or articles are not the subject.${senderContextBlock}\n\n${enrichment.join("\n\n---\n\n")}`;

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
export type IntentId =
  | "warm_intro"
  | "investor_pitch"
  | "hiring"
  | "conference_followup"
  | "reengage"
  | "founder_to_founder";

export interface ScriptResult {
  script: string;
  vibeId: string;
  vibeReasoning: string;
}

const INTENT_RUBRICS: Record<IntentId, string> = {
  warm_intro:
    "Intent: warm introduction. Open with curiosity, not a pitch. Acknowledge a specific recent piece of their work before saying anything about yourself. End with a low-friction ask (a question, a 15-min chat, or simply 'reply if curious').",
  investor_pitch:
    "Intent: investor outreach. Lead with one concrete signal of momentum (users, revenue, partnership, technical breakthrough). Reference the recipient's stated thesis or a recent investment that maps to your space. Be specific about the ask — meeting, intro, or feedback — and include why now.",
  hiring:
    "Intent: hiring reach-out. Open by referencing a specific project, talk, or repo of theirs — not their job title. Explain in one sentence what makes this role unusual or hard, and why you think they specifically would find it interesting. Avoid generic recruiter language entirely.",
  conference_followup:
    "Intent: post-conference follow-up. Reference the specific event, talk, or conversation. Recall a concrete moment if possible. Keep it short and pick up where the in-person conversation left off — don't restart it.",
  reengage:
    "Intent: re-engaging a cold contact. Acknowledge the gap honestly. Lead with what's changed on your side — new product, new role, new context — that makes reaching out now genuinely different. Don't pretend the silence didn't happen.",
  founder_to_founder:
    "Intent: founder-to-founder. Speak peer-to-peer, not buyer-to-vendor. Reference a hard problem they've publicly written or talked about that overlaps with yours. Offer something concrete (a tool, an intro, a learning) before asking for anything in return.",
};

const VIBE_SYSTEM_CONTEXT = `
You also need to recommend an ElevenLabs "Cinematic Vibe" (background atmosphere) for this video.
AVAILABLE VIBES:
- "tech-office": Modern, sleek, productive. Best for software, engineering, and tech startups.
- "quiet-cafe": Warm, conversational, human. Best for creative, relaxed, or human-centric outreach.
- "startup-hustle": High-energy, collaborative, fast-paced. Best for high-growth, intense, or energetic prospects.
- "zen-studio": Calm, focused, minimalist. Best for designers, artists, or high-end residential creative vibes.
- "city-pulse": Urban, dynamic, global business. Best for finance, corporate, or urban-centric professional context.
`;

export async function generateScript(
  profile: Profile,
  senderBrief?: string,
  options?: {
    forceFallback?: boolean;
    intent?: IntentId;
    senderName?: string;
    recentActivity?: string;
    companyContext?: string;
    toneInstruction?: string;
    language?: string;
    senderProfile?: SenderProfile;
    outreachIntent?: OutreachIntentProfile;
  }
): Promise<ScriptResult> {
  if (options?.forceFallback) {
    return { script: fallbackScript(profile, senderBrief), vibeId: "tech-office", vibeReasoning: "Fallback default." };
  }

  const intentRubric = options?.intent ? INTENT_RUBRICS[options.intent] : null;
  const senderNameInstruction = options?.senderName
    ? `The sender's name is ${options.senderName} — use it naturally in the opening.`
    : `Do NOT include a sender name or placeholder like "[Your Name]". Just start naturally without introducing yourself by name.`;

  const language = options?.language || profile.language || "en";
  const languageInstruction = language !== "en"
    ? `\nLANGUAGE: The recipient's profile content is primarily in ${language}. Write the ENTIRE script in ${language}. Every word must be in ${language} — do NOT write in English or mix languages. Use natural, fluent ${language}.`
    : `\nLANGUAGE: Write the script in English.`;

  const toneInstruction = options?.toneInstruction
    ? `\nTONE: The target's natural communication style is "${profile.tone}". ${options.toneInstruction}`
    : `\nTONE: Match the target's communication style (${profile.tone}). If they write formally in their profile, write formally. If they are conversational, mirror that energy. The script should feel like a genuine message from one human to another, not a corporate form letter.`;

  const senderContextInstruction = options?.senderProfile || options?.outreachIntent
    ? `\nSENDER CONTEXT: You have structured context about the sender's business, brand, audience, offer, personality, and outreach intent. Use it explicitly to connect the recipient's context to the actual ask. The script should make clear why this recipient is a fit for this outreach right now.`
    : "";

  const systemPrompt = `You are an expert video script writer. Write a personalised 45-90 second video script (under 200 words) that is a direct message TO ${profile.name}. Address them by name. The sender is speaking directly to this person in a personalised video outreach. Reference at least 2 specific details from their profile. Write in first person as the sender, second person ("you") for the recipient. Be conversational and genuine — not salesy or generic. Never write about them in third person. Never use placeholder brackets like [Your Name] or [specific topic] — use ACTUAL details from the profile or omit. ${senderNameInstruction}${intentRubric ? `\n\n${intentRubric}` : ""}${senderContextInstruction}
${toneInstruction}
${languageInstruction}
${VIBE_SYSTEM_CONTEXT}

OUTPUT FORMAT (JSON):
{
  "script": "The full script text.",
  "vibeId": "The ID of the recommended vibe.",
  "vibeReasoning": "1-sentence on why this vibe matches this person's role or industry."
}
Respond ONLY with raw JSON. No markdown code blocks.`;

  const contextBlocks = [`Profile:\n${JSON.stringify(profile, null, 2)}`];
  if (options?.senderProfile) {
    contextBlocks.push(`SENDER PROFILE:\n${JSON.stringify(options.senderProfile, null, 2)}`);
  }
  if (options?.outreachIntent) {
    contextBlocks.push(`OUTREACH INTENT:\n${JSON.stringify(options.outreachIntent, null, 2)}`);
  }
  if (profile.relevance_signals && profile.relevance_signals.length > 0) {
    contextBlocks.push(`RELEVANCE SIGNALS:\n${JSON.stringify(profile.relevance_signals, null, 2)}`);
  }
  if (profile.suggestedAngles && profile.suggestedAngles.length > 0) {
    contextBlocks.push(`SUGGESTED ANGLES:\n${JSON.stringify(profile.suggestedAngles, null, 2)}`);
  }
  if (options?.recentActivity) {
    contextBlocks.push(`RECENT ACTIVITY:\n${options.recentActivity}`);
  }
  if (options?.companyContext) {
    contextBlocks.push(`COMPANY CONTEXT:\n${options.companyContext}`);
  }
  const briefLine = senderBrief ? `\n\nSender brief: ${senderBrief}` : "\n\nWrite a general introduction/outreach script.";
  const userMessage = contextBlocks.join("\n\n---\n\n") + briefLine;

  try {
    const text = await chatCompletion(systemPrompt, userMessage);
    const parsed = parseScriptJson(text);
    if (parsed) return parsed;
  } catch (error) {
    console.warn("[script] Script generation failed, using heuristic fallback:", error);
  }

  return { script: fallbackScript(profile, senderBrief), vibeId: "tech-office", vibeReasoning: "Heuristic fallback." };
}

function parseScriptJson(text: string): ScriptResult | null {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1],
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<ScriptResult>;
      if (parsed.script) {
        return {
          script: parsed.script,
          vibeId: parsed.vibeId || "tech-office",
          vibeReasoning: parsed.vibeReasoning || "Standard professional vibe."
        };
      }
    } catch { /* noop */ }
  }
  return null;
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

const GARBAGE_NAMES = new Set([
  "help center", "user", "profile", "account", "home", "settings",
  "sign in", "log in", "twitter", "x", "linkedin", "github",
  "privacy policy", "terms of service", "there",
]);

function isValidPersonName(name: string | undefined): boolean {
  if (!name || name.trim().length < 2) return false;
  if (GARBAGE_NAMES.has(name.toLowerCase().trim())) return false;
  if (/^[^a-zA-Z]*$/.test(name)) return false;
  if (name.split(/\s+/).length > 5) return false;
  return true;
}

function normaliseProfile(profile: Partial<Profile>): Profile {
  const rawName = isValidPersonName(profile.name) ? profile.name!.trim() : "there";
  // Capitalize each word if all-lowercase (common with social handles)
  const name = /^[a-z\s]+$/.test(rawName)
    ? rawName.replace(/\b\w/g, (c) => c.toUpperCase())
    : rawName;
  const language = profile.language && /^[a-z]{2}(-[A-Z]{2})?$/.test(profile.language)
    ? profile.language.toLowerCase()
    : "en";
  return {
    name,
    current_role: profile.current_role || "",
    company: profile.company || "",
    notable_work: Array.isArray(profile.notable_work) ? profile.notable_work : [],
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    tone: profile.tone === "formal" || profile.tone === "technical" ? profile.tone : "conversational",
    personalization_hooks: Array.isArray(profile.personalization_hooks)
      ? profile.personalization_hooks
      : [],
    language,
    sender_profile: profile.sender_profile,
    outreach_intent: profile.outreach_intent,
    relevance_signals: Array.isArray(profile.relevance_signals) ? profile.relevance_signals : [],
    suggestedAngles: Array.isArray(profile.suggestedAngles) ? profile.suggestedAngles : [],
    sourceAttribution: profile.sourceAttribution,
  };
}

function fallbackProfile(enrichment: string[]): Profile {
  const text = enrichment.join("\n");
  const lines = text
    .split("\n")
    .map(cleanProfileLine)
    .filter(isUsefulProfileLine);
  const name = inferName(lines) || "there";

  // Try to extract role and company from patterns like "Co-founder at Melius"
  let current_role = "";
  let company = "";
  const roleMatch = text.match(/(?:^|\s|-)(\w[\w\s-]*?(?:founder|ceo|cto|coo|vp|engineer|designer|manager|director|head of\s+\w+))\s+(?:at|@)\s+(\w[\w\s]*)/im);
  if (roleMatch) {
    current_role = roleMatch[1].trim();
    company = roleMatch[2].trim().split(/[.,\s]/)[0];
  }

  const hooks = lines
    .filter((line) => line.length > 20 && line.length < 140)
    .filter((line) => line !== name)
    .slice(0, 4);

  const langCode = text.match(/[^\x00-\x7F]/) ? "und" : "en";
  return {
    name,
    current_role,
    company,
    notable_work: hooks.slice(0, 2),
    interests: hooks.slice(2, 4),
    tone: "conversational",
    personalization_hooks: hooks,
    language: langCode,
    relevance_signals: [],
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
  // Pattern 1: "Firstname Lastname" at start of line (proper case)
  const properName = lines.find((line) => /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line));
  if (properName) {
    return properName.split(/\s+/).slice(0, 2).join(" ");
  }

  // Pattern 2: "name (@handle) / Posts / X" from search result titles
  const text = lines.join("\n");
  const titleMatch = text.match(/(\w+)\s*\(@?\w+\)\s*[/|]/);
  if (titleMatch) {
    const candidate = titleMatch[1];
    // Capitalise first letter
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  // Pattern 3: "Name (@handle)" anywhere
  const handleNameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(@?\w+\)/);
  if (handleNameMatch) {
    return handleNameMatch[1].trim();
  }

  // Pattern 4: bare handle as last resort
  const handleLine = lines.find((line) => /^[a-zA-Z0-9_.-]{2,32}$/.test(line));
  return handleLine || null;
}

export interface ScriptVariants {
  variantA: ScriptResult;
  variantB: ScriptResult;
}

/**
 * Generate 2 script variants for A/B comparison.
 * Makes a single LLM call asking for both variants to save cost and time.
 */
export async function generateScriptVariants(
  profile: Profile,
  senderBrief?: string,
  options?: {
    intent?: IntentId;
    senderName?: string;
    recentActivity?: string;
    companyContext?: string;
    language?: string;
  }
): Promise<ScriptVariants> {
  const intentRubric = options?.intent ? INTENT_RUBRICS[options.intent] : null;
  const senderNameInstruction = options?.senderName
    ? `The sender's name is ${options.senderName} — use it naturally in the opening.`
    : `Do NOT include a sender name or placeholder like "[Your Name]". Just start naturally without introducing yourself by name.`;
  const language = options?.language || profile.language || "en";
  const languageInstruction = language !== "en"
    ? `\nLANGUAGE: The recipient's profile content is primarily in ${language}. Write BOTH variants ENTIRELY in ${language}. Every word must be in ${language}.`
    : `\nLANGUAGE: Write both scripts in English.`;

  const toneInstruction = `\nTONE: Match the target's communication style. If they write formally, write formally. If they are conversational, mirror that energy.`;

  const systemPrompt = `You are an expert video script writer. Write TWO distinct personalised 45-90 second video scripts (each under 200 words) addressed TO ${profile.name}. The sender is speaking directly to this person in a personalised video outreach.

Requirement for BOTH variants:
- Address them by name
- Reference at least 2 specific details from their profile
- Write in first person as the sender, second person ("you") for the recipient
- Be conversational and genuine — never salesy or generic
- Never write about them in third person
- Never use placeholder brackets
${senderNameInstruction}
${intentRubric ? `\n\n${intentRubric}` : ""}
${toneInstruction}
${languageInstruction}

The TWO variants should have DIFFERENT approaches:
- Variant A should be the primary recommended approach — confident, direct, natural.
- Variant B should be a creative alternative — different angle, different hook, different energy.

${VIBE_SYSTEM_CONTEXT}

OUTPUT FORMAT (JSON):
{
  "variantA": {
    "script": "The full script text for variant A.",
    "vibeId": "The ID of the recommended vibe.",
    "vibeReasoning": "1-sentence explanation."
  },
  "variantB": {
    "script": "The full script text for variant B.",
    "vibeId": "The ID of the recommended vibe.",
    "vibeReasoning": "1-sentence explanation."
  }
}
Respond ONLY with raw JSON. No markdown code blocks.`;

  const contextBlocks = [`Profile:\n${JSON.stringify(profile, null, 2)}`];
  if (options?.recentActivity) contextBlocks.push(`RECENT ACTIVITY:\n${options.recentActivity}`);
  if (options?.companyContext) contextBlocks.push(`COMPANY CONTEXT:\n${options.companyContext}`);
  const userMessage = contextBlocks.join("\n\n---\n\n") + `\n\nSender brief: ${senderBrief || "Write a general introduction/outreach script."}`;

  try {
    const text = await chatCompletion(systemPrompt, userMessage);
    const parsed = parseScriptVariantsJson(text);
    if (parsed) return parsed;
  } catch (error) {
    console.warn("[script] Script variants generation failed:", error);
  }

  const baseScript = fallbackScript(profile, senderBrief);
  return {
    variantA: { script: baseScript, vibeId: "tech-office", vibeReasoning: "Heuristic fallback." },
    variantB: { script: baseScript.replace("Hey", "Hi there"), vibeId: "tech-office", vibeReasoning: "Heuristic fallback." },
  };
}

function parseScriptVariantsJson(text: string): ScriptVariants | null {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1],
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed.variantA?.script && parsed.variantB?.script) {
        return {
          variantA: {
            script: parsed.variantA.script,
            vibeId: parsed.variantA.vibeId || "tech-office",
            vibeReasoning: parsed.variantA.vibeReasoning || "",
          },
          variantB: {
            script: parsed.variantB.script,
            vibeId: parsed.variantB.vibeId || "tech-office",
            vibeReasoning: parsed.variantB.vibeReasoning || "",
          },
        };
      }
    } catch { /* noop */ }
  }
  return null;
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
