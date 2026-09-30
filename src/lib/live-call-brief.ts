export interface LiveCallBrief {
  goal: string;
  discussed: string;
  openQuestions: string;
  reason: string;
}

export interface BriefDialogueMessage {
  role: "user" | "assistant";
  content: string;
}

export const LIVE_CALL_BRIEF_FIELD_LIMIT = 500;
export const LIVE_CALL_BRIEF_MESSAGE_LIMIT = 20;
export const LIVE_CALL_BRIEF_MESSAGE_CHAR_LIMIT = 2_000;
export const LIVE_CALL_BRIEF_TOTAL_CHAR_LIMIT = 12_000;

const BRIEF_FIELDS = ["goal", "discussed", "openQuestions", "reason"] as const;

export function parseLiveCallBrief(input: unknown): LiveCallBrief | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !BRIEF_FIELDS.includes(key as typeof BRIEF_FIELDS[number]))) return null;
  if (BRIEF_FIELDS.some((key) => typeof value[key] !== "string" || (value[key] as string).length > LIVE_CALL_BRIEF_FIELD_LIMIT)) return null;
  return Object.fromEntries(BRIEF_FIELDS.map((key) => [key, (value[key] as string).trim()])) as unknown as LiveCallBrief;
}

export function parseBriefDialogue(input: unknown): BriefDialogueMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > LIVE_CALL_BRIEF_MESSAGE_LIMIT) return null;
  let total = 0;
  const messages: BriefDialogueMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const message = item as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return null;
    const content = message.content.trim();
    if (!content || message.content.length > LIVE_CALL_BRIEF_MESSAGE_CHAR_LIMIT) return null;
    total += message.content.length;
    if (total > LIVE_CALL_BRIEF_TOTAL_CHAR_LIMIT) return null;
    messages.push({ role: message.role, content });
  }
  return messages;
}

