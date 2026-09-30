const NEGATION =
  /\b(?:don't|dont|do not|doesn't|doesnt|does not|didn't|didnt|did not|never|no need|not interested|wouldn't|wouldnt|would not)\b/i;

const REQUEST_HUMAN =
  /\b(?:speak|talk|connect|chat)\b[^.?!]{0,40}?\bto\b[^.?!]{0,40}?\b(?:actual sender|real person|real human|actual human|actual person|the sender|directly)\b|\bspeak to (?:him|her|them|papa|mama)\b/i;

const SCHEDULE =
  /\b(?:schedule|book|set up|arrange)\b[^.?!]{0,40}?\b(?:a |an |some |the )?(?:meeting|call|time|appointment|chat)\b|\bcan we meet\b|\bbook a call\b|\bchoose a time\b|\bpick a time\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectEscalationHint(
  utterance: string,
  senderName?: string,
): "request-human" | "schedule" | null {
  const text = (utterance || "").trim();
  if (!text || NEGATION.test(text)) return null;
  if (REQUEST_HUMAN.test(text)) return "request-human";
  if (senderName && senderName.trim()) {
    const name = escapeRegExp(senderName.trim());
    if (new RegExp(`\\b(?:speak|talk)\\b[^.?!]{0,20}\\bto\\s+${name}\\b`, "i").test(text)) {
      return "request-human";
    }
  }
  if (SCHEDULE.test(text)) return "schedule";
  return null;
}
