import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HandoffRecord, HandoffStorageProvider } from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const HANDOFF_FILE = path.join(DATA_DIR, "handoffs.json");

function clone(record: HandoffRecord): HandoffRecord {
  return JSON.parse(JSON.stringify(record)) as HandoffRecord;
}

function isHandoffRecord(value: unknown): value is HandoffRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const context = record.context;
  if (!context || typeof context !== "object") return false;
  const ctx = context as Record<string, unknown>;
  return (
    typeof record.id === "string" && Boolean(record.id)
    && typeof record.shareId === "string"
    && typeof record.workspaceId === "string"
    && typeof record.createdAt === "string"
    && typeof record.expiresAt === "string"
    && typeof record.tokenHash === "string"
    && typeof ctx.summary === "string"
    && Array.isArray(ctx.interests)
    && Array.isArray(ctx.unansweredQuestions)
    && (record.recommendedNextStep === "call" || record.recommendedNextStep === "twin" || record.recommendedNextStep === "book")
    && (record.revokedAt === undefined || typeof record.revokedAt === "string")
  );
}

export class FileHandoffStorageProvider implements HandoffStorageProvider {
  readonly name = "file";
  private records = new Map<string, HandoffRecord>();
  private loadPromise: Promise<void> | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  async create(record: HandoffRecord): Promise<void> {
    return this.withWriteLock(async () => {
      await this.load();
      if (this.records.has(record.id)) {
        throw new Error("handoff already exists");
      }
      const staged = new Map(this.records);
      staged.set(record.id, clone(record));
      await this.persist(staged);
      this.records = staged;
    });
  }

  async get(id: string): Promise<HandoffRecord | null> {
    await this.load();
    const record = this.records.get(id);
    return record ? clone(record) : null;
  }

  async revoke(id: string, workspaceId: string, now: Date): Promise<HandoffRecord | null> {
    return this.withWriteLock(async () => {
      await this.load();
      const current = this.records.get(id);
      if (!current || current.workspaceId !== workspaceId) return null;
      const revoked = current.revokedAt ? clone(current) : { ...clone(current), revokedAt: now.toISOString() };
      const staged = new Map(this.records);
      staged.set(id, revoked);
      try {
        await this.persist(staged);
      } catch (error) {
        this.records = staged;
        throw error;
      }
      this.records = staged;
      return clone(revoked);
    });
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<HandoffRecord[]> {
    await this.load();
    return Array.from(this.records.values())
      .filter((record) => record.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }

  private async load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.readAll();
    }
    return this.loadPromise;
  }

  private async readAll(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(HANDOFF_FILE, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return;
      throw error;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("handoff store is corrupt: expected an array");
    }
    const loaded = new Map<string, HandoffRecord>();
    for (const entry of parsed) {
      if (!isHandoffRecord(entry)) {
        throw new Error("handoff store is corrupt: invalid record shape");
      }
      loaded.set(entry.id, clone(entry));
    }
    this.records = loaded;
  }

  private async persist(records: Map<string, HandoffRecord>): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${HANDOFF_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(tempFile, JSON.stringify(Array.from(records.values()), null, 2), "utf8");
    await rename(tempFile, HANDOFF_FILE);
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
