"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TeachingLadder } from "./teaching-ladder";

interface BookingRow {
  id: string;
  status: "started" | "requested" | "confirmed" | "cancelled";
  createdAt: string;
  startsAt: string | null;
  endsAt: string | null;
  recipient: string | null;
  reviewedBrief: {
    goal: string;
    discussed: string;
    openQuestions: string;
    reason: string;
    source: "recipient_reviewed";
    sharedAt: string;
  } | null;
}

const STATUS_LABEL: Record<BookingRow["status"], string> = {
  confirmed: "Provider-confirmed",
  requested: "Requested",
  cancelled: "Cancelled",
  started: "Opened",
};

const POLL_MS = 15_000;

export function ScheduledConversations() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  const inFlightRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    const controller = new AbortController();
    inFlightRef.current = controller;
    try {
      const res = await fetch("/api/scheduling/bookings", { signal: controller.signal });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { bookings?: BookingRow[] };
      if (!mountedRef.current) return;
      setRows(data.bookings || []);
      setLoaded(true);
      setError(false);
    } catch {
      if (mountedRef.current && !controller.signal.aborted) setError(true);
    } finally {
      if (inFlightRef.current === controller) inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    queueMicrotask(() => void load());
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      inFlightRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [load]);

  const shown = rows.filter((r) => r.status !== "started");
  if (!loaded && !error) return null;

  return (
    <div className="rounded-2xl border border-cream-dark bg-white/70 p-5 space-y-3">
      <h2 className="font-display text-lg text-ink">Scheduled conversations</h2>
      {error && (
        <p className="text-body-xs text-warm" role="status">
          Scheduled conversations couldn&apos;t be loaded.{" "}
          <button type="button" onClick={() => void load()} className="underline">Retry</button>
        </p>
      )}
      {loaded && !error && shown.length === 0 && (
        <div className="text-center py-2">
          <p className="text-body-xs text-ink-muted">No provider-confirmed bookings tracked here yet.</p>
          <p className="text-label-base text-ink-faint mt-1 mb-2">Bookings appear once a prospect picks a time on your scheduling link.</p>
          <div className="max-w-[320px] mx-auto">
            <TeachingLadder activeStep={2} compact />
          </div>
        </div>
      )}
      <ul className="space-y-3">
        {shown.map((row) => (
          <li key={row.id} className="rounded-xl border border-cream-dark/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body-sm text-ink font-medium break-words">
                {row.recipient || "Recipient"}
              </p>
              <p className="text-body-xs text-ink-faint">
                {STATUS_LABEL[row.status]}
                {row.startsAt ? ` · ${new Date(row.startsAt).toLocaleString()}` : ""}
              </p>
            </div>
            {row.reviewedBrief ? (
              <div className="mt-1.5 rounded-lg border border-accent/15 bg-accent-soft/30 px-3 py-2 space-y-1">
                <p className="text-body-xs text-ink-faint font-medium">Recipient-reviewed brief</p>
                {([["What they want", row.reviewedBrief.goal], ["What the AI explained", row.reviewedBrief.discussed], ["Still unresolved", row.reviewedBrief.openQuestions], ["Why they want to speak", row.reviewedBrief.reason]] as const)
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <p key={label} className="text-body-xs text-ink-muted">
                      <span className="text-ink-faint">{label}: </span>{v}
                    </p>
                  ))}
                <p className="text-[10px] text-ink-faint italic">
                  Recipient-reviewed summary, not a verified transcript or sender commitment.
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
