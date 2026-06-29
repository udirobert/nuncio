/**
 * Phase 9: FirecrawlProvider
 *
 * Provides structured web content extraction via Firecrawl API.
 * Handles LinkedIn profiles, GitHub repos, company pages, articles.
 *
 * Capabilities:
 *   - enrichUrl()     — /v1/scrape with markdown + metadata
 *   - search()        — /v1/search semantic web search
 *   - discover()      — /v1/crawl (legacy, use mapSite for speed)
 *   - extractStructured() — /v1/scrape with json format (LLM extraction)
 *   - mapSite()       — /v1/map fast site URL enumeration
 *
 * All responses are cached in-memory with a TTL to avoid re-scraping
 * the same prospect within a session.
 */

import type { ResearchProvider, ResearchProviderConfig } from "./types";
import type {
  ResearchProviderWithExtract,
  ResearchProviderWithMap,
  ExtractSchema,
  StructuredExtraction,
} from "./types";
import type { ResearchSource, SourceProvider } from "../types";
import { fetchWithRetry } from "@/lib/retry";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Module-level cache (shared across all FirecrawlProvider instances) ──

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const scrapeCache = new Map<string, CacheEntry<ResearchSource | null>>();
const searchCache = new Map<string, CacheEntry<ResearchSource[]>>();
const mapCache = new Map<string, CacheEntry<string[]>>();
const extractCache = new Map<string, CacheEntry<StructuredExtraction | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ── Provider ──────────────────────────────────────────────────────────

export class FirecrawlProvider
  implements ResearchProvider, ResearchProviderWithExtract, ResearchProviderWithMap
{
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

  // ── Scrape (markdown + metadata) ────────────────────────────────────

  async enrichUrl(url: string): Promise<ResearchSource | null> {
    await this.initialize();

    const cached = getCached(scrapeCache, url);
    if (cached !== undefined) return cached;

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

      if (!response.ok) {
        setCached(scrapeCache, url, null);
        return null;
      }

      const data = await response.json();
      const result = data?.data;
      if (!result) {
        setCached(scrapeCache, url, null);
        return null;
      }

      const markdown = result.markdown || "";
      if (!markdown.trim()) {
        setCached(scrapeCache, url, null);
        return null;
      }

      const source: ResearchSource = {
        id: `fc-${crypto.randomUUID().slice(0, 8)}`,
        url,
        provider: "firecrawl",
        title: result.metadata?.title || extractTitle(markdown),
        snippet: result.metadata?.description || extractSnippet(markdown),
        content: markdown,
        fetchedAt: new Date().toISOString(),
      };

      setCached(scrapeCache, url, source);
      return source;
    } catch {
      setCached(scrapeCache, url, null);
      return null;
    }
  }

  // ── Semantic search ─────────────────────────────────────────────────

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

    const cacheKey = `${query}:${options?.maxResults || 5}:${options?.recencyDays || 0}`;
    const cached = getCached(searchCache, cacheKey);
    if (cached) return cached;

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

      if (!response.ok) {
        setCached(searchCache, cacheKey, []);
        return [];
      }

      const data = await response.json();
      const results = data?.data || [];
      if (!Array.isArray(results)) {
        setCached(searchCache, cacheKey, []);
        return [];
      }

      const sources = results
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

      setCached(searchCache, cacheKey, sources);
      return sources;
    } catch {
      setCached(searchCache, cacheKey, []);
      return [];
    }
  }

  // ── Crawl (legacy discovery — prefer mapSite for speed) ─────────────

  async discover(url: string): Promise<string[]> {
    await this.initialize();

    const cached = getCached(mapCache, `crawl:${url}`);
    if (cached) return cached;

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

      if (!response.ok) {
        setCached(mapCache, `crawl:${url}`, []);
        return [];
      }

      const data = await response.json();
      const links = data?.data?.links || [];
      const result = Array.isArray(links) ? links.filter(Boolean) : [];
      setCached(mapCache, `crawl:${url}`, result);
      return result;
    } catch {
      setCached(mapCache, `crawl:${url}`, []);
      return [];
    }
  }

  // ── Map (fast URL enumeration — no content fetch, just URLs) ─────────

  async mapSite(
    url: string,
    options?: { search?: string; limit?: number }
  ): Promise<string[]> {
    await this.initialize();

    const cacheKey = `map:${url}:${options?.search || ""}:${options?.limit || 50}`;
    const cached = getCached(mapCache, cacheKey);
    if (cached) return cached;

    try {
      const body: Record<string, unknown> = {
        url,
        limit: options?.limit || 50,
        includeSubdomains: true,
      };

      if (options?.search) {
        body.search = options.search;
      }

      const response = await fetchWithRetry(
        `${FIRECRAWL_API_BASE}/map`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
        { maxAttempts: 2, timeoutMs: this.config.timeoutMs || 20000 }
      );

      if (!response.ok) {
        setCached(mapCache, cacheKey, []);
        return [];
      }

      const data = await response.json();
      const links = data?.links || data?.data?.links || [];
      const result = Array.isArray(links) ? links.filter(Boolean) : [];
      setCached(mapCache, cacheKey, result);
      return result;
    } catch {
      setCached(mapCache, cacheKey, []);
      return [];
    }
  }

  // ── Structured extraction (LLM-powered scrape with json format) ─────

  async extractStructured(
    url: string,
    schema: ExtractSchema,
    prompt: string
  ): Promise<StructuredExtraction | null> {
    await this.initialize();

    const cacheKey = `${url}:${JSON.stringify(schema)}`;
    const cached = getCached(extractCache, cacheKey);
    if (cached !== undefined) return cached;

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
            formats: ["markdown", "json"],
            onlyMainContent: true,
            jsonOptions: {
              prompt,
              schema: buildJsonSchema(schema),
            },
          }),
        },
        { maxAttempts: 2, timeoutMs: this.config.timeoutMs || 45000 }
      );

      if (!response.ok) {
        setCached(extractCache, cacheKey, null);
        return null;
      }

      const data = await response.json();
      const result = data?.data;
      if (!result) {
        setCached(extractCache, cacheKey, null);
        return null;
      }

      const extracted = result.json || result.extract;
      if (!extracted || typeof extracted !== "object") {
        setCached(extractCache, cacheKey, null);
        return null;
      }

      const extraction: StructuredExtraction = {
        data: extracted as Record<string, unknown>,
        sourceUrl: url,
      };

      setCached(extractCache, cacheKey, extraction);
      return extraction;
    } catch {
      setCached(extractCache, cacheKey, null);
      return null;
    }
  }

  estimatedCostPerRequest() {
    return { credits: 1, usd: 0.01 };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildJsonSchema(schema: ExtractSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    const prop: Record<string, unknown> = { type: def.type, description: def.description };
    if (def.type === "array" && def.items) {
      prop.items = { type: def.items.type };
    }
    properties[key] = prop;
  }
  return {
    type: "object",
    properties,
  };
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
