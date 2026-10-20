const ALLOWED_LOGIN_TARGETS = new Set([
  "/setup",
  "/dashboard",
  // Legacy address for Setup — the dashboard redirects it to /setup.
  "/dashboard?view=setup",
  "/studio",
  "/pricing",
  "/examples",
  "/batch",
]);

const DEFAULT_LOGIN_TARGET = "/studio";

export function resolveLoginNext(value: unknown): string {
  return typeof value === "string" && ALLOWED_LOGIN_TARGETS.has(value)
    ? value
    : DEFAULT_LOGIN_TARGET;
}
