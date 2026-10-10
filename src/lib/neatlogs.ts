/**
 * Neatlogs observability — opt-in agent tracing for the neatHack entry.
 *
 * Set NEATLOGS_API_KEY to activate; every helper here is a no-op without it,
 * so instrumentation can never break the app or leak into tests. Follows the
 * same opt-in pattern as Sentry (SENTRY_DSN) and PostHog
 * (NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN).
 *
 * `traced()` wraps a block of code in a Neatlogs span: the callback receives a
 * minimal span handle (`setAttribute`) that is a no-op when tracing is off, so
 * call sites never branch on configuration. Thrown errors are recorded on the
 * span and re-thrown — observability never swallows failures.
 *
 * Init is lazy and process-wide (memoized promise). The SDK registers its own
 * shutdown handlers by default; src/server/production.ts adds an explicit
 * drain so spans survive the tsx wrapper's teardown either way.
 */

export type NeatlogsSpanKind =
  | "WORKFLOW"
  | "AGENT"
  | "CHAIN"
  | "TOOL"
  | "RETRIEVER"
  | "EMBEDDING"
  | "GUARDRAIL"
  | "MCP_TOOL"
  | "LLM";

export interface NeatlogsTraceOptions {
  name: string;
  kind: NeatlogsSpanKind;
  /** Groups related traces (e.g. queueId, shareId, SSE sessionId). */
  sessionId?: string;
  /** The workspace this run belongs to (tenant-level end user). */
  endUserId?: string;
  /** Serialized onto the root span as the trace's input. */
  input?: unknown;
}

/** Minimal handle passed to traced() callbacks — no real SDK surface leaks. */
export interface TracedSpan {
  setAttribute(key: string, value: string | number | boolean): void;
}

const NOOP_SPAN: TracedSpan = { setAttribute() {} };

let initPromise: Promise<boolean> | null = null;

export function neatlogsEnabled(): boolean {
  return Boolean(process.env.NEATLOGS_API_KEY);
}

async function ensureInit(): Promise<boolean> {
  if (!neatlogsEnabled()) return false;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { init } = await import("neatlogs");
        await init({
          apiKey: process.env.NEATLOGS_API_KEY!,
          workflowName: process.env.NEATLOGS_WORKFLOW_NAME || "nuncio",
          // Console capture stays off: logs are a separate data path whose
          // coverage under project PII redaction is unverified, and prospect
          // URLs/provider errors can appear in console output.
          captureLogs: false,
          tags: ["nuncio", "neathack"],
          ...(process.env.NEATLOGS_ENDPOINT
            ? { endpoint: process.env.NEATLOGS_ENDPOINT }
            : {}),
          // Local verification path: exercise traced() without shipping data.
          ...(process.env.NEATLOGS_DISABLE_EXPORT === "true"
            ? { disableExport: true }
            : {}),
        });
        return true;
      } catch (err) {
        console.warn(
          "[neatlogs] init failed, tracing disabled:",
          err instanceof Error ? err.message : err,
        );
        initPromise = null; // allow retry on next call
        return false;
      }
    })();
  }
  return initPromise;
}

function asHandle(activeSpan: unknown): TracedSpan {
  if (
    activeSpan &&
    typeof (activeSpan as { setAttribute?: unknown }).setAttribute === "function"
  ) {
    return activeSpan as TracedSpan;
  }
  return NOOP_SPAN;
}

/**
 * Run `fn` inside a Neatlogs span when tracing is enabled; otherwise run it
 * untraced. `fn`'s own errors always propagate (they are what the span
 * records); only failures in the tracing setup itself fall back to running
 * untraced, and only when `fn` has not already run.
 */
export async function traced<T>(
  options: NeatlogsTraceOptions,
  fn: (span: TracedSpan) => T | Promise<T>,
): Promise<T> {
  if (!(await ensureInit())) return fn(NOOP_SPAN);

  let fnRan = false;
  try {
    const { trace } = await import("neatlogs");
    return await trace(
      options as Parameters<typeof trace>[0],
      async (activeSpan: unknown) => {
        fnRan = true;
        return await fn(asHandle(activeSpan));
      },
    );
  } catch (err) {
    if (fnRan) throw err; // fn threw — the span recorded it; let it propagate
    console.warn(
      "[neatlogs] trace() unavailable, running untraced:",
      err instanceof Error ? err.message : err,
    );
    return fn(NOOP_SPAN);
  }
}

/**
 * Emit a named marker span inside the active trace. Detections key off
 * canonical fields (span_name, status) — custom attributes are exported but
 * not visible to the detection engine, so decision points that must be
 * detectable get their own named span (also reads well in the waterfall).
 */
export async function mark(
  name: string,
  kind: NeatlogsSpanKind = "GUARDRAIL",
): Promise<void> {
  try {
    await traced({ name, kind }, async () => {});
  } catch {
    /* marker spans must never affect the run */
  }
}

/**
 * Record a timestamped note inside the active span. No-op when tracing is off.
 * Levels map onto the `level` key understood by the Neatlogs log templates.
 */
export function traceLog(
  message: string,
  data?: Record<string, string | number | boolean>,
): void {
  if (!neatlogsEnabled() || !initPromise) return;
  void import("neatlogs")
    .then(({ log }) => log(message, data as Record<string, unknown>))
    .catch(() => {});
}

/** Drain queued telemetry — call once on graceful server shutdown. */
export async function shutdownTraces(): Promise<void> {
  if (!initPromise) return;
  try {
    const { flush, shutdown } = await import("neatlogs");
    await flush();
    await shutdown();
  } catch (err) {
    console.warn(
      "[neatlogs] shutdown flush failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
