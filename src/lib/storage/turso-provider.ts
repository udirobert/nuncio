import type { ShareRecord } from "@/lib/artifacts";
import type { ShareRecordInput, ShareStorageProvider } from "./types";
import { createClient, type Client } from "@libsql/client";

export class TursoShareStorageProvider implements ShareStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL is required for Turso storage");
    }

    this.client = createClient({ url, authToken });
  }

  async create(input: ShareRecordInput): Promise<ShareRecord> {
    await this.ensureSchema();
    const record: ShareRecord = {
      ...input,
      id: crypto.randomUUID().slice(0, 12),
      createdAt: new Date().toISOString(),
    };

    await this.client.execute({
      sql: `INSERT INTO share_records (id, record_json, created_at) VALUES (?, ?, ?)`,
      args: [record.id, JSON.stringify(record), record.createdAt],
    });

    return record;
  }

  async get(id: string): Promise<ShareRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM share_records WHERE id = ? LIMIT 1`,
      args: [id],
    });

    const row = result.rows[0];
    if (!row) return null;

    const json = row.record_json;
    return JSON.parse(String(json)) as ShareRecord;
  }

  async update(record: ShareRecord): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `UPDATE share_records SET record_json = ? WHERE id = ?`,
      args: [JSON.stringify(record), record.id],
    });
  }

  async list(options?: { limit?: number; industry?: string; privacy?: string }): Promise<ShareRecord[]> {
    await this.ensureSchema();
    const limit = options?.limit || 50;
    let sql = `SELECT record_json FROM share_records WHERE 1=1`;
    const args: (string | number)[] = [];

    if (options?.privacy) {
      sql += ` AND json_extract(record_json, '$.privacy') = ?`;
      args.push(options.privacy);
    }

    if (options?.industry) {
      sql += ` AND json_extract(record_json, '$.industry') = ?`;
      args.push(options.industry);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    args.push(limit);

    const result = await this.client.execute({ sql, args });
    return result.rows.map((row) => JSON.parse(String(row.record_json)) as ShareRecord);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = this.client.execute(`
        CREATE TABLE IF NOT EXISTS share_records (
          id TEXT PRIMARY KEY,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `).then(() => undefined);
    }

    return this.ready;
  }
}