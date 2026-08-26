import { createClient, type Client } from "@libsql/client";
import type { LiveSessionRecord, LiveSessionStorageProvider } from "./types";

export class TursoLiveSessionStorageProvider implements LiveSessionStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso live session storage");
    this.client = createClient({ url, authToken });
  }

  async create(record: LiveSessionRecord): Promise<LiveSessionRecord> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT INTO live_sessions (id, share_id, workspace_id, status, created_at, record_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [record.id, record.shareId, record.workspaceId || null, record.status, record.createdAt, JSON.stringify(record)],
    });
    return record;
  }

  async createIfNoOpen(record: LiveSessionRecord): Promise<LiveSessionRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `INSERT INTO live_sessions (id, share_id, workspace_id, status, created_at, record_json)
            SELECT ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM live_sessions
              WHERE share_id = ? AND status IN ('pending', 'active')
            )`,
      args: [
        record.id,
        record.shareId,
        record.workspaceId || null,
        record.status,
        record.createdAt,
        JSON.stringify(record),
        record.shareId,
      ],
    });
    return result.rowsAffected > 0 ? record : null;
  }

  async get(id: string): Promise<LiveSessionRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM live_sessions WHERE id = ? LIMIT 1`,
      args: [id],
    });
    return parseRow(result.rows[0]?.record_json);
  }

  async update(record: LiveSessionRecord): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `UPDATE live_sessions SET status = ?, record_json = ? WHERE id = ?`,
      args: [record.status, JSON.stringify(record), record.id],
    });
  }

  async listOpen(): Promise<LiveSessionRecord[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM live_sessions WHERE status IN ('pending', 'active') ORDER BY created_at ASC`,
    });
    return result.rows.map((row) => parseRow(row.record_json)).filter((row): row is LiveSessionRecord => Boolean(row));
  }

  async listRecent(input: { workspaceId: string; limit?: number }): Promise<LiveSessionRecord[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM live_sessions
            WHERE workspace_id = ? AND status IN ('ended', 'expired', 'failed')
            ORDER BY created_at DESC LIMIT ?`,
      args: [input.workspaceId, input.limit ?? 50],
    });
    return result.rows.map((row) => parseRow(row.record_json)).filter((row): row is LiveSessionRecord => Boolean(row));
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = Promise.all([
        this.client.execute(`
          CREATE TABLE IF NOT EXISTS live_sessions (
            id TEXT PRIMARY KEY,
            share_id TEXT NOT NULL,
            workspace_id TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL
          )
        `),
        this.client.execute(`CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status)`),
      ]).then(() => undefined);
    }
    return this.ready;
  }
}

function parseRow(value: unknown): LiveSessionRecord | null {
  if (!value) return null;
  return JSON.parse(String(value)) as LiveSessionRecord;
}
