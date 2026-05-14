/**
 * Input validation utilities.
 * Prevents wasted API credits by rejecting invalid inputs early.
 */

const PROFILE_URL_PATTERNS: { platform: string; pattern: RegExp }[] = [
  { platform: "linkedin", pattern: /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i },
  { platform: "linkedin", pattern: /linkedin\.com\/company\/[a-zA-Z0-9_-]+/i },
  { platform: "twitter", pattern: /(twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i },
  { platform: "github", pattern: /github\.com\/[a-zA-Z0-9_-]+/i },
  { platform: "farcaster", pattern: /warpcast\.com\/[a-zA-Z0-9_.]+/i },
  { platform: "facebook", pattern: /(facebook\.com|fb\.com)\/[a-zA-Z0-9_.]+/i },
  { platform: "personal", pattern: /^https?:\/\/.+\..+/i }, // Any valid URL as fallback
];

export interface ValidationResult {
  valid: boolean;
  url: string;
  error?: string;
}

/**
 * Validate a single URL looks like a profile page.
 * Rejects obviously non-profile URLs to save TinyFish credits.
 */
export function validateProfileUrl(url: string): ValidationResult {
  const trimmed = url.trim();

  if (!trimmed) {
    return { valid: false, url: trimmed, error: "URL is empty" };
  }

  // Must start with http(s)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return { valid: false, url: trimmed, error: "URL must start with http:// or https://" };
  }

  // Must be a valid URL
  try {
    new URL(trimmed);
  } catch {
    return { valid: false, url: trimmed, error: "Invalid URL format" };
  }

  // Reject known non-profile URLs that would waste credits
  const BLOCKED_DOMAINS = [
    "google.com",
    "youtube.com",
    "amazon.com",
    "wikipedia.org",
    "reddit.com",
    "stackoverflow.com",
    "medium.com", // articles, not profiles
    "docs.google.com",
    "drive.google.com",
  ];

  try {
    const hostname = new URL(trimmed).hostname.replace("www.", "");
    if (BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return {
        valid: false,
        url: trimmed,
        error: `${hostname} is not a supported profile platform`,
      };
    }
  } catch {
    return { valid: false, url: trimmed, error: "Could not parse URL" };
  }

  // Check if it matches any known profile pattern
  const isKnownProfile = PROFILE_URL_PATTERNS.some((p) => p.pattern.test(trimmed));

  if (!isKnownProfile) {
    // Allow it but with a softer check — any URL with a path segment could be a profile
    const path = new URL(trimmed).pathname;
    if (path === "/" || path === "") {
      return {
        valid: false,
        url: trimmed,
        error: "URL looks like a homepage, not a profile. Add the profile path.",
      };
    }
  }

  return { valid: true, url: trimmed };
}

/**
 * Validate an array of URLs. Returns only valid ones + any errors.
 */
export function validateUrls(urls: string[]): {
  valid: string[];
  errors: ValidationResult[];
} {
  const results = urls.map(validateProfileUrl);
  return {
    valid: results.filter((r) => r.valid).map((r) => r.url),
    errors: results.filter((r) => !r.valid),
  };
}

/**
 * Validate script word count before rendering.
 * HeyGen charges more for longer videos. Cap at 200 words.
 */
export function validateScript(script: string): {
  valid: boolean;
  wordCount: number;
  error?: string;
} {
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount === 0) {
    return { valid: false, wordCount: 0, error: "Script is empty" };
  }

  if (wordCount > 200) {
    return {
      valid: false,
      wordCount,
      error: `Script is ${wordCount} words — maximum is 200. Please shorten it to save rendering credits.`,
    };
  }

  if (wordCount < 10) {
    return {
      valid: false,
      wordCount,
      error: "Script is too short — minimum 10 words for a meaningful video.",
    };
  }

  return { valid: true, wordCount };
}
