import { createClient, type Client } from "@libsql/client";
import type { TokenStorageProvider } from "./types";

export class TursoTokenStorageProvider implements TokenStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso storage");
    this.client = createClient({ url, authToken });
  }

  async create(email: string, expiresAt: number): Promise<string> {
    await this.ensureSchema();
    const token = crypto.randomUUID();
    await this.client.execute({
      sql: `INSERT INTO magic_link_tokens (token, email, expires_at) VALUES (?, ?, ?)`,
      args: [token, email, expiresAt],
    });
    return token;
  }

  async consume(token: string): Promise<string | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT email, expires_at FROM magic_link_tokens WHERE token = ? LIMIT 1`,
      args: [token],
    });
    const row = result.rows[0];
    if (!row) return null;

    await this.client.execute({
      sql: `DELETE FROM magic_link_tokens WHERE token = ?`,
      args: [token],
    });

    const email = String(row.email);
    const expiresAt = Number(row.expires_at);
    if (expiresAt < Date.now()) return null;

    return email;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = this.client.execute(`
        CREATE TABLE IF NOT EXISTS magic_link_tokens (
          token TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).then(() => undefined);
    }
    return this.ready;
  }
}
