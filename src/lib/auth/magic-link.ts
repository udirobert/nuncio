const tokens = new Map<string, { email: string; expiresAt: number }>();
const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokens) {
    if (data.expiresAt < now) tokens.delete(token);
  }
}, CLEANUP_INTERVAL);

export function createMagicLinkToken(email: string): string {
  const token = crypto.randomUUID();
  tokens.set(token, { email, expiresAt: Date.now() + 15 * 60_000 });
  return token;
}

export function verifyMagicLinkToken(token: string): string | null {
  const data = tokens.get(token);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token);
  return data.email;
}
