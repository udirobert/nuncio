import type { ShareRecord } from "@/lib/artifacts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const records = new Map<string, ShareRecord>();
let loaded = false;

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const SHARE_FILE = path.join(DATA_DIR, "share-records.json");

function createId(): string {
  return crypto.randomUUID().slice(0, 12);
}

async function loadRecords(): Promise<void> {
  if (loaded) return;
  loaded = true;

  try {
    const raw = await readFile(SHARE_FILE, "utf8");
    const parsed = JSON.parse(raw) as ShareRecord[];
    for (const record of parsed) {
      records.set(record.id, record);
    }
  } catch {
    // Missing or unreadable store is non-fatal; start empty.
  }
}

async function persistRecords(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    SHARE_FILE,
    JSON.stringify(Array.from(records.values()), null, 2),
    "utf8"
  );
}

export async function createShareRecord(
  input: Omit<ShareRecord, "id" | "createdAt">
): Promise<ShareRecord> {
  await loadRecords();

  const record: ShareRecord = {
    ...input,
    id: createId(),
    createdAt: new Date().toISOString(),
  };

  records.set(record.id, record);
  await persistRecords();

  return record;
}

export async function getShareRecord(id: string): Promise<ShareRecord | null> {
  await loadRecords();
  return records.get(id) || null;
}