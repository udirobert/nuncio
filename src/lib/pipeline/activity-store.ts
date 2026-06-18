/**
 * Shared in-memory activity store with pub/sub.
 *
 * Used by both the `/api/band/activity` HTTP route (external agents / browser)
 * and the server-side `PipelineActivityEmitter` (in-process pipeline).
 *
 * Events are persisted to a backing store (Turso or file) for durability.
 */

import { getBandActivityProvider } from "@/lib/storage";

export type BandAgent =
  | "researcher"
  | "copywriter"
  | "reviewer"
  | "producer"
  | "user"
  | "system";

export type BandEventType =
  | "thought"
  | "message"
  | "error"
  | "user_message"
  | "stage_complete"
  | "complete";

export interface BandEvent {
  id: string;
  sessionId: string;
  agent: BandAgent;
  eventType: BandEventType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface SessionStore {
  events: BandEvent[];
  listeners: Set<(event: BandEvent) => void>;
  createdAt: number;
  persisted: boolean;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const store = new Map<string, SessionStore>();

let cleanupScheduled = false;

function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    cleanupScheduled = false;
    const now = Date.now();
    for (const [id, session] of store) {
      if (now - session.createdAt > SESSION_TTL_MS && session.listeners.size === 0) {
        store.delete(id);
      }
    }
  }, 5 * 60 * 1000);
}

function persistEvent(event: BandEvent): void {
  getBandActivityProvider()
    .addEvent(event)
    .catch((err) => console.error("[activity-store] persist failed:", err));
}

async function loadFromPersisted(sessionId: string): Promise<BandEvent[]> {
  try {
    const events = await getBandActivityProvider().getEvents(sessionId);
    return events as BandEvent[];
  } catch {
    return [];
  }
}

export function getSession(sessionId: string): SessionStore {
  let session = store.get(sessionId);
  if (!session) {
    session = { events: [], listeners: new Set(), createdAt: Date.now(), persisted: false };
    store.set(sessionId, session);
  }
  return session;
}

export function addEvent(event: BandEvent): void {
  const session = getSession(event.sessionId);
  session.events.push(event);
  for (const listener of session.listeners) {
    listener(event);
  }
  persistEvent(event);
  scheduleCleanup();
}

export function addListener(
  sessionId: string,
  listener: (event: BandEvent) => void,
): () => void {
  const session = getSession(sessionId);
  session.listeners.add(listener);
  return () => {
    session.listeners.delete(listener);
  };
}

export function getEvents(sessionId: string): BandEvent[] {
  return getSession(sessionId).events;
}

export async function ensureSessionLoaded(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (session.persisted || session.events.length > 0) return;
  const persisted = await loadFromPersisted(sessionId);
  if (persisted.length > 0 && session.events.length === 0) {
    session.events = persisted as BandEvent[];
    session.persisted = true;
  }
}
