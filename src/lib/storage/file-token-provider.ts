import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MagicLinkToken, TokenStorageProvider } from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const TOKEN_FILE = path.join(DATA_DIR, "magic-link-tokens.json");

export class FileTokenStorageProvider implements TokenStorageProvider {
  readonly name = "file";
  private tokens = new Map<string, MagicLinkToken>();
  private loaded = false;

  async create(email: string, expiresAt: number): Promise<string> {
    await this.load();
    const token = crypto.randomUUID();
    this.tokens.set(token, { token, email, expiresAt });
    await this.persist();
    return token;
  }

  async consume(token: string): Promise<string | null> {
    await this.load();
    const data = this.tokens.get(token);
    if (!data) return null;
    this.tokens.delete(token);
    if (data.expiresAt < Date.now()) {
      await this.persist();
      return null;
    }
    await this.persist();
    return data.email;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(TOKEN_FILE, "utf8");
      const parsed = JSON.parse(raw) as MagicLinkToken[];
      const now = Date.now();
      for (const t of parsed) {
        if (t.expiresAt > now) {
          this.tokens.set(t.token, t);
        }
      }
    } catch {
      // start empty
    }
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      TOKEN_FILE,
      JSON.stringify(Array.from(this.tokens.values()), null, 2),
      "utf8"
    );
  }
}
