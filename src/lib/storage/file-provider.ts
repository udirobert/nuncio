import type { ShareRecord } from "@/lib/artifacts";
import type { ShareRecordInput, ShareStorageProvider } from "./types";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const SHARE_FILE = path.join(DATA_DIR, "share-records.json");

export class FileShareStorageProvider implements ShareStorageProvider {
  readonly name = "file";
  private records = new Map<string, ShareRecord>();
  private loaded = false;

  async create(input: ShareRecordInput): Promise<ShareRecord> {
    await this.load();
    const record: ShareRecord = {
      ...input,
      id: crypto.randomUUID().slice(0, 12),
      createdAt: new Date().toISOString(),
    };

    this.records.set(record.id, record);
    await this.persist();
    return record;
  }

  async get(id: string): Promise<ShareRecord | null> {
    await this.load();
    return this.records.get(id) || null;
  }

  async update(record: ShareRecord): Promise<void> {
    await this.load();
    this.records.set(record.id, record);
    await this.persist();
  }

  async list(options?: { limit?: number; industry?: string; privacy?: string }): Promise<ShareRecord[]> {
    await this.load();
    const limit = options?.limit || 50;
    const privacy = options?.privacy;
    const industry = options?.industry;

    const records = Array.from(this.records.values())
      .filter((r) => {
        if (privacy && r.privacy !== privacy) return false;
        if (industry && r.industry !== industry) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return records;
  }

  async findByCustomerId(customerId: string): Promise<ShareRecord | null> {
    await this.load();
    for (const record of this.records.values()) {
      if (record.stripeCustomerId === customerId) {
        return record;
      }
    }
    return null;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const raw = await readFile(SHARE_FILE, "utf8");
      const parsed = JSON.parse(raw) as ShareRecord[];
      for (const record of parsed) {
        this.records.set(record.id, record);
      }
    } catch {
      // Missing or unreadable store is non-fatal; start empty.
    }
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      SHARE_FILE,
      JSON.stringify(Array.from(this.records.values()), null, 2),
      "utf8"
    );
  }
}