import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  addEvent,
  addListener,
  ensureSessionLoaded,
  getEvents,
  type BandAgent,
  type BandEventType,
  type BandEvent,
} from "@/lib/pipeline/activity-store";

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

  addEvent(event);

  return NextResponse.json({ ok: true, eventId: event.id });
}

// ── GET: SSE stream for browser ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Load persisted events from backing store if session isn't in memory
      await ensureSessionLoaded(sessionId);

      // Send all existing events (catch-up)
      for (const event of getEvents(sessionId)) {
        send(event);
      }

      // Register listener for new events
      const removeListener = addListener(sessionId, (event: BandEvent) => {
        send(event);
        if (event.eventType === "complete") {
          setTimeout(() => {
            removeListener();
            if (!closed) {
              try { controller.close(); } catch { /* already closed */ }
            }
          }, 500);
        }
      });

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", timestamp: new Date().toISOString() });
      }, 15000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        removeListener();
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
