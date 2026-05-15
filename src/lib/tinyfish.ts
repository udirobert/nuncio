import { fetchWithRetry } from "@/lib/retry";

const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY;
const TINYFISH_URL = "https://api.fetch.tinyfish.ai";
const TINYFISH_SEARCH_URL = "https://api.search.tinyfish.ai";

export interface EnrichmentResult {
  url: string;
  markdown: string;
  success: boolean;
  source?: "fetch" | "fetch+search" | "search";
  warning?: string;
}

/**
 * Fetch and clean social profile URLs via TinyFish.
 * Fetches each URL individually so a single failure doesn't take down
 * the batch — callers can show per-URL warnings and continue with
 * whatever profiles succeeded.
 */
export async function enrich(urls: string[]): Promise<EnrichmentResult[]> {
  if (!TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not configured");
  }

  const results = await Promise.all(
    urls.map(async (url): Promise<EnrichmentResult> => {
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
  const boilerplate = [
    "javascript is disabled",
    "please enable javascript",
    "supported browser",
    "cookie policy imprint ads info",
  ];
  return markdown.trim().length < 500 || boilerplate.some((phrase) => text.includes(phrase));
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
    const handle = parsed.pathname.split("/").filter(Boolean)[0];
    if (!handle) return null;

    if (host.includes("x.com") || host.includes("twitter.com")) {
      return `${handle} cofounder founder LinkedIn GitHub company profile`;
    }
    if (host.includes("linkedin.com")) {
      return `${handle} LinkedIn profile product manager company`;
    }
    if (host.includes("github.com")) {
      return `${handle} GitHub profile founder company`;
    }
    return `${handle} ${host} profile`;
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