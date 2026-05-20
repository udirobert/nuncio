import { fetchWithRetry } from "@/lib/retry";

const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY;
const TINYFISH_URL = "https://api.fetch.tinyfish.ai";
const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";
const TINYFISH_AGENT_URL = "https://agent.tinyfish.ai/v1/automation/run";

export interface EnrichmentResult {
  url: string;
  markdown: string;
  success: boolean;
  source?: "fetch" | "fetch+search" | "search";
  warning?: string;
}

export interface DiscoveredProfile {
  url: string;
  platform: string;
  confidence: number;
}

export interface DiscoveryResult {
  primaryUrl: string;
  discoveredProfiles: DiscoveredProfile[];
}

/**
 * Discover additional social profiles from a primary URL using TinyFish Agent API.
 * Returns links to other profiles like personal websites, Twitter, GitHub, etc.
 */
export async function discoverProfiles(url: string): Promise<DiscoveryResult> {
  if (!TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not configured");
  }

  try {
    const response = await fetchWithRetry(
      TINYFISH_AGENT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": TINYFISH_API_KEY,
        },
        body: JSON.stringify({
          url,
          goal: "Find all social media profiles, personal websites, blogs, and other online profiles for this person. Look for links in headers, footers, bio sections, and contact/about pages. Return JSON array of discovered URLs with platform names.",
          output_schema: {
            type: "object",
            properties: {
              profiles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    platform: { type: "string" },
                  },
                  required: ["url"],
                },
              },
            },
          },
          browser_profile: "stealth",
          proxy_config: { enabled: true, type: "tetra", country_code: "US" },
        }),
      },
      { maxAttempts: 1, timeoutMs: 60000 }
    );

    if (!response.ok) {
      return { primaryUrl: url, discoveredProfiles: [] };
    }

    const data = await response.json();
    const profiles: DiscoveredProfile[] = Array.isArray(data?.result?.profiles)
      ? data.result.profiles
          .filter((p: unknown) => p && typeof p === "object" && "url" in p)
          .map((p: { url: string; platform?: string }) => ({
            url: validateProfileUrl(p.url),
            platform: p.platform || detectPlatform(p.url),
            confidence: 0.8,
          }))
          .filter((p: DiscoveredProfile) => p.url)
      : [];

    return { primaryUrl: url, discoveredProfiles: profiles };
  } catch {
    return { primaryUrl: url, discoveredProfiles: [] };
  }
}

function validateProfileUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) return null;
    const validHosts = [
      "linkedin.com",
      "twitter.com",
      "x.com",
      "github.com",
      "github.io",
      "medium.com",
      "dev.to",
      "substack.com",
      "personal",
      "portfolio",
    ];
    const host = parsed.hostname.replace(/^www\./, "");
    if (validHosts.some((h) => host.includes(h))) return url;
    if (host.match(/\.(io|ai|me|co)$/) || parsed.pathname.length > 1) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("twitter") || host.includes("x.com")) return "Twitter";
    if (host.includes("github")) return "GitHub";
    if (host.includes("medium")) return "Medium";
    if (host.includes("dev.to")) return "Dev.to";
    if (host.includes("substack")) return "Substack";
    return "Personal";
  } catch {
    return "Unknown";
  }
}

/**
 * Enrich URLs with optional profile discovery.
 * When discoverRelated is true, uses Agent API to find additional profiles from the first URL.
 */
export async function enrich(
  urls: string[],
  options?: { discoverRelated?: boolean }
): Promise<EnrichmentResult[]> {
  if (!TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not configured");
  }

  let urlsToEnrich = urls;
  if (options?.discoverRelated && urls.length > 0) {
    try {
      const discovery = await discoverProfiles(urls[0]);
      const discoveredUrls = discovery.discoveredProfiles.map((p) => p.url);
      urlsToEnrich = [...urls, ...discoveredUrls];
    } catch {
      // Discovery is optional — continue with original URLs
    }
  }

  const results = await Promise.all(
    urlsToEnrich.map(async (url): Promise<EnrichmentResult> => {
      // Try fetch first
      let markdown = "";
      let fetchOk = false;
      try {
        const response = await fetchWithRetry(
          TINYFISH_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": TINYFISH_API_KEY,
            },
            body: JSON.stringify({ urls: [url] }),
          },
          { maxAttempts: 2 }
        );
        fetchOk = response.ok;
        if (response.ok) {
          const data = await response.json();
          const item = normaliseTinyFishItem(data);
          markdown = item?.markdown || item?.text || item?.content || "";
        }
      } catch {
        // Fetch threw — fall through to search
      }

      if (markdown.trim().length > 0 && !isLowQualityFetch(markdown)) {
        return { url, markdown, success: true, source: "fetch" };
      }

      // Fetch failed or returned junk — try search (discard junk entirely)
      try {
        const searchMarkdown = await searchProfileContext(url);
        if (searchMarkdown) {
          return {
            url,
            markdown: searchMarkdown,
            success: true,
            source: "search",
            warning: fetchOk
              ? "Fetch returned login-wall content; using TinyFish Search instead."
              : "Fetch service unavailable; using TinyFish Search.",
          };
        }
      } catch {
        // Search also failed
      }

      return { url, markdown: "", success: false };
    })
  );

  return results;
}

function isLowQualityFetch(markdown: string): boolean {
  const text = markdown.toLowerCase();
  const trimmed = markdown.trim();

  if (trimmed.length < 500) return true;

  const loginWallPhrases = [
    "javascript is disabled",
    "please enable javascript",
    "supported browser",
    "cookie policy",
    "terms of service",
    "sign in",
    "log in to",
    "create an account",
    "don't have an account",
    "forgot password",
    "privacy policy",
    "help center",
    "ads info",
    "imprint",
    "sign up",
    "join now",
    "this browser is no longer supported",
    "something went wrong",
    "try reloading",
    "rate limit",
  ];

  const matchCount = loginWallPhrases.filter((phrase) => text.includes(phrase)).length;
  if (matchCount >= 2) return true;

  // X/Twitter specific: their login wall dumps legal footer as main content
  if (text.includes("© 2026 x corp") || text.includes("© 2025 x corp") || text.includes("x corp")) return true;

  const profileSignals = [
    /\b(ceo|cto|coo|vp|founder|co-founder|engineer|designer|manager|director|head of)\b/i,
    /\b(company|startup|building|launched|shipped|created|working on)\b/i,
    /\b(university|stanford|mit|harvard|college|degree|studied)\b/i,
    /@[a-z0-9_]{2,}/i,
    /\b(followers|following|posts|tweets|connections)\b/i,
    /\b(experience|skills|projects|publications|patents)\b/i,
  ];
  const signalCount = profileSignals.filter((re) => re.test(text)).length;
  if (signalCount === 0 && trimmed.length < 2000) return true;

  const lines = trimmed.split("\n").filter((l) => l.trim().length > 10);
  const navLines = lines.filter((l) =>
    /^[\s|·•\-–—]*((home|explore|search|notifications|messages|profile|settings|more|menu|about|contact|blog|careers|developers|business|advertise|help)\s*[|·•\-–—\s]*)+$/i.test(l.trim())
  );
  if (navLines.length > 0 && lines.length - navLines.length < 5) return true;

  return false;
}

interface SearchResult {
  title?: string;
  snippet?: string;
  url?: string;
}

async function runSearch(query: string): Promise<SearchResult[]> {
  const response = await fetchWithRetry(
    `${TINYFISH_SEARCH_URL}?${new URLSearchParams({ query }).toString()}`,
    {
      headers: { "X-API-Key": TINYFISH_API_KEY || "" },
    },
    { maxAttempts: 1, timeoutMs: 10000 }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.results) ? data.results : [];
}

async function searchProfileContext(url: string): Promise<string | null> {
  const handle = extractHandle(url);
  if (!handle) return null;

  const host = new URL(url).hostname.replace(/^www\./, "");
  const isTwitter = host.includes("x.com") || host.includes("twitter.com");

  let allResults: SearchResult[] = [];

  if (isTwitter) {
    // Phase 1a: X-native results (tweets, bio, profile snippets)
    const xResults = await runSearch(`"@${handle}" OR "${handle}" site:x.com`);
    allResults.push(...xResults);

    // Phase 1b: Cross-platform mentions (LinkedIn, news, etc.)
    const crossResults = await runSearch(`"${handle}" site:linkedin.com OR site:github.com OR site:crunchbase.com`);
    allResults.push(...crossResults);

    // Extract real name and company from combined results
    const combined = [...xResults, ...crossResults];
    const realName = extractNameFromSnippets(handle, combined);

    // Phase 2: If we found their name, search for rich profile data
    if (realName) {
      const company = extractCompanyFromSnippets(combined, handle);
      const targetedQuery = company
        ? `"${realName}" "${company}"`
        : `"${realName}" site:linkedin.com OR site:crunchbase.com`;
      const targetedResults = await runSearch(targetedQuery);
      allResults.push(...targetedResults);
    }
  } else {
    const query = buildSearchQuery(url, handle, host);
    if (!query) return null;
    allResults = await runSearch(query);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 10);

  if (uniqueResults.length === 0) return null;

  return [
    `Profile URL: ${url}${handle ? ` (handle: @${handle})` : ""}`,
    `The following are web search results about this person:`,
    "",
    ...uniqueResults.map((result, index) => {
      return `${index + 1}. ${result.title || "Untitled"}\n${result.snippet || ""}\nSource: ${result.url || ""}`;
    }),
  ].join("\n\n");
}

function extractNameFromSnippets(handle: string, results: SearchResult[]): string | null {
  for (const r of results) {
    const combined = `${r.title || ""} ${r.snippet || ""}`;
    // Pattern: "Name (@handle)" or "Name (@handle) / Posts"
    const match = combined.match(new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s*\\(@?${handle}\\)`, "i"));
    if (match) return match[1].trim();
    // Pattern: title like "joowon (@n0w00j) / Posts / X"
    const titleMatch = r.title?.match(new RegExp(`^([\\w]+)\\s*\\(@?${handle}\\)`, "i"));
    if (titleMatch) return titleMatch[1].trim();
  }
  return null;
}

function extractCompanyFromSnippets(results: SearchResult[], handle?: string): string | null {
  // First pass: look for company directly associated with the handle
  if (handle) {
    for (const r of results) {
      const text = `${r.title || ""} ${r.snippet || ""}`;
      // Pattern: "@handle - Role at Company" or "handle ... Co-founder at Company"
      const handleCtx = text.match(new RegExp(`@?${handle}[^.]*?(?:co-?founder|founder|ceo|cto)\\s+(?:at|@)\\s+([A-Z][a-zA-Z]+)`, "i"));
      if (handleCtx) return handleCtx[1];
      // Pattern: "Name - cofounder @ company" in title
      const titleMatch = r.title?.match(/cofounder\s*@\s*([a-zA-Z]+)/i);
      if (titleMatch && text.toLowerCase().includes(handle.toLowerCase())) return titleMatch[1];
    }
  }
  // Second pass: first "founder/CEO at X" mention
  for (const r of results) {
    const text = `${r.title || ""} ${r.snippet || ""}`;
    const match = text.match(/(?:co-?founder|founder|ceo|cto)\s+(?:at|@)\s+([A-Z][a-zA-Z]+)/i);
    if (match) return match[1];
  }
  return null;
}

function buildSearchQuery(url: string, handle?: string | null, host?: string): string | null {
  try {
    if (!handle) {
      const parsed = new URL(url);
      host = parsed.hostname.replace(/^www\./, "");
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (host?.includes("linkedin.com")) {
        const inIdx = segments.indexOf("in");
        handle = inIdx >= 0 ? segments[inIdx + 1] : segments[segments.length - 1];
      } else {
        handle = segments[0];
      }
    }
    if (!handle) return null;
    if (!host) host = new URL(url).hostname.replace(/^www\./, "");

    if (host.includes("linkedin.com")) {
      return `"${handle}" site:linkedin.com OR site:wikipedia.org OR site:crunchbase.com`;
    }
    if (host.includes("github.com")) {
      return `"${handle}" GitHub engineer founder company`;
    }
    return `"${handle}" ${host} profile`;
  } catch {
    return null;
  }
}

function extractHandle(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (host.includes("linkedin.com")) {
      const inIdx = segments.indexOf("in");
      return inIdx >= 0 ? segments[inIdx + 1] : segments[segments.length - 1] || null;
    }
    return segments[0] || null;
  } catch {
    return null;
  }
}

function normaliseTinyFishItem(data: unknown):
  | { markdown?: string; text?: string; content?: string }
  | null {
  if (Array.isArray(data)) {
    return normaliseTinyFishItem(data[0]);
  }

  if (data && typeof data === "object") {
    const objectData = data as {
      markdown?: string;
      text?: string;
      content?: string;
      results?: unknown[];
    };

    if (Array.isArray(objectData.results)) {
      return normaliseTinyFishItem(objectData.results[0]);
    }

    return objectData;
  }

  return null;
}