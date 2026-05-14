import { fetchWithRetry } from "@/lib/retry";

const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY;
const TINYFISH_URL = "https://api.fetch.tinyfish.ai";

export interface EnrichmentResult {
  url: string;
  markdown: string;
  success: boolean;
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
        // TinyFish returns an array — grab the first item
        const item = Array.isArray(data) ? data[0] : data;

        if (item && item.markdown && item.markdown.trim().length > 0) {
          return { url, markdown: item.markdown, success: true };
        }

        return { url, markdown: "", success: false };
      } catch {
        return { url, markdown: "", success: false };
      }
    })
  );

  return results;
}