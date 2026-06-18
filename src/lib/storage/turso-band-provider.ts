import { createClient, type Client } from "@libsql/client";
import type { BandActivityEvent, BandActivityStorageProvider } from "./types";

export class TursoBandActivityProvider implements BandActivityStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL is required for Turso band activity storage");
    }

    this.client = createClient({ url, authToken });
  }

  private async ensureSchema(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS band_events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          agent TEXT NOT NULL,
          event_type TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT,
          timestamp TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await this.client.execute(`
        CREATE INDEX IF NOT EXISTS idx_band_events_session ON band_events(session_id)
      `);
    })();
    return this.ready;
  }

  async addEvent(event: BandActivityEvent): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT OR IGNORE INTO band_events (id, session_id, agent, event_type, content, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        event.id,
        event.sessionId,
        event.agent,
        event.eventType,
        event.content,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.timestamp,
      ],
    });
  }

  async getEvents(sessionId: string): Promise<BandActivityEvent[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT id, session_id, agent, event_type, content, metadata, timestamp
            FROM band_events WHERE session_id = ? ORDER BY created_at ASC`,
      args: [sessionId],
    });

    return result.rows.map((row) => ({
      id: row.id as string,
      sessionId: row.session_id as string,
      agent: row.agent as string,
      eventType: row.event_type as string,
      content: row.content as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      timestamp: row.timestamp as string,
    }));
  }
}
