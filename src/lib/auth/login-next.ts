const ALLOWED_LOGIN_TARGETS = new Set([
  "/dashboard?view=setup",
  "/dashboard",
  "/studio",
  "/pricing",
]);

const DEFAULT_LOGIN_TARGET = "/studio";

export function resolveLoginNext(value: unknown): string {
  return typeof value === "string" && ALLOWED_LOGIN_TARGETS.has(value)
    ? value
    : DEFAULT_LOGIN_TARGET;
}
