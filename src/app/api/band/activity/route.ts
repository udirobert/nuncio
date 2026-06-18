import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BandAgent = "researcher" | "copywriter" | "reviewer" | "producer" | "user" | "system";
export type BandEventType = "thought" | "message" | "error" | "user_message" | "stage_complete" | "complete";

export interface BandEvent {
  id: string;
  sessionId: string;
  agent: BandAgent;
  eventType: BandEventType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ── In-memory activity store with pub/sub ─────────────────────────────────────

interface SessionStore {
  events: BandEvent[];
  listeners: Set<(event: BandEvent) => void>;
  createdAt: number;
}

const store = new Map<string, SessionStore>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getSession(sessionId: string): SessionStore {
  let session = store.get(sessionId);
  if (!session) {
    session = { events: [], listeners: new Set(), createdAt: Date.now() };
    store.set(sessionId, session);
  }
  return session;
}

// Periodic cleanup of expired sessions
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

// ── POST: agents and users write events ───────────────────────────────────────

export async function POST(request: NextRequest) {
  const { sessionId, agent, eventType, content, metadata } = await request.json();

  if (!sessionId || !agent || !eventType || !content) {
    return NextResponse.json(
      { error: "sessionId, agent, eventType, and content are required" },
      { status: 400 },
    );
  }

  const event: BandEvent = {
    id: randomUUID(),
    sessionId,
    agent,
    eventType,
    content,
    metadata,
    timestamp: new Date().toISOString(),
  };

  const session = getSession(sessionId);
  session.events.push(event);

  // Notify all connected SSE listeners
  for (const listener of session.listeners) {
    listener(event);
  }

  scheduleCleanup();

  return NextResponse.json({ ok: true, eventId: event.id });
}

// ── GET: SSE stream for browser ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = getSession(sessionId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send all existing events first (catch-up)
      for (const event of session.events) {
        send(event);
      }

      // Register listener for new events
      const listener = (event: BandEvent) => {
        send(event);
        if (event.eventType === "complete") {
          // Close stream after complete event
          setTimeout(() => {
            session.listeners.delete(listener);
            if (!closed) {
              try { controller.close(); } catch { /* already closed */ }
            }
          }, 500);
        }
      };

      session.listeners.add(listener);

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", timestamp: new Date().toISOString() });
      }, 15000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        session.listeners.delete(listener);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
