import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SchedulingRecord, SchedulingStorageProvider } from "./types";
import { applySchedulingEvent, type SchedulingProviderEvent } from "@/lib/scheduling-server";
import { parseLiveCallBrief } from "@/lib/live-call-brief";

interface FileStore {
  records: Record<string, SchedulingRecord>;
}

interface PathState {
  lock: Promise<void>;
  loadPromise: Promise<void> | null;
  records: Record<string, SchedulingRecord>;
}

const PATH_STATES = new Map<string, PathState>();

function stateFor(pathname: string): PathState {
  let state = PATH_STATES.get(pathname);
  if (!state) {
    state = { lock: Promise.resolve(), loadPromise: null, records: {} };
    PATH_STATES.set(pathname, state);
  }
  return state;
}

function cloneRecord(record: SchedulingRecord): SchedulingRecord {
  return { ...record, reviewedBrief: record.reviewedBrief ? { ...record.reviewedBrief } : undefined };
}

const VALID_STATUSES = new Set(["started", "requested", "confirmed", "cancelled"]);

function isValidDateString(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseStored(data: unknown): SchedulingRecord | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const r = data as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || r.id.length > 128) return null;
  if (typeof r.shareId !== "string" || !r.shareId || r.shareId.length > 128) return null;
  if (typeof r.workspaceId !== "string" || !r.workspaceId || r.workspaceId.length > 128) return null;
  if (typeof r.provider !== "string" || !r.provider || r.provider.length > 64) return null;
  if (!Number.isSafeInteger(r.eventTypeId) || (r.eventTypeId as number) <= 0) return null;
  if (!isValidDateString(r.createdAt)) return null;
  if (typeof r.status !== "string" || !VALID_STATUSES.has(r.status)) return null;
  if (!Number.isSafeInteger(r.version) || (r.version as number) < 0) return null;
  if (r.providerBookingUid !== undefined && (typeof r.providerBookingUid !== "string" || r.providerBookingUid.length > 256)) return null;
  if (r.lastProviderEvent !== undefined && (typeof r.lastProviderEvent !== "string" || r.lastProviderEvent.length > 128)) return null;
  if (r.lastProviderEventAt !== undefined && !isValidDateString(r.lastProviderEventAt)) return null;
  if (r.startsAt !== undefined && !isValidDateString(r.startsAt)) return null;
  if (r.endsAt !== undefined && !isValidDateString(r.endsAt)) return null;
  if (r.reviewedBrief !== undefined) {
    if (!r.reviewedBrief || typeof r.reviewedBrief !== "object" || Array.isArray(r.reviewedBrief)) return null;
    const b = r.reviewedBrief as Record<string, unknown>;
    if (!parseLiveCallBrief({ goal: b.goal, discussed: b.discussed, openQuestions: b.openQuestions, reason: b.reason })
      || b.source !== "recipient_reviewed" || !isValidDateString(b.sharedAt)) return null;
  }
  return r as unknown as SchedulingRecord;
}

export class FileSchedulingStorageProvider implements SchedulingStorageProvider {
  readonly name = "file";
  private pathname: string;
  private state: PathState;

  constructor(dir?: string) {
    const base = dir || process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
    this.pathname = path.resolve(base, "scheduling.json");
    this.state = stateFor(this.pathname);
  }

  private reload(): Promise<void> {
    if (this.state.loadPromise) return this.state.loadPromise;
    const promise = (async () => {
      try {
        const raw = await readFile(this.pathname, "utf-8");
        const parsed = JSON.parse(raw) as FileStore;
        if (
          !parsed || typeof parsed !== "object" || Array.isArray(parsed)
          || !parsed.records || typeof parsed.records !== "object" || Array.isArray(parsed.records)
        ) {
          throw new Error("corrupt scheduling store");
        }
        const seen = new Set<string>();
        for (const [key, record] of Object.entries(parsed.records)) {
          const normalized = parseStored(record);
          if (!normalized || normalized.id !== key || seen.has(normalized.id)) {
            throw new Error("corrupt scheduling store");
          }
          seen.add(normalized.id);
        }
        this.state.records = { ...parsed.records };
      } catch (err) {
        if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
          this.state.records = {};
          return;
        }
        if (err instanceof SyntaxError) {
          throw new Error("corrupt scheduling store");
        }
        throw err;
      }
    })();
    this.state.loadPromise = promise;
    try {
      return promise;
    } finally {
      promise.then(
        () => { if (this.state.loadPromise === promise) this.state.loadPromise = null; },
        () => { if (this.state.loadPromise === promise) this.state.loadPromise = null; },
      );
    }
  }

  private withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.state.lock;
    let release: () => void;
    this.state.lock = new Promise<void>((resolve) => { release = resolve; });
    return prev.then(async () => {
      try {
        await this.reload();
        return await fn();
      } finally {
        release!();
      }
    });
  }

  private async persist(next: FileStore): Promise<void> {
    await mkdir(path.dirname(this.pathname), { recursive: true });
    const tmp = `${this.pathname}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2));
    await rename(tmp, this.pathname);
  }

  async create(record: SchedulingRecord): Promise<SchedulingRecord> {
    return this.withStoreLock(async () => {
      if (Object.hasOwn(this.state.records, record.id)) throw new Error("duplicate scheduling record");
      const stored = cloneRecord(record);
      const next: FileStore = { records: { ...this.state.records, [record.id]: stored } };
      await this.persist(next);
      this.state.records = next.records;
      return cloneRecord(stored);
    });
  }

  async get(id: string): Promise<SchedulingRecord | null> {
    return this.withStoreLock(async () => {
      const record = Object.hasOwn(this.state.records, id) ? this.state.records[id] : undefined;
      return record ? cloneRecord(record) : null;
    });
  }

  async applyProviderEvent(id: string, event: SchedulingProviderEvent): Promise<SchedulingRecord | null> {
    return this.withStoreLock(async () => {
      const existing = Object.hasOwn(this.state.records, id) ? this.state.records[id] : undefined;
      if (!existing) return null;
      const updated = applySchedulingEvent(existing, event);
      if (!updated || updated.version === existing.version) {
        return cloneRecord(existing);
      }
      const next: FileStore = { records: { ...this.state.records, [id]: updated } };
      await this.persist(next);
      this.state.records = next.records;
      return cloneRecord(updated);
    });
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<SchedulingRecord[]> {
    return this.withStoreLock(async () => {
      return Object.values(this.state.records)
        .filter((r) => r.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(cloneRecord);
    });
  }
}
