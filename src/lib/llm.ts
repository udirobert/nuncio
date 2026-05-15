/**
 * LLM provider abstraction.
 * Supports multiple backends with automatic fallback:
 * 1. Anthropic Claude (if ANTHROPIC_API_KEY is set)
 * 2. Featherless AI (if FEATHERLESS_API_KEY is set) — OpenAI-compatible, open-weight models
 *
 * This prevents vendor lock-in and ensures the app works even without
 * an Anthropic key (which is harder to get for hackathon participants).
 */

import { fetchWithRetry } from "@/lib/retry";

type Provider = "anthropic" | "featherless";

interface LLMConfig {
  provider: Provider;
  model: string;
  baseUrl: string;
  apiKey: string;
}

function getConfig(): LLMConfig {
  // Prefer Anthropic if available
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250514",
      baseUrl: "https://api.anthropic.com",
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }

  // Fallback to Featherless
  if (process.env.FEATHERLESS_API_KEY) {
    return {
      provider: "featherless",
      model: "Qwen/Qwen3-32B", // Strong reasoning, good at structured output
      baseUrl: "https://api.featherless.ai/v1",
      apiKey: process.env.FEATHERLESS_API_KEY,
    };
  }

  throw new Error(
    "No LLM provider configured. Set ANTHROPIC_API_KEY or FEATHERLESS_API_KEY."
  );
}

/**
 * Send a chat completion request to the configured LLM provider.
 * Handles the differences between Anthropic and OpenAI-compatible APIs.
 */
export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number }
): Promise<string> {
  const config = getConfig();
  const maxTokens = options?.maxTokens || 1024;

  if (config.provider === "anthropic") {
    return callAnthropic(config, systemPrompt, userMessage, maxTokens);
  }

  return callOpenAICompatible(config, systemPrompt, userMessage, maxTokens);
}

/**
 * Anthropic Messages API
 */
async function callAnthropic(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const response = await fetchWithRetry(
    `${config.baseUrl}/v1/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    },
    { timeoutMs: 8000, maxAttempts: 1 }
  );

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * OpenAI-compatible API (Featherless, etc.)
 * Handles Qwen3's thinking mode (reasoning field) and markdown-wrapped JSON.
 */
async function callOpenAICompatible(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const response = await fetchWithRetry(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    },
    { timeoutMs: 8000, maxAttempts: 1 }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${config.provider}): ${response.status} — ${error}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || "";

  // Strip markdown code blocks if present (Qwen3 wraps JSON in ```json...```)
  content = stripCodeBlocks(content);

  return content;
}

/**
 * Strip markdown code block wrappers from LLM output.
 * Handles: ```json\n{...}\n``` → {...}
 */
function stripCodeBlocks(text: string): string {
  const trimmed = text.trim();

  // Match ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return trimmed;
}

/**
 * Get the active provider name (for logging/display).
 */
export function getActiveProvider(): string {
  try {
    const config = getConfig();
    return `${config.provider} (${config.model})`;
  } catch {
    return "none";
  }
}
