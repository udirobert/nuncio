import type { NextRequest } from "next/server";

/**
 * Resolve the public origin (scheme://host[:port]) for this nuncio instance.
 *
 * In production behind a reverse proxy (Coolify/Caddy/Traefik), the raw
 * `request.url` and `Host` header resolve to the *internal* address (e.g.
 * `http://localhost:3000`) because the proxy forwards to the app over plain
 * HTTP on a private port. Auth redirects and magic-link emails that derive
 * from `request.url` therefore point to localhost and break.
 *
 * This helper reads the standard `X-Forwarded-Host` / `X-Forwarded-Proto`
 * headers so URLs point to the real public address the browser used.
 *
 * Priority:
 *  1. `APP_URL` env var (explicit, most reliable — set this in production)
 *  2. `NEXT_PUBLIC_APP_URL` env var (client-visible fallback)
 *  3. `X-Forwarded-Host` + `X-Forwarded-Proto` (proxied request headers)
 *  4. The request's own `Host` header + protocol
 *  5. `http://localhost:3000` (dev fallback)
 */
export function resolvePublicOrigin(request?: NextRequest | Request): string {
  // 1. Explicit env var — highest priority, always correct when set
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (request) {
    // 2. Forwarded headers (proxy-aware). Can be comma-separated when
    //    multiple proxies are chained — take the first (closest to client).
    const forwardedHost = firstHeader(request.headers.get("x-forwarded-host"));
    const forwardedProto = firstHeader(request.headers.get("x-forwarded-proto")) || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    // 3. Request's own host — only useful when not behind a proxy
    try {
      const url = new URL(request.url);
      if (url.host && url.host !== "localhost:3000") {
        return `${url.protocol}//${url.host}`;
      }
    } catch {
      // fall through to dev fallback
    }
  }

  // 4. Dev fallback
  return "http://localhost:3000";
}

/**
 * Build an absolute URL for a path, using the resolved public origin.
 *
 *   absoluteUrl("/studio", request)        → "https://nuncio.persidian.com/studio"
 *   absoluteUrl("/api/auth/verify?token=x") → "https://nuncio.persidian.com/api/auth/verify?token=x"
 */
export function absoluteUrl(path: string, request?: NextRequest | Request): string {
  const origin = resolvePublicOrigin(request);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${cleanPath}`;
}

/** Take the first value from a comma-separated header (handles proxy chains). */
function firstHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0].trim();
  return first || null;
}
