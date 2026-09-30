import { createClient, type Client } from "@libsql/client";
import type { HandoffRecord, HandoffStorageProvider } from "./types";

export class TursoHandoffStorageProvider implements HandoffStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso handoff storage");
    this.client = createClient({ url, authToken });
  }

  async create(record: HandoffRecord): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT INTO handoffs (id, share_id, workspace_id, expires_at, created_at, record_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        record.id,
        record.shareId,
        record.workspaceId,
        record.expiresAt,
        record.createdAt,
        JSON.stringify(record),
      ],
    });
  }

  async get(id: string): Promise<HandoffRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM handoffs WHERE id = ? LIMIT 1`,
      args: [id],
    });
    return parseRow(result.rows[0]?.record_json);
  }

  async revoke(id: string, workspaceId: string, now: Date): Promise<HandoffRecord | null> {
    await this.ensureSchema();
    const current = await this.get(id);
    if (!current || current.workspaceId !== workspaceId) return null;
    if (current.revokedAt) return current;
    const revoked = { ...current, revokedAt: now.toISOString() };
    const result = await this.client.execute({
      sql: `UPDATE handoffs SET record_json = ?
            WHERE id = ? AND workspace_id = ?
              AND json_extract(record_json,'$.revokedAt') IS NULL`,
      args: [JSON.stringify(revoked), id, workspaceId],
    });
    if (result.rowsAffected > 0) return revoked;
    const reread = await this.get(id);
    return reread?.workspaceId === workspaceId ? reread : null;
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<HandoffRecord[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM handoffs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [workspaceId, limit],
    });
    return result.rows
      .map((row) => parseRow(row.record_json))
      .filter((row): row is HandoffRecord => Boolean(row));
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = this.client.execute(`
        CREATE TABLE IF NOT EXISTS handoffs (
          id TEXT PRIMARY KEY,
          share_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          record_json TEXT NOT NULL
        )
      `).then(() => undefined).catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }
}

function parseRow(value: unknown): HandoffRecord | null {
  if (!value) return null;
  return JSON.parse(String(value)) as HandoffRecord;
}
