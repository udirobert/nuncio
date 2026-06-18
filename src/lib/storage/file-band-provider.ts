import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BandActivityEvent, BandActivityStorageProvider } from "./types";

export class FileBandActivityProvider implements BandActivityStorageProvider {
  readonly name = "file";
  private dir: string;

  constructor() {
    this.dir = process.env.NUNCIO_DATA_DIR || join(process.cwd(), ".nuncio-data");
  }

  private filePath(sessionId: string): string {
    return join(this.dir, `band-events-${sessionId}.json`);
  }

  private async readEvents(sessionId: string): Promise<BandActivityEvent[]> {
    try {
      const raw = await readFile(this.filePath(sessionId), "utf-8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async addEvent(event: BandActivityEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const events = await this.readEvents(event.sessionId);
    if (events.some((e) => e.id === event.id)) return;
    events.push(event);
    await writeFile(this.filePath(event.sessionId), JSON.stringify(events, null, 2));
  }

  async getEvents(sessionId: string): Promise<BandActivityEvent[]> {
    return this.readEvents(sessionId);
  }
}
