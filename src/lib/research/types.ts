/**
 * Phase 9: Canonical Research Schema
 *
 * These types represent the structured output of the research pipeline.
 * They are distinct from the UI-friendly types in claude.ts (TopicalAngle,
 * RelevanceSignal, SourceAttribution) which are derived from these.
 */

import type { TopicalAngle } from "@/lib/claude";

export type QualityTier = "quick" | "balanced" | "deep";

export type SourceProvider = "tinyfish" | "firecrawl" | "exa" | "web-search";

export type ConfidenceLevel = "high" | "medium" | "low" | "speculative";

export interface ResearchSource {
  id: string;
  url: string;
  provider: SourceProvider;
  title?: string;
  snippet?: string;
  content?: string; // Full markdown content
  fetchedAt: string; // ISO timestamp
  freshnessDays?: number; // How old this source is
}

export interface ResearchClaim {
  id: string;
  entity: string; // Person, company, product name
  claim: string; // What was said/inferred
  excerpt: string; // Direct quote or evidence
  sourceUrl: string;
  provider: SourceProvider;
  confidence: ConfidenceLevel;
  relevanceScore?: number; // 0-1, ranked by relevance to outreach goal
  relevanceReason?: string; // Why this claim matters for this outreach
  timestamp?: string; // When the claim was made/published
  category?:
    | "role"
    | "achievement"
    | "interest"
    | "recent_activity"
    | "company_news"
    | "thought_leadership"
    | "personal_fact";
}

/**
 * TopicalAngle is defined in src/lib/claude.ts as the UI-facing type.
 * The canonical ResearchResult references it by importing from there.
 * We keep the canonical schema here clean — no duplicated TopicalAngle.
 */

export interface ResearchResult {
  recipientId: string; // URL hash or person ID
  sources: ResearchSource[];
  claims: ResearchClaim[];
  suggestedAngles: TopicalAngle[];
  qualityTier: QualityTier;
  totalSourcesScanned: number;
  providerBreakdown: Record<SourceProvider, number>;
  completedAt: string;
}
