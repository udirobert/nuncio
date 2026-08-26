/**
 * Live-session question-topic classifier (STRATEGY Phase 1 instrumentation).
 *
 * Pure and dependency-free so it can run in the browser (live page) and on the
 * server (sync route validation). Topics are bucket labels only — the raw
 * transcript must never leave the browser (privacy + compliance).
 *
 * Matched topics are returned in order of first appearance in the text, which
 * reflects the recipient's order of concern for playbook-gap analysis.
 */

export const LIVE_QUESTION_TOPICS = [
  "pricing",
  "product",
  "security",
  "availability",
  "integrations",
  "competitors",
  "company",
  "next_steps",
  "other",
] as const;

export type LiveQuestionTopic = (typeof LIVE_QUESTION_TOPICS)[number];

const QUESTION_PATTERN =
  /\b(what|how|why|when|where|who|can|could|do|does|is|are|will|would)\b|\btell me\b/i;

const TOPIC_PATTERNS: Array<{ topic: LiveQuestionTopic; pattern: RegExp }> = [
  { topic: "pricing", pattern: /\b(pric(e|ing|es)|costs?|expensive|cheap(er|est)?|plans?|subscriptions?)\b|\$/i },
  { topic: "product", pattern: /\b(product|features?|roadmap|workflow)\b|\bhow (it|this|that) works\b/i },
  { topic: "security", pattern: /\b(security|secure|privacy|gdpr|soc\s?2|compliance|compliant|encrypt\w*|data)\b/i },
  { topic: "availability", pattern: /\b(book(ing)?|schedule|calendar|meet(ing)?s?|calls?|time|availab\w*|slots?)\b/i },
  { topic: "integrations", pattern: /\b(integrat\w*|hubspot|salesforce|slack|zapier|apis?|webhooks?|connect\w*)\b/i },
  { topic: "competitors", pattern: /\b(competitors?|alternatives?|vs\.?|versus|compare[ds]?|better than|cheaper than)\b/i },
  { topic: "company", pattern: /\b(company|team|founded|headquarters?|mission)\b/i },
  { topic: "next_steps", pattern: /\b(next steps?|follow[- ]?up|get started|sign[- ]?up|trial|send me|email me)\b/i },
];

// "demo" is a product concern on its own, but an availability concern when the
// recipient is trying to book/schedule one (e.g. "can we book a demo?").
const DEMO_PATTERN = /\bdemos?\b/i;
const DEMO_BOOKING_PATTERN = /\b(book(ing)?|schedule|calls?)\b/i;

function looksLikeQuestion(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith("?") || QUESTION_PATTERN.test(trimmed);
}

/**
 * Classify a recipient message into question-topic buckets.
 *
 * Returns an empty array when the text does not look like a question. When it
 * is a question but matches no topic keyword, returns ["other"]. Matched
 * topics are ordered by first appearance in the text.
 */
export function classifyQuestionTopics(text: string): string[] {
  if (!text || !looksLikeQuestion(text)) return [];

  const firstIndex = new Map<string, number>();
  for (const { topic, pattern } of TOPIC_PATTERNS) {
    const match = pattern.exec(text);
    if (match) firstIndex.set(topic, match.index);
  }

  const demoMatch = DEMO_PATTERN.exec(text);
  if (demoMatch) {
    const topic = DEMO_BOOKING_PATTERN.test(text) ? "availability" : "product";
    firstIndex.set(topic, Math.min(firstIndex.get(topic) ?? Infinity, demoMatch.index));
  }

  const topics = [...firstIndex.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([topic]) => topic);
  return topics.length > 0 ? topics : ["other"];
}
