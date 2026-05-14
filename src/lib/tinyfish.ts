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
 * Returns clean markdown for each URL that was successfully fetched.
 */
export async function enrich(urls: string[]): Promise<EnrichmentResult[]> {
  if (!TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not configured");
  }

  const response = await fetchWithRetry(TINYFISH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": TINYFISH_API_KEY,
    },
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    throw new Error(`TinyFish API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
