/**
 * Server-side activity emitter for the unified pipeline.
 *
 * Emits structured events into the shared activity store so the
 * collaborative panel can display server-side pipeline steps as if
 * they were produced by remote agents.
 */

import { randomUUID } from "node:crypto";
import { addEvent, type BandAgent, type BandEventType, type BandEvent } from "./activity-store";

export class PipelineActivityEmitter {
  constructor(private readonly sessionId: string) {}

  thought(agent: BandAgent, content: string): void {
    this.emit(agent, "thought", content);
  }

  message(agent: BandAgent, content: string, metadata?: Record<string, unknown>): void {
    this.emit(agent, "message", content, metadata);
  }

  error(agent: BandAgent, content: string): void {
    this.emit(agent, "error", content);
  }

  stageComplete(agent: BandAgent, label: string): void {
    this.emit(agent, "stage_complete", label);
  }

  complete(agent: BandAgent, content: string, metadata?: Record<string, unknown>): void {
    this.emit(agent, "complete", content, metadata);
  }

  checkpoint(agent: BandAgent, content: string, metadata?: Record<string, unknown>): void {
    this.emit(agent, "checkpoint", content, metadata);
  }

  private emit(
    agent: BandAgent,
    eventType: BandEventType,
    content: string,
    metadata?: Record<string, unknown>,
  ): void {
    const event: BandEvent = {
      id: randomUUID(),
      sessionId: this.sessionId,
      agent,
      eventType,
      content,
      metadata,
      timestamp: new Date().toISOString(),
    };
    addEvent(event);
  }
}
