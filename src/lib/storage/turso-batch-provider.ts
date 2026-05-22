import { createClient, type Client } from "@libsql/client";
import type { Batch } from "@/lib/batch/types";
import type { BatchStorageProvider } from "./types";

export class TursoBatchStorageProvider implements BatchStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso storage");
    this.client = createClient({ url, authToken });
  }

  async create(batch: Batch): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT INTO batches (id, record_json, created_at) VALUES (?, ?, ?)`,
      args: [batch.id, JSON.stringify(batch), batch.createdAt],
    });
  }

  async get(id: string): Promise<Batch | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM batches WHERE id = ? LIMIT 1`,
      args: [id],
    });
    const row = result.rows[0];
    if (!row) return null;
    return JSON.parse(String(row.record_json)) as Batch;
  }

  async list(): Promise<Batch[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM batches ORDER BY created_at DESC LIMIT 100`,
    });
    return result.rows.map((row) => JSON.parse(String(row.record_json)) as Batch);
  }

  async update(record: Batch): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `UPDATE batches SET record_json = ? WHERE id = ?`,
      args: [JSON.stringify(record), record.id],
    });
  }

  async delete(id: string): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `DELETE FROM batches WHERE id = ?`,
      args: [id],
    });
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = this.client.execute(`
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `).then(() => undefined);
    }
    return this.ready;
  }
}
