import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, getActiveProvider } from "./llm";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("LLM fallback chain", () => {
  it("falls through to the next provider when Anthropic 400s on an unfunded key", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-unfunded";
    process.env.FEATHERLESS_API_KEY = "fl-test";
    delete process.env.PREFERRED_LLM_PROVIDER;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.VENICE_API_KEY;
    delete process.env.TOKENROUTER_API_KEY;

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("api.anthropic.com")) {
          return jsonResponse(400, {
            type: "error",
            error: { type: "invalid_request_error", message: "credit balance is too low" },
          });
        }
        return jsonResponse(200, {
          choices: [{ message: { content: "fallback answer" } }],
        });
      }),
    );

    const result = await chatCompletion("system", "hello");
    expect(result).toBe("fallback answer");
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain("api.anthropic.com");
    expect(calls[1]).toContain("featherless");
  });

  it("keeps walking the chain until a provider succeeds", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-unfunded";
    process.env.VENICE_API_KEY = "venice-test";
    process.env.FEATHERLESS_API_KEY = "fl-test";
    delete process.env.PREFERRED_LLM_PROVIDER;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.TOKENROUTER_API_KEY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("api.anthropic.com")) {
          return jsonResponse(400, { error: "credit balance is too low" });
        }
        if (url.includes("venice")) return jsonResponse(429, { error: "rate limited" });
        return jsonResponse(200, { choices: [{ message: { content: "featherless wins" } }] });
      }),
    );

    await expect(chatCompletion("system", "hello")).resolves.toBe("featherless wins");
  });

  it("throws the last error when every provider fails", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-unfunded";
    delete process.env.GOOGLE_API_KEY;
    delete process.env.VENICE_API_KEY;
    delete process.env.FEATHERLESS_API_KEY;
    delete process.env.TOKENROUTER_API_KEY;
    delete process.env.PREFERRED_LLM_PROVIDER;

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { error: "credit balance is too low" })));

    await expect(chatCompletion("system", "hello")).rejects.toThrow(/Anthropic API error: 400/);
  });

  it("reports the preferred provider as active", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.PREFERRED_LLM_PROVIDER;
    expect(getActiveProvider()).toContain("anthropic");
  });
});
