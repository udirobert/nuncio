/**
 * Phase 9: Research Orchestrator
 *
 * Coordinates multiple ResearchProviders (TinyFish, Firecrawl, EXA) to
 * produce a unified ResearchResult with structured claims and suggested
 * outreach angles from LLM synthesis.
 *
 * Architecture:
 *   ResearchOrchestrator.research(url)
 *     ├─ initialize()      — lazy-load providers by user tier
 *     ├─ discover()        — collect URLs from all providers
 *     ├─ enrich()          — fetch content for every discovered URL
 *     ├─ search()          — Firecrawl/EXA semantic search
 *     ├─ fetchRecentActivity() — TinyFish-specific social feed
 *     ├─ deduplicateSources()
 *     ├─ extractClaims()   — LLM: raw sources → structured claims
 *     └─ generateAngles()  — LLM: claims → ranked outreach angles
 */

import type {
  QualityTier,
  ResearchSource,
  ResearchClaim,
  ResearchResult,
  SourceProvider,
  ConfidenceLevel,
} from "./types";
import type { ResearchProvider, ResearchProviderConfig } from "./providers/types";
import type { TopicalAngle } from "@/lib/claude";
import { chatCompletion } from "@/lib/llm";
import { TinyFishProvider } from "./providers/tinyfish-provider";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ResearchOrchestratorConfig {
  qualityTier: QualityTier;
  userTier: "trial" | "free" | "pro" | "studio";
  enableDeepResearch?: boolean;
  senderBrief?: string;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class ResearchOrchestrator {
  private config: ResearchOrchestratorConfig;
  private providers: ResearchProvider[] = [];
  private initialized = false;

  constructor(config: ResearchOrchestratorConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // TinyFish is always available
    this.providers.push(new TinyFishProvider());

    // Firecrawl — Pro+
    if (
      this.config.enableDeepResearch &&
      process.env.FIRECRAWL_API_KEY &&
      this.config.userTier !== "free" &&
      this.config.userTier !== "trial"
    ) {
      try {
        const { FirecrawlProvider } = await import("./providers/firecrawl-provider");
        this.providers.push(new FirecrawlProvider());
      } catch {
        console.warn("[Orchestrator] Failed to load FirecrawlProvider");
      }
    }

    // EXA — Studio only
    if (
      this.config.enableDeepResearch &&
      process.env.EXA_API_KEY &&
      this.config.userTier === "studio"
    ) {
      try {
        const { ExaProvider } = await import("./providers/exa-provider");
        this.providers.push(new ExaProvider());
      } catch {
        console.warn("[Orchestrator] Failed to load ExaProvider");
      }
    }

    await Promise.allSettled(
      this.providers.map((p) => p.initialize().catch(() => {}))
    );

    this.initialized = true;
  }

  async research(url: string): Promise<ResearchResult> {
    await this.initialize();

    // 1. Discover related URLs from every provider
    const discoveredUrls = await this.discoverUrls(url);

    // 2. Enrich every discovered URL via every provider
    const allSources: ResearchSource[] = [];
    for (const provider of this.providers) {
      const results = await Promise.allSettled(
        Array.from(discoveredUrls).map((u) => provider.enrichUrl(u))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          allSources.push(r.value);
        }
      }
    }

    // 3. Semantic search (Firecrawl / EXA only)
    for (const provider of this.providers.filter(
      (p) => p.name === "firecrawl" || p.name === "exa"
    )) {
      const queries = this.buildSearchQueries(url);
      for (const q of queries) {
        const results = await provider.search(q, { maxResults: 5 }).catch(() => []);
        allSources.push(...results);
      }
    }

    // 4. TinyFish-specific recent activity fetch
    const tfProvider = this.providers.find(
      (p) => p.name === "tinyfish"
    ) as TinyFishProvider | undefined;
    if (tfProvider?.fetchRecentActivity) {
      const activity = await tfProvider
        .fetchRecentActivity(url)
        .catch(() => null);
      if (activity) allSources.push(activity);
    }

    // 5. Deduplicate
    const normalized = this.deduplicateSources(allSources);

    // 6. LLM: extract structured claims
    const claims = await this.extractClaims(normalized);

    // 7. LLM: generate ranked outreach angles
    const angles = claims.length > 0 ? await this.generateAngles(claims) : [];

    return {
      recipientId: this.hashUrl(url),
      sources: normalized,
      claims,
      suggestedAngles: angles,
      qualityTier: this.config.qualityTier,
      totalSourcesScanned: normalized.length,
      providerBreakdown: this.countByProvider(normalized),
      completedAt: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // URL discovery
  // -----------------------------------------------------------------------

  private async discoverUrls(seedUrl: string): Promise<Set<string>> {
    const urls = new Set<string>([seedUrl]);
    for (const provider of this.providers) {
      const discovered = await provider.discover(seedUrl).catch(() => [] as string[]);
      for (const u of discovered) urls.add(u);
    }
    return urls;
  }

  // -----------------------------------------------------------------------
  // Search query builder
  // -----------------------------------------------------------------------

  private buildSearchQueries(url: string): string[] {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");
      const slug = parsed.pathname.split("/")[1];
      if (slug) {
        return [`"${slug}" interview podcast`, `"${slug}" thought leadership`];
      }
      return [`"${host}" thought leadership`];
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Deduplication — keep the source with the most content
  // -----------------------------------------------------------------------

  private deduplicateSources(sources: ResearchSource[]): ResearchSource[] {
    const seen = new Map<string, ResearchSource>();
    for (const s of sources) {
      const existing = seen.get(s.url);
      if (!existing || (s.content?.length || 0) > (existing.content?.length || 0)) {
        seen.set(s.url, s);
      }
    }
    return Array.from(seen.values());
  }

  // -----------------------------------------------------------------------
  // Hashing & counting helpers
  // -----------------------------------------------------------------------

  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i);
      hash |= 0; // Convert to 32-bit int
    }
    return Math.abs(hash).toString(16).slice(0, 12);
  }

  private countByProvider(
    sources: ResearchSource[]
  ): Record<SourceProvider, number> {
    const counts: Record<string, number> = {};
    for (const s of sources) {
      counts[s.provider] = (counts[s.provider] || 0) + 1;
    }
    return counts as Record<SourceProvider, number>;
  }

  // -----------------------------------------------------------------------
  // LLM: Extract structured claims from raw sources
  // -----------------------------------------------------------------------

  private async extractClaims(sources: ResearchSource[]): Promise<ResearchClaim[]> {
    if (sources.length === 0) return [];

    const sourceText = sources
      .map(
        (s, i) =>
          `Source ${i + 1}: ${(s.content || "").slice(0, 2000)}`
      )
      .join("\n\n---\n\n");

    const systemPrompt = `You are a research analyst. Extract factual claims from the provided sources.

Return a JSON array of objects with these fields:
- entity: The person, company, or product name the claim is about
- claim: What was said or inferred
- excerpt: Direct quote or evidence (max 150 chars)
- sourceUrl: The URL of the source
- provider: The provider name (tinyfish, firecrawl, exa, or web-search)
- confidence: "high" | "medium" | "low" | "speculative"
- relevanceScore: 0-1, how relevant this claim is for an outreach personalisation
- relevanceReason: Why this claim matters
- category: "role" | "achievement" | "interest" | "recent_activity" | "company_news" | "thought_leadership" | "personal_fact"

Respond ONLY with raw JSON. No markdown code blocks.`;

    try {
      const raw = await chatCompletion(systemPrompt, sourceText, {
        maxTokens: 4000,
      });
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.map(
        (c: Record<string, unknown>, idx: number): ResearchClaim => ({
          id: `c-${idx}-${Math.random().toString(36).slice(2, 10)}`,
          entity: String(c.entity || ""),
          claim: String(c.claim || ""),
          excerpt: String(c.excerpt || "").slice(0, 150),
          sourceUrl: String(c.sourceUrl || ""),
          provider: (c.provider as SourceProvider) || "web-search",
          confidence: (c.confidence as ConfidenceLevel) || "medium",
          relevanceScore: Number(c.relevanceScore) || 0.5,
          relevanceReason: String(c.relevanceReason || ""),
          category: c.category as ResearchClaim["category"],
        })
      );
    } catch (err) {
      console.warn("[Orchestrator] extractClaims failed:", err);
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // LLM: Generate ranked outreach angles from claims
  // -----------------------------------------------------------------------

  private async generateAngles(claims: ResearchClaim[]): Promise<TopicalAngle[]> {
    if (claims.length === 0) return [];

    const claimText = claims
      .map((c, i) => `${i + 1}. ${c.entity}: ${c.claim}`)
      .join("\n");

    const systemPrompt = `You are an outreach strategist. Given a list of claims about a person, generate 2-4 ranked outreach angles.

Return a JSON array of objects with these fields:
- id: A unique string identifier
- label: Short 3-5 word label for this angle
- description: 1-2 sentence explanation of the angle
- evidence: Specific evidence from the claims (max 200 chars)
- confidence: "high" | "medium" | "low"
- relevanceToOutreach: Why this angle works for personalised outreach
- suggestedArchetype: Which hook archetype fits best: "mirror" | "origin" | "inside_joke" | "future_cast" | "day_in_the_life"

Favor angles that are specific, recent, and show you've done your homework.

Respond ONLY with raw JSON. No markdown code blocks.`;

    try {
      const raw = await chatCompletion(systemPrompt, claimText, {
        maxTokens: 2000,
      });
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((a: Record<string, unknown>, idx: number) => ({
        id: String(a.id ?? `a-${idx}-${Math.random().toString(36).slice(2, 10)}`),
        label: String(a.label || ""),
        description: String(a.description || ""),
        evidence: String(a.evidence || "").slice(0, 200),
        confidence: (a.confidence || "medium") as TopicalAngle["confidence"],
        relevanceToOutreach: String(a.relevanceToOutreach || ""),
        suggestedArchetype: a.suggestedArchetype as string | undefined,
      }));
    } catch (err) {
      console.warn("[Orchestrator] generateAngles failed:", err);
      return [];
    }
  }
}
