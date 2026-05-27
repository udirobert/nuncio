/**
 * Phase 9: Research Provider Interface
 *
 * All data providers (TinyFish, Firecrawl, EXA) implement this interface
 * so the ResearchOrchestrator can treat them uniformly.
 */

import type { ResearchSource, SourceProvider } from "../types";

export interface ResearchProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ResearchProvider {
  readonly name: SourceProvider;

  /** Initialize the provider (validate API key, warm up connection) */
  initialize(): Promise<void>;

  /** Enrich a single URL — return structured content */
  enrichUrl(url: string): Promise<ResearchSource | null>;

  /** Semantic search — find relevant content across the web */
  search(
    query: string,
    options?: {
      maxResults?: number;
      recencyDays?: number;
      categories?: string[];
      excludeDomains?: string[];
    }
  ): Promise<ResearchSource[]>;

  /** Discover related profiles/pages from a primary URL */
  discover(url: string): Promise<string[]>;

  /** Get estimated cost for this provider */
  estimatedCostPerRequest(): { credits: number; usd: number };
}
