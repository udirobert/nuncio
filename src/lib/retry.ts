/**
 * Retry utility with exponential backoff.
 * Used for API calls that may fail transiently (rate limits, network issues).
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Initial delay in ms before first retry. Default: 1000 */
  initialDelay?: number;
  /** Multiplier for each subsequent delay. Default: 2 */
  backoffFactor?: number;
  /** Maximum delay in ms. Default: 10000 */
  maxDelay?: number;
  /** HTTP status codes that should trigger a retry. Default: [429, 500, 502, 503, 504] */
  retryableStatuses?: number[];
  /** Abort each attempt after this many ms. Default: no timeout */
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "timeoutMs">> & Pick<RetryOptions, "timeoutMs"> = {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffFactor: 2,
  maxDelay: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
  timeoutMs: undefined,
};

/**
 * Execute a fetch call with retry logic.
 * Only retries on network errors or retryable HTTP status codes.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const controller = opts.timeoutMs ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), opts.timeoutMs)
        : null;
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          signal: controller?.signal || init?.signal,
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }

      // If response is OK or not retryable, return immediately
      if (response.ok || !opts.retryableStatuses.includes(response.status)) {
        return response;
      }

      // Retryable status — check if we have attempts left
      if (attempt === opts.maxAttempts) {
        return response; // Return the failed response on last attempt
      }

      console.warn(
        `[retry] Attempt ${attempt}/${opts.maxAttempts} failed with status ${response.status}. Retrying in ${delay}ms...`
      );
    } catch (error) {
      // Network error
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      console.warn(
        `[retry] Attempt ${attempt}/${opts.maxAttempts} failed with network error. Retrying in ${delay}ms...`
      );
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
  }

  // Should not reach here, but just in case
  throw lastError || new Error("All retry attempts exhausted");
}
