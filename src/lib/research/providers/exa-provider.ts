/**
 * Phase 9: ExaProvider
 *
 * Semantic web search via Exa API. Specialises in finding interviews,
 * thought leadership, podcasts, and deep content for known individuals.
 */

import type { ResearchProvider, ResearchProviderConfig } from "./types";
import type { ResearchSource, SourceProvider } from "../types";
import { fetchWithRetry } from "@/lib/retry";

const EXA_API_BASE = "https://api.exa.ai/v1";

export class ExaProvider implements ResearchProvider {
  readonly name: SourceProvider = "exa";
  private apiKey: string | undefined;
  private initialized = false;
  private config: ResearchProviderConfig;

  constructor(config?: ResearchProviderConfig) {
    this.config = config || {};
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.apiKey = this.config.apiKey || process.env.EXA_API_KEY;
    if (!this.apiKey) {
      console.warn("[ExaProvider] EXA_API_KEY not configured");
      throw new Error("ExaProvider requires EXA_API_KEY");
    }
    this.initialized = true;
  }

  async enrichUrl(url: string): Promise<ResearchSource | null> {
    await this.initialize();
    try {
      const response = await fetchWithRetry(
        `${EXA_API_BASE}/contents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey!,
          },
          body: JSON.stringify({
            urls: [url],
            text: true,
          }),
        },
        { maxAttempts: 2, timeoutMs: this.config.timeoutMs || 20000 }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const result = data?.results?.[0];
      if (!result?.text) return null;

      return {
        id: `exa-${crypto.randomUUID().slice(0, 8)}`,
        url,
        provider: "exa",
        title: result.title || undefined,
        snippet: extractSnippet(result.text),
        content: result.text,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async search(
    query: string,
    options?: {
      maxResults?: number;
      recencyDays?: number;
      categories?: string[];
      excludeDomains?: string[];
    }
  ): Promise<ResearchSource[]> {
    await this.initialize();
    try {
      const body: Record<string, unknown> = {
        query,
        numResults: options?.maxResults || 5,
        contents: { text: true },
        useAutoprompt: true,
      };

      if (options?.recencyDays) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - options.recencyDays);
        body.startPublishedDate = startDate.toISOString().split("T")[0];
      }

      if (options?.excludeDomains?.length) {
        body.excludeDomains = options.excludeDomains;
      }

      const response = await fetchWithRetry(
        `${EXA_API_BASE}/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey!,
          },
          body: JSON.stringify(body),
        },
        { maxAttempts: 2, timeoutMs: this.config.timeoutMs || 30000 }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const results = data?.results || [];
      if (!Array.isArray(results)) return [];

      return results
        .filter((r: { url?: string }) => r.url)
        .map(
          (r: {
            url?: string;
            title?: string;
            text?: string;
            publishedDate?: string;
          }) =>
            ({
              id: `exa-search-${crypto.randomUUID().slice(0, 8)}`,
              url: r.url!,
              provider: "exa",
              title: r.title,
              snippet: extractSnippet(r.text || ""),
              content: r.text,
              fetchedAt: new Date().toISOString(),
              freshnessDays: r.publishedDate
                ? daysSince(r.publishedDate)
                : undefined,
            }) as ResearchSource
        );
    } catch {
      return [];
    }
  }

  async discover(url: string): Promise<string[]> {
    await this.initialize();
    try {
      const response = await fetchWithRetry(
        `${EXA_API_BASE}/findSimilar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey!,
          },
          body: JSON.stringify({
            url,
            numResults: 5,
          }),
        },
        { maxAttempts: 1, timeoutMs: this.config.timeoutMs || 15000 }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const results = data?.results || [];
      if (!Array.isArray(results)) return [];

      return results
        .filter((r: { url?: string }) => r.url)
        .map((r: { url: string }) => r.url);
    } catch {
      return [];
    }
  }

  estimatedCostPerRequest() {
    return { credits: 2, usd: 0.02 };
  }
}

function extractSnippet(text: string): string | undefined {
  const cleaned = text.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned.slice(0, 300) || undefined;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86400000));
}
