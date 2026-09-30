import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CallRequestRecord, CallRequestStatus, CallRequestStorageProvider } from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const REQUEST_FILE = path.join(DATA_DIR, "call-requests.json");

const OPEN_STATUSES: CallRequestStatus[] = ["pending", "accepted"];

function isOpen(record: CallRequestRecord, now: Date): boolean {
  return OPEN_STATUSES.includes(record.status) && new Date(record.expiresAt).getTime() > now.getTime();
}

export class FileCallRequestStorageProvider implements CallRequestStorageProvider {
  readonly name = "file";
  private records = new Map<string, CallRequestRecord>();
  private loaded = false;
  private writeLock: Promise<void> = Promise.resolve();

  async createIfNoOpen(record: CallRequestRecord, now = new Date()): Promise<CallRequestRecord | null> {
    return this.withWriteLock(async () => {
      await this.load();
      const hasOpen = Array.from(this.records.values()).some(
        (existing) => existing.shareId === record.shareId && isOpen(existing, now),
      );
      if (hasOpen) return null;
      this.records.set(record.id, record);
      await this.persist();
      return record;
    });
  }

  async get(id: string): Promise<CallRequestRecord | null> {
    await this.load();
    return this.records.get(id) || null;
  }

  async getByRoomName(roomName: string): Promise<CallRequestRecord | null> {
    await this.load();
    const matches = Array.from(this.records.values())
      .filter((record) => record.roomName === roomName)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] || null;
  }

  async hasAcceptedRoom(roomName: string, now = new Date()): Promise<boolean> {
    await this.load();
    return Array.from(this.records.values()).some(
      (record) =>
        record.roomName === roomName
        && record.status === "accepted"
        && new Date(record.expiresAt).getTime() > now.getTime(),
    );
  }

  async listForCleanup(now = new Date(), workspaceId?: string): Promise<CallRequestRecord[]> {
    await this.load();
    return Array.from(this.records.values()).filter(
      (record) =>
        (!workspaceId || record.workspaceId === workspaceId)
        && (
          (OPEN_STATUSES.includes(record.status) && new Date(record.expiresAt).getTime() <= now.getTime())
          || (!OPEN_STATUSES.includes(record.status) && Boolean(record.roomName) && !record.roomClosedAt)
        ),
    );
  }

  async transition(
    id: string,
    from: CallRequestStatus[],
    next: CallRequestRecord,
    now?: Date,
    expectedVersion?: number,
  ): Promise<CallRequestRecord | null> {
    return this.withWriteLock(async () => {
      await this.load();
      const current = this.records.get(id);
      if (!current || !from.includes(current.status)) return null;
      if (now && new Date(current.expiresAt).getTime() <= now.getTime()) return null;
      if (expectedVersion !== undefined && (current.version ?? 0) !== expectedVersion) return null;
      this.records.set(id, next);
      await this.persist();
      return next;
    });
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<Omit<CallRequestRecord, "recipientTokenHash">[]> {
    await this.load();
    return Array.from(this.records.values())
      .filter((record) => record.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((record) => {
        const redacted: Partial<CallRequestRecord> = { ...record };
        delete redacted.recipientTokenHash;
        return redacted as Omit<CallRequestRecord, "recipientTokenHash">;
      });
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const records = JSON.parse(await readFile(REQUEST_FILE, "utf8")) as CallRequestRecord[];
      for (const record of records) this.records.set(record.id, record);
    } catch {
      // Missing or unreadable state starts empty and is recreated on write.
    }
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(REQUEST_FILE, JSON.stringify(Array.from(this.records.values()), null, 2), "utf8");
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeLock;
    let release!: () => void;
    this.writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
