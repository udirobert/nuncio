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
    const discovery = await discoverProfiles(urls[0]);
    const discoveredUrls = discovery.discoveredProfiles.map((p) => p.url);
    urlsToEnrich = [...urls, ...discoveredUrls];
  }

  const results = await Promise.all(
    urlsToEnrich.map(async (url): Promise<EnrichmentResult> => {
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
          { maxAttempts: 2 } // lighter retry for per-URL calls
        );

        if (!response.ok) {
          return { url, markdown: "", success: false };
        }

        const data = await response.json();
        const item = normaliseTinyFishItem(data);
        const markdown = item?.markdown || item?.text || item?.content || "";

        if (markdown.trim().length > 0 && !isLowQualityFetch(markdown)) {
          return { url, markdown, success: true, source: "fetch" };
        }

        const searchMarkdown = await searchProfileContext(url);
        if (searchMarkdown) {
          const combined = markdown.trim().length > 0
            ? `${markdown}\n\n---\n\nSearch context:\n${searchMarkdown}`
            : searchMarkdown;
          return {
            url,
            markdown: combined,
            success: true,
            source: markdown.trim().length > 0 ? "fetch+search" : "search",
            warning: "Fetch returned low-quality profile content; augmented with TinyFish Search.",
          };
        }

        return { url, markdown: "", success: false };
      } catch {
        return { url, markdown: "", success: false };
      }
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
  if (matchCount >= 3) return true;

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

async function searchProfileContext(url: string): Promise<string | null> {
  const query = buildSearchQuery(url);
  if (!query) return null;

  const response = await fetchWithRetry(
    `${TINYFISH_SEARCH_URL}?${new URLSearchParams({ query }).toString()}`,
    {
      headers: {
        "X-API-Key": TINYFISH_API_KEY || "",
      },
    },
    { maxAttempts: 1, timeoutMs: 10000 }
  );

  if (!response.ok) return null;
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results.slice(0, 5) : [];
  if (results.length === 0) return null;

  return results
    .map((result: { title?: string; snippet?: string; url?: string }, index: number) => {
      return `${index + 1}. ${result.title || "Untitled"}\n${result.snippet || ""}\n${result.url || ""}`;
    })
    .join("\n\n");
}

function buildSearchQuery(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);

    let handle: string | null = null;
    if (host.includes("linkedin.com")) {
      const inIdx = segments.indexOf("in");
      handle = inIdx >= 0 ? segments[inIdx + 1] : segments[segments.length - 1];
    } else {
      handle = segments[0];
    }
    if (!handle) return null;

    if (host.includes("x.com") || host.includes("twitter.com")) {
      return `"${handle}" site:linkedin.com OR site:github.com OR site:crunchbase.com`;
    }
    if (host.includes("linkedin.com")) {
      return `"${handle}" LinkedIn founder engineer company role`;
    }
    if (host.includes("github.com")) {
      return `"${handle}" GitHub engineer founder company`;
    }
    return `"${handle}" ${host} profile`;
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