/**
 * Output/research sanitizers — the post-hook's pattern registry.
 *
 * Two families:
 *
 * - `injection.*` — text in prospect-controlled fields (a LinkedIn bio, an X
 *   post, a scraped page) that is addressed to the *model*, not to a human
 *   reader. Ported from the MCP4GTM workshop's strip rules. These key on text
 *   addressed to a machine; they deliberately do NOT key on text that merely
 *   claims authority ("our committee waived the usual limits" is prose a real
 *   person writes — a stated false negative).
 * - `contact.*` — raw contact identifiers (emails, phone numbers) scraped out
 *   of pages. nuncio's free tier must not launder scraped PII to anonymous
 *   callers.
 *
 * Deterministic patterns, not a guarantee — the corpus in
 * sanitize.test.ts pins both halves: every pattern has an injection it must
 * catch and benign prose it must leave alone.
 */

export interface SanitizePattern {
  id: string;
  description: string;
  re: RegExp;
  /** When true, the match and everything after it in the field is removed. */
  toEnd?: boolean;
  /** Replacement for span removals. */
  replacement?: string;
}

const INJECTION_PATTERNS: SanitizePattern[] = [
  {
    id: "injection.instruction-override",
    description:
      "An imperative telling the reader to set aside the instructions it was given.",
    re: /\b(?:ignore|disregard|forget|override|skip)\b[^.\n]{0,60}?\b(?:all|any|the|your|previous|prior|above|earlier|other|system)\b[^.\n]{0,40}?\b(?:instructions?|prompts?|rules?|guidelines?|directions?|programming|training)\b[^.\n]*\.?/gi,
  },
  {
    id: "injection.addressed-to-model",
    description:
      "Free text that names its reader: addressed to an AI, an LLM, or an automated reviewer. Opens a block — removes to end of field.",
    re: /(?:^|\n|\.\s+)\s*(?:note\s+to|dear|attention|to)\s+(?:the\s+)?(?:ai\b|llm\b|language\s+model|ai\s+assistant|automated\s+(?:reviewer|agent|system)|chatbot|gpt\b|claude\b)[^\n]*/gi,
    toEnd: true,
  },
  {
    id: "injection.tool-call-directive",
    description:
      "An imperative naming a tool call — 'call approve_discount', 'invoke render_video', 'run send_email now'.",
    re: /\b(?:call|invoke|execute|run|trigger|fire)\s+(?:the\s+)?(?:tool|function|action)?\s*[a-z][a-z0-9_]*_[a-z0-9_]+\b[^.\n]*/gi,
  },
  {
    id: "injection.concealment",
    description:
      "The reader is told to hide something from the human: 'do not tell the user', 'never mention this to the recipient'.",
    re: /\b(?:do\s+not|don't|never)\s+(?:tell|show|reveal|mention|disclose|report)\b[^.\n]{0,60}?\b(?:the\s+)?(?:user|human|reader|recipient|sender|customer|prospect|person)\b[^.\n]*\.?/gi,
  },
  {
    id: "injection.conversation-delimiter",
    description:
      "A chat-transcript or prompt delimiter pasted into a business field — no prose tell, the token is the evidence.",
    re: /(?:<\|(?:im_start|im_end|endoftext|system|user|assistant)[^|]*\|>|<<\s*SYS\s*>>|<<\s*\/\s*SYS\s*>>|\[\s*INST\s*\]|\[\s*\/\s*INST\s*\]|^#{1,3}\s*(?:system|assistant|user)\s*:?\s*$)/gim,
  },
  {
    id: "injection.role-play",
    description:
      "An instruction to adopt a persona or switch modes: 'act as', 'you are now', 'new persona'.",
    re: /\b(?:act\s+as|you\s+are\s+now|from\s+now\s+on\s+you\s+are|switch\s+to|enter)\s+(?:a\s+)?(?:new\s+)?(?:persona|role|mode|character|dan\b|jailbreak)\b[^.\n]*\.?/gi,
  },
];

const CONTACT_PATTERNS: SanitizePattern[] = [
  {
    id: "contact.email",
    description: "An email address scraped out of a page.",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[email redacted]",
  },
  {
    id: "contact.phone",
    description:
      "A phone-shaped number: +prefix or country-style grouping. Conservative — needs 9+ digits.",
    re: /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{3})[\s.-]\d{3}[\s.-]\d{3,4}(?!\w)/g,
    replacement: "[phone redacted]",
  },
];

export const SANITIZE_PATTERNS: SanitizePattern[] = [...INJECTION_PATTERNS, ...CONTACT_PATTERNS];

const patternById = new Map(SANITIZE_PATTERNS.map((p) => [p.id, p]));

export interface SanitizeResult {
  text: string;
  /** Pattern ids that fired, in order. */
  removed: string[];
}

/**
 * Run a set of named patterns over one string, in array order. `toEnd`
 * patterns cut from the match to the end of the field; the rest remove or
 * replace the matched span.
 */
export function sanitizeField(text: string, patternIds: string[]): SanitizeResult {
  const removed = new Set<string>();
  let out = text;
  for (const id of patternIds) {
    const pattern = patternById.get(id);
    if (!pattern) continue;
    pattern.re.lastIndex = 0;
    if (!pattern.re.test(out)) continue;
    pattern.re.lastIndex = 0;
    if (pattern.toEnd) {
      const m = pattern.re.exec(out);
      if (m) {
        out = out.slice(0, m.index);
        removed.add(id);
      }
    } else {
      const before = out;
      out = out.replace(pattern.re, pattern.replacement ?? "");
      if (out !== before) removed.add(id);
    }
  }
  return { text: out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), removed: [...removed] };
}

/** Every injection pattern id — the default sweep for prospect-controlled text. */
export const INJECTION_SWEEP: string[] = INJECTION_PATTERNS.map((p) => p.id);

/** Contact patterns for anonymous-class output. */
export const CONTACT_REDACTION: string[] = CONTACT_PATTERNS.map((p) => p.id);

/**
 * Deep-sanitize a JSON-shaped value: every string field is swept with
 * `patternIds`. Returns the rewritten value and the union of fired ids.
 * Objects/arrays are copied only when something changed.
 */
export function sanitizeValue<T>(value: T, patternIds: string[]): { value: T; removed: string[] } {
  const removed = new Set<string>();

  function walk(v: unknown): unknown {
    if (typeof v === "string") {
      const r = sanitizeField(v, patternIds);
      r.removed.forEach((id) => removed.add(id));
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(inner);
      }
      return out;
    }
    return v;
  }

  return { value: walk(value) as T, removed: [...removed] };
}
