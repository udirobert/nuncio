import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Batch } from "@/lib/batch/types";
import type { BatchStorageProvider } from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const BATCH_FILE = path.join(DATA_DIR, "batches.json");

export class FileBatchStorageProvider implements BatchStorageProvider {
  readonly name = "file";
  private batches = new Map<string, Batch>();
  private loaded = false;

  async create(batch: Batch): Promise<void> {
    await this.load();
    this.batches.set(batch.id, batch);
    await this.persist();
  }

  async get(id: string): Promise<Batch | null> {
    await this.load();
    return this.batches.get(id) || null;
  }

  async list(): Promise<Batch[]> {
    await this.load();
    return Array.from(this.batches.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async update(record: Batch): Promise<void> {
    await this.load();
    this.batches.set(record.id, record);
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    await this.load();
    this.batches.delete(id);
    await this.persist();
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(BATCH_FILE, "utf8");
      const parsed = JSON.parse(raw) as Batch[];
      for (const batch of parsed) {
        this.batches.set(batch.id, batch);
      }
    } catch {
      // start empty
    }
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      BATCH_FILE,
      JSON.stringify(Array.from(this.batches.values()), null, 2),
      "utf8"
    );
  }
}
