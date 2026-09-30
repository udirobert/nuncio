import { createClient, type Client } from "@libsql/client";
import type { CallRequestRecord, CallRequestStatus, CallRequestStorageProvider } from "./types";

const OPEN_STATUSES: CallRequestStatus[] = ["pending", "accepted"];

export class TursoCallRequestStorageProvider implements CallRequestStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso call request storage");
    this.client = createClient({ url, authToken });
  }

  async createIfNoOpen(record: CallRequestRecord, now = new Date()): Promise<CallRequestRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `INSERT INTO call_requests (id, share_id, workspace_id, status, expires_at, created_at, record_json)
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM call_requests
              WHERE share_id = ? AND status IN ('pending', 'accepted') AND expires_at > ?
            )`,
      args: [
        record.id,
        record.shareId,
        record.workspaceId,
        record.status,
        record.expiresAt,
        record.createdAt,
        JSON.stringify(record),
        record.shareId,
        now.toISOString(),
      ],
    });
    return result.rowsAffected > 0 ? record : null;
  }

  async get(id: string): Promise<CallRequestRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM call_requests WHERE id = ? LIMIT 1`,
      args: [id],
    });
    return parseRow(result.rows[0]?.record_json);
  }

  async getByRoomName(roomName: string): Promise<CallRequestRecord | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM call_requests
            WHERE json_extract(record_json,'$.roomName') = ?
            ORDER BY created_at DESC LIMIT 1`,
      args: [roomName],
    });
    return parseRow(result.rows[0]?.record_json);
  }

  async hasAcceptedRoom(roomName: string, now = new Date()): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT 1 FROM call_requests
            WHERE json_extract(record_json,'$.roomName') = ?
              AND status = 'accepted' AND expires_at > ?
            LIMIT 1`,
      args: [roomName, now.toISOString()],
    });
    return result.rows.length > 0;
  }

  async listForCleanup(now = new Date(), workspaceId?: string): Promise<CallRequestRecord[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM call_requests
            WHERE ((status IN ('pending', 'accepted') AND expires_at <= ?)
               OR (status NOT IN ('pending', 'accepted')
                   AND json_extract(record_json,'$.roomName') IS NOT NULL
                   AND json_extract(record_json,'$.roomClosedAt') IS NULL))
              ${workspaceId ? "AND workspace_id = ?" : ""}`,
      args: workspaceId ? [now.toISOString(), workspaceId] : [now.toISOString()],
    });
    return result.rows
      .map((row) => parseRow(row.record_json))
      .filter((row): row is CallRequestRecord => Boolean(row));
  }

  async transition(
    id: string,
    from: CallRequestStatus[],
    next: CallRequestRecord,
    now?: Date,
    expectedVersion?: number,
  ): Promise<CallRequestRecord | null> {
    await this.ensureSchema();
    const placeholders = from.map(() => "?").join(", ");
    const expiryClause = now ? " AND expires_at > ?" : "";
    const versionClause = expectedVersion !== undefined
      ? " AND COALESCE(json_extract(record_json,'$.version'),0) = ?"
      : "";
    const args: (string | number)[] = [next.status, next.expiresAt, JSON.stringify(next), id, ...from];
    if (now) args.push(now.toISOString());
    if (expectedVersion !== undefined) args.push(expectedVersion);
    const result = await this.client.execute({
      sql: `UPDATE call_requests
            SET status = ?, expires_at = ?, record_json = ?
            WHERE id = ? AND status IN (${placeholders})${expiryClause}${versionClause}`,
      args,
    });
    return result.rowsAffected > 0 ? next : null;
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<Omit<CallRequestRecord, "recipientTokenHash">[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM call_requests WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
      args: [workspaceId, limit],
    });
    return result.rows
      .map((row) => parseRow(row.record_json))
      .filter((row): row is CallRequestRecord => Boolean(row))
      .map((record) => {
        const redacted: Partial<CallRequestRecord> = { ...record };
        delete redacted.recipientTokenHash;
        return redacted as Omit<CallRequestRecord, "recipientTokenHash">;
      });
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      // Table before index: concurrent execution can land the index first and
      // fail on a missing table. A failed init clears `ready` so the next call
      // retries instead of replaying a cached rejection forever.
      this.ready = (async () => {
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS call_requests (
            id TEXT PRIMARY KEY,
            share_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            status TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            record_json TEXT NOT NULL
          )
        `);
        await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_call_requests_share_open ON call_requests(share_id, status, expires_at)`);
      })().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }
}

function parseRow(value: unknown): CallRequestRecord | null {
  if (!value) return null;
  return JSON.parse(String(value)) as CallRequestRecord;
}

export const CALL_REQUEST_OPEN_STATUSES = OPEN_STATUSES;
