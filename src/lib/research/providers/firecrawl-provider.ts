/**
 * Phase 9: FirecrawlProvider
 *
 * Provides structured web content extraction via Firecrawl API.
 * Handles LinkedIn profiles, GitHub repos, company pages, articles.
 */

import type { ResearchProvider, ResearchProviderConfig } from "./types";
import type { ResearchSource, SourceProvider } from "../types";
import { fetchWithRetry } from "@/lib/retry";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v1";

export class FirecrawlProvider implements ResearchProvider {
  readonly name: SourceProvider = "firecrawl";
  private apiKey: string | undefined;
  private initialized = false;
  private config: ResearchProviderConfig;

  constructor(config?: ResearchProviderConfig) {
    this.config = config || {};
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.apiKey = this.config.apiKey || process.env.FIRECRAWL_API_KEY;
    if (!this.apiKey) {
      console.warn("[FirecrawlProvider] FIRECRAWL_API_KEY not configured");
      throw new Error("FirecrawlProvider requires FIRECRAWL_API_KEY");
    }
    this.initialized = true;
  }

  async enrichUrl(url: string): Promise<ResearchSource | null> {
    await this.initialize();
    try {
      const response = await fetchWithRetry(
        `${FIRECRAWL_API_BASE}/scrape`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            url,
            formats: ["markdown", "metadata"],
            onlyMainContent: true,
          }),
        },
        { maxAttempts: 2, timeoutMs: this.config.timeoutMs || 30000 }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const result = data?.data;
      if (!result) return null;

      const markdown = result.markdown || "";
      if (!markdown.trim()) return null;

      return {
        id: `fc-${crypto.randomUUID().slice(0, 8)}`,
        url,
        provider: "firecrawl",
        title: result.metadata?.title || extractTitle(markdown),
        snippet: result.metadata?.description || extractSnippet(markdown),
        content: markdown,
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
        maxResults: options?.maxResults || 5,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      };

      if (options?.recencyDays) {
        const since = new Date();
        since.setDate(since.getDate() - options.recencyDays);
        body.after = since.toISOString();
      }

      const response = await fetchWithRetry(
        `${FIRECRAWL_API_BASE}/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
        { maxAttempts: 2, timeoutMs: this.config.timeoutMs || 30000 }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const results = data?.data || [];
      if (!Array.isArray(results)) return [];

      return results
        .filter((r: { url?: string }) => r.url)
        .map(
          (r: {
            url?: string;
            markdown?: string;
            title?: string;
            description?: string;
          }) =>
            ({
              id: `fc-search-${crypto.randomUUID().slice(0, 8)}`,
              url: r.url!,
              provider: "firecrawl",
              title: r.title,
              snippet: r.description,
              content: r.markdown,
              fetchedAt: new Date().toISOString(),
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
        `${FIRECRAWL_API_BASE}/crawl`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            url,
            maxPages: 3,
            scrapeOptions: { formats: ["links"], onlyMainContent: true },
          }),
        },
        { maxAttempts: 1, timeoutMs: this.config.timeoutMs || 20000 }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const links = data?.data?.links || [];
      return Array.isArray(links) ? links.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  estimatedCostPerRequest() {
    return { credits: 1, usd: 0.01 };
  }
}

function extractTitle(markdown: string): string | undefined {
  const firstLine = markdown.split("\n")[0]?.trim();
  if (firstLine?.startsWith("#")) {
    return firstLine.replace(/^#+\s*/, "").trim();
  }
  return firstLine?.slice(0, 80) || undefined;
}

function extractSnippet(markdown: string): string | undefined {
  const lines = markdown
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter((l) => l.length > 20);
  return lines[0]?.slice(0, 200) || undefined;
}
