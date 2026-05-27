/**
 * Phase 9: TinyFishProvider
 *
 * Wraps the existing tinyfish.ts functions in the ResearchProvider interface.
 * This preserves backward compatibility while enabling the Provider architecture.
 */

import type { ResearchProvider, ResearchProviderConfig } from "./types";
import type { ResearchSource, SourceProvider } from "../types";
import {
  enrich,
  fetchRecentActivity,
  enrichCompany,
  discoverProfiles,
} from "@/lib/tinyfish";

export class TinyFishProvider implements ResearchProvider {
  readonly name: SourceProvider = "tinyfish";
  private initialized = false;
  private config: ResearchProviderConfig;

  constructor(config?: ResearchProviderConfig) {
    this.config = config || {};
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const apiKey = this.config.apiKey || process.env.TINYFISH_API_KEY;
    if (!apiKey) {
      console.warn(
        "[TinyFishProvider] TINYFISH_API_KEY not configured — some features may fail"
      );
    }
    this.initialized = true;
  }

  async enrichUrl(url: string): Promise<ResearchSource | null> {
    await this.initialize();
    try {
      const results = await enrich([url], { discoverRelated: false });
      const result = results.find((r) => r.success);
      if (!result) return null;

      return {
        id: `tf-${crypto.randomUUID().slice(0, 8)}`,
        url: result.url,
        provider: "tinyfish",
        title: extractTitle(result.markdown),
        snippet: extractSnippet(result.markdown),
        content: result.markdown,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async search(
    _query: string,
    _options?: { maxResults?: number; recencyDays?: number }
  ): Promise<ResearchSource[]> {
    await this.initialize();
    // TinyFish search is accessed through fetchRecentActivity and enrichCompany
    // For structured search, we return empty and let Firecrawl/EXA handle it
    return [];
  }

  async discover(url: string): Promise<string[]> {
    await this.initialize();
    try {
      const discovery = await discoverProfiles(url);
      return discovery.discoveredProfiles.map((p) => p.url);
    } catch {
      return [];
    }
  }

  async fetchRecentActivity(url: string): Promise<ResearchSource | null> {
    await this.initialize();
    try {
      const activity = await fetchRecentActivity(url);
      if (!activity) return null;
      return {
        id: `tf-act-${crypto.randomUUID().slice(0, 8)}`,
        url,
        provider: "tinyfish",
        title: `Recent Activity (${activity.source})`,
        content: activity.markdown,
        fetchedAt: new Date().toISOString(),
        freshnessDays: 0,
      };
    } catch {
      return null;
    }
  }

  async enrichCompany(name: string): Promise<ResearchSource | null> {
    await this.initialize();
    try {
      const ctx = await enrichCompany(name);
      if (!ctx) return null;
      return {
        id: `tf-company-${crypto.randomUUID().slice(0, 8)}`,
        url: `company:${name}`,
        provider: "tinyfish",
        title: `Company Context: ${name}`,
        content: ctx,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  estimatedCostPerRequest(): { credits: number; usd: number } {
    return { credits: 1, usd: 0.005 };
  }
}

function extractTitle(markdown: string): string | undefined {
  const firstLine = markdown.split("\n")[0]?.trim();
  if (firstLine && firstLine.startsWith("#")) {
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
