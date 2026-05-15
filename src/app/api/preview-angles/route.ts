import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

export interface AngleCandidate {
  label: string;
  evidence: string;
  why_chosen: string;
}

export interface SkippedSignal {
  signal: string;
  why_skipped: string;
}

export interface PreviewAnglesResponse {
  angles: AngleCandidate[];
  skipped: SkippedSignal[];
}

/**
 * POST /api/preview-angles
 * Given a structured profile, return 4 candidate "angles" the agent found,
 * plus signals it deliberately skipped with reasoning.
 *
 * This is the Coach Mode endpoint — cheap (~1-2s), runs between enrich and script.
 */
export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "script", RATE_LIMITS.script);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  try {
    const { profile } = await request.json();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an outreach strategist. Given a structured profile of a person, identify the 4 strongest "angles" for a personalised outreach message — specific, recent, relevant details that would make the recipient feel the message was written for them specifically.

Also identify 2-3 signals you deliberately SKIPPED and explain why they're too generic, too old, or too low-signal to use.

Respond ONLY with valid JSON matching this exact schema:
{
  "angles": [
    { "label": "short 3-5 word label", "evidence": "the specific detail from their profile", "why_chosen": "one sentence on why this is a strong angle" }
  ],
  "skipped": [
    { "signal": "what you skipped", "why_skipped": "one sentence on why it's not worth using" }
  ]
}

Rules:
- Return exactly 4 angles and 2-3 skipped signals
- Angles should be specific and recent (not generic job titles)
- Prefer: recent projects, specific writing/talks, shared context, timely events
- Skip: generic role descriptions, old achievements, company-level facts everyone knows
- Do not wrap in markdown code blocks. Output raw JSON only.`;

    const userMessage = `Profile:\n${JSON.stringify(profile, null, 2)}`;

    const text = await chatCompletion(systemPrompt, userMessage, {
      maxTokens: 512,
    });

    const result = parseAnglesJson(text);
    if (!result) {
      throw new Error("LLM did not return parseable JSON");
    }

    // Validate structure
    if (!result.angles || !Array.isArray(result.angles) || result.angles.length === 0) {
      throw new Error("Invalid response structure");
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate angles" },
      { status: 500 }
    );
  }
}

/**
 * Defensively parse JSON from an LLM response. Handles markdown-fenced
 * blocks (```json … ```), leading/trailing prose, and extracts the first
 * top-level object as a fallback. Mirrors the pattern used by
 * parseProfileJson() in src/lib/claude.ts.
 */
function parseAnglesJson(text: string): PreviewAnglesResponse | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Some providers (notably DeepSeek via Featherless) return the object
  // body without the outer braces — e.g.  "angles": [...]  …  } — so
  // wrapping the trimmed payload is one of our recovery candidates.
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1];
  const bracedMatch = trimmed.match(/\{[\s\S]*\}/)?.[0];

  const candidates = [
    trimmed,
    fencedMatch,
    bracedMatch,
    `{${trimmed.replace(/^\{?/, "").replace(/\}?$/, "")}}`,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && Array.isArray(parsed.angles)) {
        return parsed as PreviewAnglesResponse;
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}
