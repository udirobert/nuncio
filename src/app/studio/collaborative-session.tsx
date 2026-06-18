"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

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

interface CollaborativeSessionProps {
  sessionId: string;
  events: BandEvent[];
  onSendMessage: (content: string) => void;
  onComplete: (data: { script: string; profile?: Record<string, unknown> }) => void;
  onSkipAhead?: () => void;
}

// ── Agent config ──────────────────────────────────────────────────────────────

const AGENT_META: Record<BandAgent, { label: string; icon: string; color: string; bgColor: string }> = {
  researcher: { label: "Researcher", icon: "M", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  copywriter: { label: "Copywriter", icon: "W", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
  reviewer: { label: "Reviewer", icon: "R", color: "text-green-600", bgColor: "bg-green-50 border-green-200" },
  producer: { label: "Producer", icon: "P", color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200" },
  user: { label: "You", icon: "U", color: "text-accent", bgColor: "bg-accent-soft border-accent/20" },
  system: { label: "System", icon: "S", color: "text-ink-faint", bgColor: "bg-cream border-cream-dark" },
};

const PIPELINE_STEPS = [
  { id: "researcher", label: "Research", avgSeconds: 20 },
  { id: "copywriter", label: "Script", avgSeconds: 12 },
  { id: "reviewer", label: "Review", avgSeconds: 3 },
  { id: "producer", label: "Render", avgSeconds: 75 },
] as const;

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

// ── Agent avatar icon ─────────────────────────────────────────────────────────

function AgentIcon({ agent }: { agent: BandAgent }) {
  const meta = AGENT_META[agent];

  if (agent === "researcher") {
    return (
      <div className={`w-7 h-7 rounded-xl ${meta.bgColor} border flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${meta.color}`} fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="7" cy="7" r="4" />
          <path d="M10 10l3 3" />
        </svg>
      </div>
    );
  }
  if (agent === "copywriter") {
    return (
      <div className={`w-7 h-7 rounded-xl ${meta.bgColor} border flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${meta.color}`} fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M11 2l3 3-8 8H3v-3l8-8z" />
        </svg>
      </div>
    );
  }
  if (agent === "reviewer") {
    return (
      <div className={`w-7 h-7 rounded-xl ${meta.bgColor} border flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${meta.color}`} fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 8.5l3 3 7-7" />
        </svg>
      </div>
    );
  }
  if (agent === "producer") {
    return (
      <div className={`w-7 h-7 rounded-xl ${meta.bgColor} border flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${meta.color}`} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <path d="M6 6l4 2.5L6 11V6z" fill="currentColor" />
        </svg>
      </div>
    );
  }
  if (agent === "user") {
    return (
      <div className={`w-7 h-7 rounded-xl ${meta.bgColor} border flex items-center justify-center shrink-0`}>
        <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${meta.color}`} fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="8" cy="5" r="3" />
          <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        </svg>
      </div>
    );
  }
  // system
  return (
    <div className={`w-7 h-7 rounded-xl ${meta.bgColor} border flex items-center justify-center shrink-0`}>
      <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${meta.color}`} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5v3M8 10v1" />
      </svg>
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: BandEvent }) {
  const meta = AGENT_META[event.agent];
  const isUser = event.agent === "user" || event.eventType === "user_message";

  if (event.eventType === "stage_complete") {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <div className="flex-1 h-px bg-success/30" />
        <span className="text-[10px] uppercase tracking-widest text-success font-medium">{event.content}</span>
        <div className="flex-1 h-px bg-success/30" />
      </div>
    );
  }

  if (event.eventType === "complete") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-success/30 bg-success-soft/40 p-4 text-center space-y-1"
      >
        <p className="text-sm font-medium text-success">Session complete</p>
        <p className="text-xs text-ink-muted">{event.content}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <AgentIcon agent={event.agent} />
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        <div className="flex items-center gap-2 mb-0.5">
          {isUser && <span className="flex-1" />}
          <span className={`text-[10px] uppercase tracking-widest font-medium ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-ink-faint">
            {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {event.eventType === "thought" ? (
          <div className="flex items-center gap-2 text-xs text-ink-faint italic">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
            {event.content}
          </div>
        ) : event.eventType === "error" ? (
          <div className="rounded-xl border border-error/20 bg-error-soft/40 p-3 text-xs text-error">
            {event.content}
          </div>
        ) : (
          <div className={`rounded-xl border p-3 text-xs leading-relaxed ${
            isUser
              ? "border-accent/20 bg-accent-soft/30 text-ink"
              : "border-cream-dark bg-white text-ink-light"
          }`}>
            <div className="whitespace-pre-wrap">{event.content}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CollaborativeSession({
  sessionId,
  events,
  onSendMessage,
  onComplete,
  onSkipAhead,
}: CollaborativeSessionProps) {
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number>(0);

  // Elapsed timer
  useEffect(() => {
    startedAt.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Detect completion
  useEffect(() => {
    const completeEvent = events.find((e) => e.eventType === "complete");
    if (completeEvent?.metadata) {
      const { script, profile } = completeEvent.metadata as { script?: string; profile?: Record<string, unknown> };
      if (script) {
        onComplete({ script, profile });
      }
    }
  }, [events, onComplete]);

  // Compute pipeline progress from events
  const completedAgents = new Set(
    events.filter((e) => e.eventType === "stage_complete").map((e) => e.agent),
  );
  const activeAgent = (() => {
    const thoughts = events.filter((e) => e.eventType === "thought");
    return thoughts.length > 0 ? thoughts[thoughts.length - 1].agent : null;
  })();

  const currentStepIndex = PIPELINE_STEPS.findIndex(
    (step) => !completedAgents.has(step.id),
  );
  const currentStepNumber = currentStepIndex === -1
    ? PIPELINE_STEPS.length
    : currentStepIndex + 1;
  const remainingSeconds = currentStepIndex === -1
    ? 0
    : PIPELINE_STEPS.slice(currentStepIndex).reduce((sum, s) => sum + s.avgSeconds, 0);
  const hasProgress = completedAgents.size > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setMessage("");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      <section className="relative px-6 pt-20 pb-8 min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/15">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="text-[10px] uppercase tracking-widest font-medium text-accent">
                Collaborative Session
              </span>
            </div>
            <div className="flex items-center gap-3">
              {hasProgress && (
                <span className="text-[11px] text-ink-muted tabular-nums">
                  Step {currentStepNumber} of {PIPELINE_STEPS.length}
                  {remainingSeconds > 0 && (
                    <> · <span className="text-ink-faint">~{remainingSeconds < 60 ? `${remainingSeconds}s` : `${Math.ceil(remainingSeconds / 60)}m`} left</span></>
                  )}
                </span>
              )}
              <span className="text-xs text-ink-faint tabular-nums">{formatElapsed(elapsed)}</span>
            </div>
          </div>

          {/* Pipeline progress */}
          <div className="flex items-center gap-1">
            {PIPELINE_STEPS.map((step, i) => {
              const isComplete = completedAgents.has(step.id);
              const isActive = activeAgent === step.id && !isComplete;
              return (
                <div key={step.id} className="flex items-center gap-1 flex-1">
                  <div className={`flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] uppercase tracking-widest font-medium transition-colors ${
                    isComplete
                      ? "bg-success/10 text-success"
                      : isActive
                        ? "bg-accent-soft text-accent"
                        : "bg-cream text-ink-faint"
                  }`}>
                    {isComplete ? (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 shrink-0" fill="currentColor">
                        <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                      </svg>
                    ) : isActive ? (
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full border border-ink-faint/40 shrink-0" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className={`w-3 h-px ${isComplete ? "bg-success/40" : "bg-cream-dark"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Event feed */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-3 rounded-2xl border border-cream-dark bg-cream/30 p-4 min-h-[300px] max-h-[50vh]"
          >
            <AnimatePresence>
              {events.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-ink-faint">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                    Agents starting...
                  </div>
                </div>
              ) : (
                events.map((event) => <EventCard key={event.id} event={event} />)
              )}
            </AnimatePresence>
          </div>

          {/* User input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send a message to the agents..."
              className="flex-1 rounded-xl border border-cream-dark bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 8h12M10 4l4 4-4 4" />
              </svg>
            </button>
          </form>

          {onSkipAhead && events.length > 0 && (
            <div className="text-center">
              <button
                onClick={onSkipAhead}
                className="text-[11px] text-ink-faint hover:text-accent transition-colors"
              >
                Skip ahead to review
              </button>
            </div>
          )}

          {/* Session ID hint */}
          <p className="text-[10px] text-ink-faint text-center">
            Session {sessionId.slice(0, 8)} — agents are working on your video
          </p>
        </div>
      </section>
    </motion.div>
  );
}
