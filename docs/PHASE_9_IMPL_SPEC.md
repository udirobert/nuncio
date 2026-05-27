# Phase 9: Intelligence Layer, Sender Memory & Premium Research Architecture

**Goal:** Move Nuncio from ~7.5/10 to ~9/10 across UX coherence, intuitiveness, trust, and architecture maturity.

**Target state:** Users understand *why* the output is good, *what* the system inferred, *how* to improve it, and *what extra depth* a paid tier unlocks.

---

## Part 1: Product Flow Redesign

### 1.1 Core Promise (copy updates needed)

**New one-liner:** "Tell us who you want to reach, what you want from them, and Nuncio finds the strongest public context to create a video that feels made for them."

**Every result should explain:**
- Why this person is a fit (sender → recipient match)
- Why this angle was chosen (relevance to the outreach goal)
- What evidence supports it (source attribution)
- What is fact vs inference (confidence labels)

### 1.2 Quality Ladder (new UI concept)

```typescript
// New type to add to the pipeline
type QualityTier = "quick" | "balanced" | "deep"
```

- **Quick:** URL → direct profile enrichment → 1 script → build (current fast path)
- **Balanced:** URL + brief → enrichment + recent activity + company context → 2 hooks → review (current default with minor expansions)
- **Deep:** URL + full sender profile + outreach intent → TinyFish + Firecrawl + EXA → ranked relevance signals → 3 suggested angles → 2 script variants → full source attribution → build

### 1.3 Progressive Disclosure Input Form

**Phase 9 input form (refactor `QuickInput` + `studio-client.tsx` advanced panel):**

```
Stage 1: Required (always visible)
├─ Profile URL(s)                 [url]
├─ Your name                      [senderName]
├─ What do you want? (brief)      [senderBrief]
└─ "Build video" button

Stage 2: Progressive (collapsed, "Add context")
├─ Your business                  [senderBusiness]
├─ Your offer                     [senderOffer]
├─ Who is your target audience?   [senderAudience]
└─ Relationship warmth            [relationshipWarmth: cold | warm | existing]

Stage 3: Advanced (collapsed, "Deep research")
├─ Outreach goal                  [outreachGoal]
├─ Desired outcome                [desiredOutcome]
├─ Why now?                       [reasonForReachingOutNow]
├─ Hook archetype override        [archetype]
├─ Proof points                   [senderProofPoints]
├─ Tone preference                [tonePreference]
├─ Your brand personality         [senderBrand]
└─ Your brand personality description [senderPersonality]

Stage 4: Premium (gated)
├─ "Deep research" toggle ────→ unlocks Firecrawl + EXA enrichment
├─ "Multi-angle" toggle ──────→ generates 3 ranked angles
└─ "Full source citations" ───→ shows all evidence links with confidence
```

---

## Part 2: New Data Models

### 2.1 Canonical Research Schema

```typescript
// src/lib/research/types.ts (NEW FILE)

export type SourceProvider = "tinyfish" | "firecrawl" | "exa" | "web-search"
export type ConfidenceLevel = "high" | "medium" | "low" | "speculative"

export interface ResearchSource {
  id: string
  url: string
  provider: SourceProvider
  title?: string
  snippet?: string
  content?: string         // Full markdown content
  fetchedAt: string        // ISO timestamp
  freshnessDays?: number   // How old this source is
}

export interface ResearchClaim {
  id: string
  entity: string           // Person, company, product name
  claim: string            // What was said/inferred
  excerpt: string          // Direct quote or evidence
  sourceUrl: string
  provider: SourceProvider
  confidence: ConfidenceLevel
  relevanceScore?: number  // 0-1, ranked by relevance to outreach goal
  relevanceReason?: string // Why this claim matters for this outreach
  timestamp?: string       // When the claim was made/published
  category?: "role" | "achievement" | "interest" | "recent_activity" | "company_news" | "thought_leadership" | "personal_fact"
}

export interface TopicalAngle {
  id: string
  label: string            // Short name e.g. "Recent AI talk"
  description: string      // Why this angle works
  evidence: string         // What supports it
  supportingClaims: string[] // ResearchClaim IDs
  confidence: ConfidenceLevel
  relevanceToOutreach: string
  suggestedArchetype?: string // Which hook archetype fits best
}

export interface ResearchResult {
  recipientId: string      // URL hash or person ID
  sources: ResearchSource[]
  claims: ResearchClaim[]
  suggestedAngles: TopicalAngle[]
  qualityTier: QualityTier
  totalSourcesScanned: number
  providerBreakdown: Record<SourceProvider, number>
  completedAt: string
}
```

### 2.2 Enhanced Sender Profile (persistent)

```typescript
// Extend existing WorkspaceAccount in src/lib/storage/types.ts

// Already exists: lastSenderBrief, lastSenderName
// Add these fields to WorkspaceAccount:

export interface WorkspaceAccount {
  // ... existing fields ...
  lastSenderBrief?: string
  lastSenderName?: string
  
  // NEW FIELDS for Phase 9:
  senderProfile?: SenderProfileJSON  // JSON-serialized SenderProfile
  senderBusiness?: string
  senderBrand?: string
  senderPersonality?: string
  senderAudience?: string
  senderOffer?: string
  senderProofPoints?: string[]
  relationshipWarmth?: "cold" | "warm" | "existing"
  tonePreference?: string
  deepResearchEnabled?: boolean
  premiumResearchCreditsUsed?: number
  premiumResearchCreditsLimit?: number
}

// Where SenderProfileJSON = string (JSON.stringify of SenderProfile from claude.ts)
```

### 2.3 Enhanced Profile (extend existing)

```typescript
// Extend Profile in src/lib/claude.ts

export interface Profile {
  // ... existing fields ...
  
  // NEW FIELDS for Phase 9:
  researchTier?: QualityTier
  sources?: ResearchSource[]
  claims?: ResearchClaim[]
  suggestedAngles?: TopicalAngle[]
  sourceAttribution?: {
    factCount: number
    inferenceCount: number
    sourcesScanned: number
  }
}
```

---

## Part 3: Provider Architecture

### 3.1 Research Provider Interface

```typescript
// src/lib/research/providers/types.ts (NEW FILE)

import type { ResearchSource, SourceProvider } from "../types"

export interface ResearchProviderConfig {
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
}

export interface ResearchProvider {
  readonly name: SourceProvider
  
  /** Initialize the provider (validate API key, warm up connection) */
  initialize(): Promise<void>
  
  /** Enrich a single URL - return structured content */
  enrichUrl(url: string): Promise<ResearchSource | null>
  
  /** Semantic search - find relevant content across the web */
  search(query: string, options?: {
    maxResults?: number
    recencyDays?: number
    categories?: string[]
    excludeDomains?: string[]
  }): Promise<ResearchSource[]>
  
  /** Discover related profiles/pages from a primary URL */
  discover(url: string): Promise<string[]>
  
  /** Get estimated cost for this provider */
  estimatedCostPerRequest(): { credits: number; usd: number }
}
```

### 3.2 TinyFishProvider (refactor existing)

```typescript
// src/lib/research/providers/tinyfish-provider.ts (REFACTOR from tinyfish.ts)
// 
// Keep existing enrich(), discoverProfiles(), fetchRecentActivity(), enrichCompany()
// Wrap them in the ResearchProvider interface
// Add caching layer that's already in MemoryCache
```

### 3.3 FirecrawlProvider (NEW)

```typescript
// src/lib/research/providers/firecrawl-provider.ts (NEW FILE)

import type { ResearchProvider, ResearchProviderConfig } from "./types"
import type { ResearchSource } from "../types"

export class FirecrawlProvider implements ResearchProvider {
  readonly name = "firecrawl"
  
  constructor(config?: ResearchProviderConfig) {}
  
  async initialize(): Promise<void> {
    // Validate FIRECRAWL_API_KEY env var
    // Test endpoint connectivity
  }
  
  async enrichUrl(url: string): Promise<ResearchSource | null> {
    // POST https://api.firecrawl.dev/v1/scrape
    // Returns full page markdown + metadata
    // Handles:
    //   - LinkedIn profiles (structured person data)
    //   - GitHub profiles (README, pinned repos)
    //   - Company pages (about, team, product)
    //   - Blog posts, articles
    //   - Personal websites
  }
  
  async search(query: string, options?: {
    maxResults?: number
    recencyDays?: number
    categories?: string[]
  }): Promise<ResearchSource[]> {
    // POST https://api.firecrawl.dev/v1/search
    // Returns search results with page content
    // Filters by recency, category, domain
  }
  
  async discover(url: string): Promise<string[]> {
    // POST https://api.firecrawl.dev/v1/crawl
    // Crawl a website for related pages:
    //   - About page
    //   - Team page
    //   - Blog
    //   - Social links
    // Returns discovered URLs for further enrichment
  }
  
  estimatedCostPerRequest() {
    return { credits: 1, usd: 0.01 }
  }
}
```

### 3.4 ExaProvider (NEW)

```typescript
// src/lib/research/providers/exa-provider.ts (NEW FILE)

import type { ResearchProvider, ResearchProviderConfig } from "./types"
import type { ResearchSource } from "../types"

export class ExaProvider implements ResearchProvider {
  readonly name = "exa"
  
  constructor(config?: ResearchProviderConfig) {}
  
  async initialize(): Promise<void> {
    // Validate EXA_API_KEY env var
  }
  
  async enrichUrl(url: string): Promise<ResearchSource | null> {
    // POST https://api.exa.ai/v1/contents
    // Returns structured page content
    // Use for known URLs that need deeper extraction
  }
  
  async search(query: string, options?: {
    maxResults?: number
    recencyDays?: number
    categories?: string[]
    excludeDomains?: string[]
  }): Promise<ResearchSource[]> {
    // POST https://api.exa.ai/v1/search
    // Semantic search across the web
    // Key use cases:
    //   - "Person interview podcast 2024" 
    //   - "Person thought leadership AI"
    //   - "Company funding news 2024"
    //   - "Person talk conference 2025"
    //   - Find personal websites, blogs, GitHub repos
    // Returns rich results with highlights
  }
  
  async discover(url: string): Promise<string[]> {
    // Use EXA's semantic similarity to find related pages
    // POST https://api.exa.ai/v1/findSimilar
    // Returns URLs of semantically similar pages
  }
  
  estimatedCostPerRequest() {
    return { credits: 2, usd: 0.02 }
  }
}
```

### 3.5 Research Orchestrator (NEW)

```typescript
// src/lib/research/orchestrator.ts (NEW FILE)

import type { QualityTier } from "./types"
import type { ResearchProvider } from "./providers/types"
import { TinyFishProvider } from "./providers/tinyfish-provider"
import { FirecrawlProvider } from "./providers/firecrawl-provider"
import { ExaProvider } from "./providers/exa-provider"
import { ResearchResult, ResearchSource, ResearchClaim, TopicalAngle } from "./types"

export interface ResearchOrchestratorConfig {
  qualityTier: QualityTier
  senderBrief?: string
  senderProfile?: SenderProfile
  outreachIntent?: OutreachIntentProfile
  enableFirecrawl: boolean
  enableExa: boolean
  userTier: "free" | "pro" | "studio"
}

export class ResearchOrchestrator {
  private providers: ResearchProvider[]
  
  constructor(config: ResearchOrchestratorConfig) {
    this.providers = []
    
    // TinyFish always runs (it's the base layer)
    this.providers.push(new TinyFishProvider())
    
    // Firecrawl only runs if enabled and user tier allows
    if (config.enableFirecrawl && config.userTier !== "free") {
      this.providers.push(new FirecrawlProvider())
    }
    
    // EXA only runs if enabled and user is pro/studio
    if (config.enableExa && (config.userTier === "pro" || config.userTier === "studio")) {
      this.providers.push(new ExaProvider())
    }
  }
  
  async research(url: string): Promise<ResearchResult> {
    // Step 1: Initialize all providers
    await Promise.all(this.providers.map(p => p.initialize()))
    
    // Step 2: Flood fill - each provider discovers + enriches
    const discoveredUrls = new Set<string>([url])
    
    for (const provider of this.providers) {
      try {
        const moreUrls = await provider.discover(url)
        moreUrls.forEach(u => discoveredUrls.add(u))
      } catch {
        // Non-critical
      }
    }
    
    // Step 3: Batch enrich all discovered URLs
    const allSources: ResearchSource[] = []
    for (const provider of this.providers) {
      const providerUrls = [...discoveredUrls]
      const results = await Promise.allSettled(
        providerUrls.map(u => provider.enrichUrl(u))
      )
      results.forEach(r => {
        if (r.status === "fulfilled" && r.value) allSources.push(r.value)
      })
    }
    
    // Step 4: Semantic search for deeper context (pro+ only)
    if (this.providers.some(p => p.name === "exa" || p.name === "firecrawl")) {
      const searchQueries = this.buildSearchQueries(url, allSources)
      for (const provider of this.providers.filter(p => p.name === "exa" || p.name === "firecrawl")) {
        for (const query of searchQueries) {
          try {
            const results = await provider.search(query, { maxResults: 5 })
            allSources.push(...results)
          } catch { /* non-critical */ }
        }
      }
    }
    
    // Step 5: Normalize & deduplicate sources
    const normalized = this.deduplicateSources(allSources)
    
    // Step 6: Extract claims with confidence scoring
    const claims = this.extractClaims(normalized, url)
    
    // Step 7: Rank by relevance to outreach goal
    const rankedClaims = this.rankByRelevance(claims)
    
    // Step 8: Generate suggested angles
    const angles = this.generateAngles(rankedClaims)
    
    return {
      recipientId: this.hashUrl(url),
      sources: normalized,
      claims: rankedClaims,
      suggestedAngles: angles,
      qualityTier: this.config.qualityTier,
      totalSourcesScanned: normalized.length,
      providerBreakdown: this.countByProvider(normalized),
      completedAt: new Date().toISOString(),
    }
  }
  
  private buildSearchQueries(primaryUrl: string, sources: ResearchSource[]): string[] {
    // Extract person name, company, role from sources
    // Build queries like:
    // - `"{Name}" interview 2024`
    // - `"{Name}" podcast`
    // - `"{Company}" funding news`
    // - `"{Name}" "{role}" "{company}"`
    // Limit to 3-5 queries max
  }
  
  private deduplicateSources(sources: ResearchSource[]): ResearchSource[] {
    // Deduplicate by URL
    // Prefer sources with more content
    // Tag sources with provider info
  }
  
  private extractClaims(sources: ResearchSource[], primaryUrl: string): ResearchClaim[] {
    // Use LLM or heuristic extraction:
    //   - Named entity recognition for person/company/role
    //   - Extract key claims with direct excerpts
    //   - Assign confidence based on:
    //     - Source freshness (recent = higher for activity)
    //     - Source reliability (LinkedIn = high, random blog = medium)
    //     - Claim specificity (vague = lower, specific = higher)
    //     - Multiple sources corroborating (higher)
  }
  
  private rankByRelevance(claims: ResearchClaim[]): ResearchClaim[] {
    // Given sender brief + outreach intent, score each claim 0-1
    // Factors:
    //   - Direct relevance to the outreach goal
    //   - Recency (recent posts > old bio)
    //   - Specificity (concrete > generic)
    //   - Actionability (can the sender reference this in a script)
    // Return sorted by relevanceScore desc
  }
  
  private generateAngles(claims: ResearchClaim[]): TopicalAngle[] {
    // Group claims by category
    // For each category, generate a suggested angle
    // Rank angles by: conviction (strong evidence) + relevance (to brief)
    // Return top 3-5 angles
  }
  
  private hashUrl(url: string): string {
    return crypto.createHash("sha256").update(url).digest("hex").slice(0, 12)
  }
  
  private countByProvider(sources: ResearchSource[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const s of sources) {
      counts[s.provider] = (counts[s.provider] || 0) + 1
    }
    return counts
  }
}
```

---

## Part 4: Tier Gating Rules

### 4.1 Updated Tier Table

Current tier system in `src/lib/hooks/tiers.ts` and `src/lib/billing/accounts.ts`:

```typescript
// Updated tier definitions for Phase 9

const TIER_CONFIG = {
  trial: {
    credits: 10,
    maxUrls: 1,
    researchProviders: ["tinyfish"],
    deepResearch: false,
    multiAngle: false,
    sourceAttribution: false,
    scriptVariants: false,
    senderProfilePersistence: false,
    maxHooks: 1,
    watermark: true,
    maxScriptRegenerations: 0,
  },
  free: {
    credits: 10,           // Same as trial for now
    maxUrls: 2,
    researchProviders: ["tinyfish"],
    deepResearch: false,
    multiAngle: false,
    sourceAttribution: true,   // Free gets basic source attribution
    scriptVariants: false,
    senderProfilePersistence: true, // Free gets memory
    maxHooks: 3,
    watermark: true,
    maxScriptRegenerations: 1,
  },
  pro: {
    credits: 200,           // Existing
    maxUrls: 5,
    researchProviders: ["tinyfish", "firecrawl"],
    deepResearch: true,
    multiAngle: true,
    sourceAttribution: true,
    scriptVariants: true,
    senderProfilePersistence: true,
    senderProfileDepth: "full", // Full sender profile persistence
    maxHooks: 50,
    watermark: false,
    maxScriptRegenerations: 10,
    firecrawlRequestsPerCycle: 50,
  },
  studio: {
    credits: 1000,
    maxUrls: 20,
    researchProviders: ["tinyfish", "firecrawl", "exa"],
    deepResearch: true,
    multiAngle: true,
    sourceAttribution: true,
    scriptVariants: true,
    senderProfilePersistence: true,
    senderProfileDepth: "full",
    maxHooks: 200,
    watermark: false,
    maxScriptRegenerations: -1,  // Unlimited
    firecrawlRequestsPerCycle: 500,
    exaRequestsPerCycle: 200,
  },
}
```

### 4.2 Premium Toggle UX

Add a "Deep Research" toggle in the studio input:

```typescript
// New component: src/components/deep-research-toggle.tsx

interface DeepResearchToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  userTier: "trial" | "free" | "pro" | "studio"
  upgradeRequired: boolean
}

// Logic:
// - trial/free: disabled with "Upgrade to Pro" tooltip
// - pro: enabled, shows "Firecrawl-powered"
// - studio: enabled, shows "EXA + Firecrawl"
```

### 4.3 Credit Cost Updates

```typescript
// Updated in src/lib/billing/credits.ts

const COSTS: Record<CreditAction, number> = {
  // ... existing actions unchanged ...
  
  // NEW actions for Phase 9:
  "research.deep": 3,        // Firecrawl + EXA deep research
  "research.premium": 5,     // Full multi-provider research
  "angle.generation": 1,     // Additional angle suggestions
  "source.attribution": 0,   // Free (just a UI pass)
}
```

---

## Part 5: UI Component Specs

### 5.1 Angle Cards (NEW)

```typescript
// New component: src/components/angle-cards.tsx

interface AngleCardsProps {
  angles: TopicalAngle[]
  selectedAngleId?: string
  onSelect: (angle: TopicalAngle) => void
  isPremium: boolean  // If false, show limited preview
}

// Layout:
// ├── Horizontal scrollable cards
// │   ├── Card 1: "Recent AI talk" [confidence: high]
// │   │   ├── Why: "Just gave a talk on autonomous agents at DevSummit"
// │   │   ├── Evidence: "Source: LinkedIn post, 2 days ago"
// │   │   └── Archetype: "Inside joke"
// │   ├── Card 2: "Company momentum" [confidence: medium]
// │   │   └── ...
// │   └── Card 3: "Shared network" [confidence: low]
// │       └── ...
// └── "Regenerate angles" button (premium)
```

### 5.2 Source Attribution Panel (NEW)

```typescript
// New component: src/components/source-attribution.tsx

interface SourceAttributionProps {
  claims: ResearchClaim[]
  isPremium: boolean
}

// Layout:
// ├── "Why we chose this angle" header
// ├── Fact label (high confidence claims)
// │   ├── "Sundar is CEO of Alphabet" [LinkedIn] → ✓
// │   └── "Sundar spoke about AI at I/O 2025" [News article] → ✓
// ├── Inference label (medium confidence)
// │   └── "Sundar may be interested in agentic workflows" → 🤖 Based on recent AI investments
// └── Speculation label (low confidence)
//     └── "Sundar might be hiring for this space" → ⚠️ Not verified
```

### 5.3 Quality Ladder Selector (NEW)

```typescript
// New component or section: src/components/quality-ladder.tsx

interface QualityLadderProps {
  currentTier: QualityTier
  onSelect: (tier: QualityTier) => void
  userPlan: "free" | "pro" | "studio"
}

// Interactive slider/selector:
// ┌──────────┐  ┌────────────┐  ┌──────────────────────┐
// │ Quick    │  │ Balanced   │  │ Deep Research        │
// │ 1 source │  │ 3 sources  │  │ 10+ sources          │
// │ 1 script │  │ 2 variants │  │ 3 angles + evidence  │
// │ Free     │  │ Pro        │  │ Premium (EXA+FC)     │
// └──────────┘  └────────────┘  └──────────────────────┘
```

### 5.4 Review Stage Enhancement

```typescript
// Enhanced QuickReview / review section in studio-client.tsx

// Current review shows: Profile + Script + Hook
// Phase 9 review adds:
// ├── TARGET SNAPSHOT
// │   ├── Person card (existing profile) 
// │   ├── RECOMMENDED ANGLES (new - angle-cards component)
// │   └── WHY THIS ANGLE (new - source-attribution component)
// ├── SCRIPT (existing)
// ├── HOOK (existing)
// └── BUILD button (existing)
```

---

## Part 6: API Routes & Orchestration

### 6.1 New API Route: Deep Research

```typescript
// src/app/api/research/deep/route.ts (NEW)

// POST /api/research/deep
// Body: {
//   url: string
//   qualityTier: "quick" | "balanced" | "deep"
//   enableFirecrawl?: boolean
//   enableExa?: boolean
//   senderBrief?: string
//   outreachGoal?: string
// }
// Response: ResearchResult (streaming SSE)

// Orchestration:
// 1. Check tier access (free users can't use deep)
// 2. Reserve credits (deep research costs more)
// 3. Run ResearchOrchestrator
// 4. Cache result for 30 minutes
// 5. Return as SSE stream with phase updates
```

### 6.2 New API Route: Suggested Angles

```typescript
// src/app/api/research/angles/route.ts (NEW)

// POST /api/research/angles
// Body: { url: string, senderBrief?: string, outreachGoal?: string, existingClaims?: ResearchClaim[] }
// Response: { angles: TopicalAngle[] }

// Used when user clicks "Regenerate angles" in review
// Re-ranks existing claims or re-runs angle generation
```

### 6.3 Updated Studio Enrich Route

```typescript
// Refactor src/app/api/studio/enrich/route.ts

// Changes:
// 1. Accept `qualityTier` parameter
// 2. If "deep", delegate to ResearchOrchestrator instead of raw TinyFish
// 3. Pass ResearchResult.suggestedAngles through to EnrichResponse
// 4. Pass source attribution data through to EnrichResponse
// 5. Hook up premium credit costs

export interface EnrichResponse {
  profile: Profile
  script: string
  scriptVariantA?: string
  scriptVariantB?: string
  vibeId: string
  vibeReasoning: string
  hook: { ... }
  
  // NEW FIELDS
  suggestedAngles?: TopicalAngle[]
  sourceAttribution?: {
    totalSources: number
    providerBreakdown: Record<string, number>
    claims: { category: string; count: number; confidence: ConfidenceLevel }[]
  }
  researchTier?: QualityTier
}
```

---

## Part 7: Sender Memory Persistence

### 7.1 Storage Layer Updates

```typescript
// Extend AccountStorageProvider in src/lib/storage/types.ts

export interface AccountStorageProvider {
  // ... existing methods ...
  
  // NEW METHODS:
  saveSenderProfile(workspaceId: string, profile: SenderProfile): Promise<void>
  getSenderProfile(workspaceId: string): Promise<SenderProfile | null>
}
```

### 7.2 Auto-load on Studio Visit

```typescript
// In studio-client.tsx useEffect (already partially done)

// Enhanced to load FULL sender profile on mount:
useEffect(() => {
  fetch("/api/account/brief").then(r => r.json()).then(data => {
    if (data.senderName) setSenderName(data.senderName)
    if (data.senderBrief) setSenderBrief(data.senderBrief)
    // NEW: Load full profile
    if (data.senderBusiness) setSenderBusiness(data.senderBusiness)
    if (data.senderBrand) setSenderBrand(data.senderBrand)
    if (data.senderPersonality) setSenderPersonality(data.senderPersonality)
    if (data.senderAudience) setSenderAudience(data.senderAudience)
    if (data.senderOffer) setSenderOffer(data.senderOffer)
    if (data.senderProofPoints) setSenderProofPoints(data.senderProofPoints)
    if (data.outreachGoal) setOutreachGoal(data.outreachGoal)
    if (data.desiredOutcome) setDesiredOutcome(data.desiredOutcome)
    if (data.relationshipWarmth) setRelationshipWarmth(data.relationshipWarmth)
    if (data.tonePreference) setTonePreference(data.tonePreference)
  }).catch(() => {})
}, [])
```

### 7.3 Save on Build

```typescript
// In studio-client.tsx, add to saveSenderMemory():

function saveSenderMemory() {
  // ... existing logic ...
  fetch("/api/account/brief", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // ... existing fields ...
      senderBusiness: senderBusiness.trim() || undefined,
      senderBrand: senderBrand.trim() || undefined,
      senderPersonality: senderPersonality.trim() || undefined,
      senderAudience: senderAudience.trim() || undefined,
      senderOffer: senderOffer.trim() || undefined,
      senderProofPoints: senderProofPoints.split("\n").map(s => s.trim()).filter(Boolean),
      outreachGoal: outreachGoal.trim() || undefined,
      desiredOutcome: desiredOutcome.trim() || undefined,
      reasonForReachingOutNow: reasonForReachingOutNow.trim() || undefined,
      relationshipWarmth,
      tonePreference: tonePreference.trim() || undefined,
    }),
  }).catch(() => {})
}
```

---

## Part 8: Implementation Order

### Phase 9a: UX Intelligence Layer (Week 1)
1. Add `TopicalAngle` type and `ResearchClaim` type to `src/lib/claude.ts`
2. Build `AngleCards` component (`src/components/angle-cards.tsx`)
3. Build `SourceAttribution` component (`src/components/source-attribution.tsx`)
4. Refactor review stage in `studio-client.tsx` to show angles + attribution
5. Update `synthesise()` in `src/lib/claude.ts` to generate relevance signals + suggested angles
6. Wire sender context through enrichment for better relevance scoring

**Files to modify:**
- `src/lib/claude.ts` — add suggestedAngles to Profile, update prompts
- `src/components/` — new AngleCards + SourceAttribution components
- `src/app/studio/studio-client.tsx` — update review stage UI
- `src/app/api/studio/enrich/route.ts` — pass through suggestedAngles

### Phase 9b: Sender Memory (Day 4-5)
1. Extend `WorkspaceAccount` schema in storage providers
2. Add `saveSenderProfile` / `getSenderProfile` to storage interface
3. Update account brief API route to handle full profile
4. Update studio client to auto-load and save full profile

**Files to modify:**
- `src/lib/storage/types.ts` — extend WorkspaceAccount
- `src/lib/storage/turso-account-provider.ts` — implement new methods
- `src/lib/storage/file-account-provider.ts` — implement new methods
- `src/app/api/account/brief/route.ts` — full profile PATCH/GET
- `src/app/studio/studio-client.tsx` — auto-load + save full profile

### Phase 9c: Premium Research Architecture (Week 2)
1. Create `src/lib/research/` directory with types, providers, orchestrator
2. Implement `FirecrawlProvider`
3. Implement `ExaProvider`
4. Refactor `tinyfish.ts` into `TinyFishProvider`
5. Implement `ResearchOrchestrator` with tier-aware provider selection
6. Create `/api/research/deep` route
7. Create `/api/research/angles` route
8. Add `QualityLadder` component to studio UI
9. Wire deep research toggle to tier gating

**Files to modify:**
- `src/lib/research/` — NEW directory (types, providers, orchestrator)
- `src/app/api/research/deep/route.ts` — NEW route
- `src/app/api/research/angles/route.ts` — NEW route
- `src/app/api/studio/enrich/route.ts` — integrate research orchestrator
- `src/lib/tinyfish.ts` — refactor into provider pattern
- `src/lib/hooks/tiers.ts` — extend tier config
- `src/lib/billing/credits.ts` — add new credit actions
- `src/components/quality-ladder.tsx` — NEW component
- `src/app/studio/studio-client.tsx` — wire quality ladder
- `src/app/pricing/page.tsx` — update pricing table for deep research

### Phase 9d: Architecture Hardening (Week 3)
1. Add comprehensive caching for research results
2. Add telemetry for research provider performance
3. Add source attribution to share records (provenance)
4. Learning loop basics: track which angles/scripts users keep vs edit
5. Add rate limiting per provider (not just per endpoint)

**Files to modify:**
- `src/lib/server-cache.ts` — add research-specific caching
- `src/lib/cache-metrics.ts` — track per-provider perf
- `src/lib/artifacts.ts` — add research provenance to share records
- `src/lib/analytics.ts` — track angle/script acceptance rates

---

## Part 9: Verification Plan

### How to test each phase:

**Phase 9a:**
1. Visit `/studio` with a URL
2. After enrichment, verify "Recommended Angles" section appears in review
3. Each angle shows confidence label, evidence snippet, and source link
4. Clicking an angle pre-selects its recommended hook archetype
5. Verify "Regenerate" still works and regenerates angles too

**Phase 9b:**
1. Fill in full sender profile in advanced settings
2. Click "Build" — verify profile is saved to server
3. Refresh page — verify all fields auto-populate
4. Visit on another browser (same account) — verify profile syncs

**Phase 9c:**
1. As anonymous/trial user: quality ladder shows 1 option (Quick)
2. As free user: Quick + Balanced options visible
3. As pro user: Deep Research toggle visible, Firecrawl active
4. Select Deep Research: verify more sources, richer claims, more angles
5. Verify source attribution shows provider breakdown
6. Verify caching works (repeat search returns faster)
7. Verify EXA integration returns podcast/interview results

**Phase 9d:**
1. Run a research twice — second run should hit cache
2. Check analytics shows per-provider latency
3. Share a video — share record should include source provenance
4. Run load test with multiple concurrent deep research requests

---

## Part 10: Quick Wins (First 3 Days)

For immediate impact without full architecture:

1. **Add evidence labels to existing enrichment**
   - In `synthesise()`, have Claude output 3-5 `relevance_signals` with confidence
   - Display them in the review stage as small cards
   - This alone makes the output feel 2x more trustworthy

2. **Persist sender brief + name to server**
   - Already partially done with `lastSenderBrief` / `lastSenderName`
   - Just need to wire the auto-load on studio mount (already in code)

3. **Add the quality ladder concept to the UI**
   - Even without EXA/Firecrawl integration, a "Quick" vs "Detailed" toggle
   - Controls number of sources, script variants enabled, hook detail
   - Gives users a sense of control and progression

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/lib/research/types.ts` | Canonical research schema |
| `src/lib/research/orchestrator.ts` | Research provider coordination |
| `src/lib/research/providers/types.ts` | Provider interface |
| `src/lib/research/providers/tinyfish-provider.ts` | Refactored TinyFish wrapper |
| `src/lib/research/providers/firecrawl-provider.ts` | Firecrawl integration |
| `src/lib/research/providers/exa-provider.ts` | EXA integration |
| `src/app/api/research/deep/route.ts` | Deep research endpoint |
| `src/app/api/research/angles/route.ts` | Angle generation endpoint |
| `src/components/angle-cards.tsx` | Angle recommendation UI |
| `src/components/source-attribution.tsx` | Evidence/source display |
| `src/components/quality-ladder.tsx` | Quick/Balanced/Deep selector |
| `src/components/deep-research-toggle.tsx` | Premium feature toggle |

## Summary of Modified Files

| File | Changes |
|------|---------|
| `src/lib/claude.ts` | Add `suggestedAngles`, `sourceAttribution` to Profile |
| `src/lib/tinyfish.ts` | Refactor into TinyFishProvider |
| `src/lib/storage/types.ts` | Extend WorkspaceAccount with full sender profile |
| `src/lib/storage/*-account-provider.ts` | Implement new storage methods |
| `src/lib/billing/credits.ts` | Add new credit actions (deep research) |
| `src/lib/hooks/tiers.ts` | Extend tier config with research providers |
| `src/app/studio/studio-client.tsx` | Premium toggle, quality ladder, enhanced review |
| `src/app/api/studio/enrich/route.ts` | Pass through angles, attribution |
| `src/app/api/account/brief/route.ts` | Full sender profile persistence |
| `src/app/pricing/page.tsx` | Update pricing for deep research tiers |

---

**Ready to start building.** Pick any phase and I'll implement it end-to-end.
