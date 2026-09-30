import { createClient, type Client } from "@libsql/client";
import type { SchedulingRecord, SchedulingStorageProvider } from "./types";
import { applySchedulingEvent, type SchedulingProviderEvent } from "@/lib/scheduling-server";

const CAS_RETRIES = 3;

export class TursoSchedulingStorageProvider implements SchedulingStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor(client?: Client) {
    if (client) {
      this.client = client;
      return;
    }
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso scheduling storage");
    this.client = createClient({ url, authToken });
  }

  async create(record: SchedulingRecord): Promise<SchedulingRecord> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT INTO scheduling_records (id, share_id, workspace_id, event_type_id, status, created_at, record_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        record.id,
        record.shareId,
        record.workspaceId,
        record.eventTypeId,
        record.status,
        record.createdAt,
        JSON.stringify(record),
      ],
    });
    return JSON.parse(JSON.stringify(record)) as SchedulingRecord;
  }

  async get(id: string): Promise<SchedulingRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM scheduling_records WHERE id = ? LIMIT 1`,
      args: [id],
    });
    return parseRow(result.rows[0]?.record_json);
  }

  async applyProviderEvent(
    id: string,
    event: SchedulingProviderEvent,
  ): Promise<SchedulingRecord | null> {
    await this.ensureSchema();
    for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
      const current = await this.get(id);
      if (!current) return null;
      const next = applySchedulingEvent(current, event);
      if (!next) return current;
      const expectedVersion = current.version ?? 0;
      const result = await this.client.execute({
        sql: `UPDATE scheduling_records
              SET status = ?, record_json = ?
              WHERE id = ? AND json_extract(record_json,'$.version') = ?`,
        args: [next.status, JSON.stringify(next), id, expectedVersion],
      });
      if (result.rowsAffected > 0) return next;
    }
    throw new Error("scheduling record update conflicted");
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<SchedulingRecord[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM scheduling_records WHERE workspace_id = ?
            ORDER BY created_at DESC LIMIT ?`,
      args: [workspaceId, limit],
    });
    return result.rows
      .map((row) => parseRow(row.record_json))
      .filter((row): row is SchedulingRecord => Boolean(row));
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS scheduling_records (
            id TEXT PRIMARY KEY,
            share_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            event_type_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL
          )
        `);
        await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_scheduling_workspace_created ON scheduling_records(workspace_id, created_at)`);
      })().then(() => undefined).catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }
}

function parseRow(value: unknown): SchedulingRecord | null {
  if (!value) return null;
  return JSON.parse(String(value)) as SchedulingRecord;
}
