import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveSessionRecord, LiveSessionStorageProvider } from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const SESSION_FILE = path.join(DATA_DIR, "live-sessions.json");

export class FileLiveSessionStorageProvider implements LiveSessionStorageProvider {
  readonly name = "file";
  private records = new Map<string, LiveSessionRecord>();
  private loaded = false;
  private writeLock: Promise<void> = Promise.resolve();

  async create(record: LiveSessionRecord): Promise<LiveSessionRecord> {
    return this.withWriteLock(async () => {
      await this.load();
      this.records.set(record.id, record);
      await this.persist();
      return record;
    });
  }

  async createIfNoOpen(record: LiveSessionRecord): Promise<LiveSessionRecord | null> {
    return this.withWriteLock(async () => {
      await this.load();
      const hasOpen = Array.from(this.records.values()).some(
        (existing) => existing.shareId === record.shareId
          && (existing.status === "pending" || existing.status === "active"),
      );
      if (hasOpen) return null;
      this.records.set(record.id, record);
      await this.persist();
      return record;
    });
  }

  async get(id: string): Promise<LiveSessionRecord | null> {
    await this.load();
    return this.records.get(id) || null;
  }

  async update(record: LiveSessionRecord): Promise<void> {
    await this.withWriteLock(async () => {
      await this.load();
      this.records.set(record.id, record);
      await this.persist();
    });
  }

  async listOpen(): Promise<LiveSessionRecord[]> {
    await this.load();
    return Array.from(this.records.values()).filter(
      (record) => record.status === "pending" || record.status === "active",
    );
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const records = JSON.parse(await readFile(SESSION_FILE, "utf8")) as LiveSessionRecord[];
      for (const record of records) this.records.set(record.id, record);
    } catch {
      // Missing or unreadable state starts empty and is recreated on write.
    }
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SESSION_FILE, JSON.stringify(Array.from(this.records.values()), null, 2), "utf8");
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
