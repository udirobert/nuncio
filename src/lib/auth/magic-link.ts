import { getTokenStorageProvider } from "@/lib/storage";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export async function createMagicLinkToken(email: string): Promise<string> {
  const provider = getTokenStorageProvider();
  return provider.create(email, Date.now() + FIFTEEN_MINUTES);
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const provider = getTokenStorageProvider();
  return provider.consume(token);
}
