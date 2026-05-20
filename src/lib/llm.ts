/**
 * LLM provider abstraction.
 * Supports multiple backends with automatic fallback:
 * 1. Anthropic Claude (if ANTHROPIC_API_KEY is set)
 * 2. Venice AI (if VENICE_API_KEY is set) — OpenAI-compatible
 * 3. Featherless AI (if FEATHERLESS_API_KEY is set) — OpenAI-compatible, open-weight models
 *
 * This prevents vendor lock-in and ensures the app works even without
 * an Anthropic key (which is harder to get for hackathon participants).
 */

import { fetchWithRetry } from "@/lib/retry";

type Provider = "anthropic" | "google" | "venice" | "featherless";

interface LLMConfig {
  provider: Provider;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

const DEFAULT_GOOGLE_MODEL = "gemini-3.1-flash";
const DEFAULT_VENICE_MODEL = "deepseek-v4-flash";
const DEFAULT_FEATHERLESS_MODEL = "deepseek-ai/DeepSeek-V4-Flash";
const DEFAULT_LLM_TIMEOUT_MS = 30000;

function getConfig(): LLMConfig {
  const preferred = process.env.PREFERRED_LLM_PROVIDER as Provider | undefined;

  // 1. Check for manual override
  if (preferred === "google" && process.env.GOOGLE_API_KEY) {
    return getGoogleConfig();
  }
  if (preferred === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return getAnthropicConfig();
  }
  if (preferred === "featherless" && process.env.FEATHERLESS_API_KEY) {
    return getFeatherlessConfig();
  }
  if (preferred === "venice" && process.env.VENICE_API_KEY) {
    return getVeniceConfig();
  }

  // 2. Default Priority: Anthropic -> Google -> Venice -> Featherless
  if (process.env.ANTHROPIC_API_KEY) return getAnthropicConfig();
  if (process.env.GOOGLE_API_KEY) return getGoogleConfig();
  if (process.env.VENICE_API_KEY) return getVeniceConfig();
  if (process.env.FEATHERLESS_API_KEY) return getFeatherlessConfig();

  throw new Error(
    "No LLM provider configured. Set ANTHROPIC_API_KEY, GOOGLE_API_KEY, VENICE_API_KEY, or FEATHERLESS_API_KEY."
  );
}

function getAnthropicConfig(): LLMConfig {
  return {
    provider: "anthropic",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250514",
    baseUrl: "https://api.anthropic.com",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    timeoutMs: Number(process.env.ANTHROPIC_TIMEOUT_MS || DEFAULT_LLM_TIMEOUT_MS),
  };
}

function getGoogleConfig(): LLMConfig {
  return {
    provider: "google",
    model: process.env.GOOGLE_MODEL || DEFAULT_GOOGLE_MODEL,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: process.env.GOOGLE_API_KEY!,
    timeoutMs: Number(process.env.GOOGLE_TIMEOUT_MS || DEFAULT_LLM_TIMEOUT_MS),
  };
}

function getFeatherlessConfig(): LLMConfig {
  return {
    provider: "featherless",
    model: process.env.FEATHERLESS_MODEL || DEFAULT_FEATHERLESS_MODEL,
    baseUrl: "https://api.featherless.ai/v1",
    apiKey: process.env.FEATHERLESS_API_KEY!,
    timeoutMs: Number(process.env.FEATHERLESS_TIMEOUT_MS || DEFAULT_LLM_TIMEOUT_MS),
  };
}

function getVeniceConfig(): LLMConfig {
  return {
    provider: "venice",
    model: process.env.VENICE_MODEL || DEFAULT_VENICE_MODEL,
    baseUrl: "https://api.venice.ai/api/v1",
    apiKey: process.env.VENICE_API_KEY!,
    timeoutMs: Number(process.env.VENICE_TIMEOUT_MS || DEFAULT_LLM_TIMEOUT_MS),
  };
}

/**
 * Send a chat completion request to the configured LLM provider.
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

  if (config.provider === "google") {
    return callGoogleGemini(config, systemPrompt, userMessage, maxTokens);
  }

  return callOpenAICompatible(config, systemPrompt, userMessage, maxTokens);
}

/**
 * Google Gemini REST API
 */
async function callGoogleGemini(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const response = await fetchWithRetry(
    `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `System Instructions: ${systemPrompt}\n\nUser Message: ${userMessage}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      }),
    },
    { timeoutMs: config.timeoutMs, maxAttempts: 1 }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Gemini API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return stripCodeBlocks(content);
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
    { timeoutMs: config.timeoutMs, maxAttempts: 1 }
  );

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * OpenAI-compatible API (Venice, Featherless, etc.)
 * Handles thinking mode (reasoning field) and markdown-wrapped JSON.
 */
async function callOpenAICompatible(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const payload: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  // Venice-specific: disable thinking mode for faster, cheaper responses
  if (config.provider === "venice") {
    payload.venice_parameters = { disable_thinking: true };
  }

  const response = await fetchWithRetry(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: config.timeoutMs, maxAttempts: 1 }
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
