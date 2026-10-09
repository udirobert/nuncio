"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ApprovalItem {
  id: string;
  tool: string;
  requesterClass: string;
  summary: string;
  estimatedCredits?: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  workspaceId: string;
  callbackUrl?: string;
}

const POLL_MS = 15_000;

/**
 * Governance approvals inbox — the "deal desk" surface for the autonomous
 * agent. Pending requests from the agent surface (renders, checkouts,
 * handoffs) land here; approve mints a single-use grant token shown exactly
 * once — the agent retries with it in x-nuncio-approval-grant. Deny refuses
 * the call for good. Empty state renders nothing: it is an alert surface,
 * not furniture.
 */
export function ApprovalsCard() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grant, setGrant] = useState<{ approvalId: string; token: string; expiresAt?: string; delivered?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/agent/approvals?status=pending", { signal: controller.signal });
      if (!res.ok || !mountedRef.current) return;
      const data = (await res.json()) as { approvals?: ApprovalItem[] };
      const now = Date.now();
      setItems(
        (data.approvals || []).filter((a) => new Date(a.expiresAt).getTime() > now),
      );
      setLoaded(true);
    } catch {
      // transient — next poll retries
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    queueMicrotask(() => void refresh());
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [refresh]);

  const decide = useCallback(async (id: string, decision: "approved" | "denied") => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/agent/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        grantToken?: string;
        grantExpiresAt?: string;
        grantDelivered?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Could not decide the approval — try again.");
      } else if (decision === "approved" && data.grantToken) {
        setGrant({ approvalId: id, token: data.grantToken, expiresAt: data.grantExpiresAt, delivered: data.grantDelivered });
      }
      await refresh();
    } catch {
      setError("Could not decide the approval — check your connection.");
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const copyGrant = useCallback(async () => {
    if (!grant) return;
    try {
      await navigator.clipboard.writeText(grant.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — token is selectable */
    }
  }, [grant]);

  if (!loaded || (items.length === 0 && !grant)) return null;

  return (
    <div className="rounded-2xl border border-warm/40 bg-warm-soft/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Agent approvals</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-warm/15 px-2.5 py-0.5 text-body-xs font-medium text-warm">
            {items.length} pending
          </span>
        )}
      </div>

      {grant && (
        <div className="rounded-xl border border-accent/25 bg-accent-soft/40 px-3 py-3 space-y-2">
          <p className="text-body-xs font-medium text-ink">
            Approved{grant.delivered ? " — grant sent to the agent's callback" : " — grant token"} (shown once, expires{" "}
            {grant.expiresAt ? new Date(grant.expiresAt).toLocaleTimeString() : "soon"}):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded bg-white/70 px-2 py-1 font-mono text-[11px] text-ink">
              {grant.token}
            </code>
            <button
              type="button"
              onClick={() => void copyGrant()}
              className="btn-press shrink-0 rounded-lg border border-ink/15 px-2.5 py-1 text-body-xs text-ink-muted hover:text-ink"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setGrant(null)}
              className="btn-press shrink-0 rounded-lg px-2 py-1 text-body-xs text-ink-faint hover:text-ink"
            >
              Done
            </button>
          </div>
          <p className="text-body-xs text-ink-faint leading-relaxed">
            {grant.delivered ? (
              "The token below is a fallback — the agent already received it. Single use; a different call needs a new approval."
            ) : (
              <>
                Hand this to the agent — it retries the call with header{" "}
                <code className="font-mono">x-nuncio-approval-grant</code>. Single use; a
                different call needs a new approval.
              </>
            )}
          </p>
        </div>
      )}

      {error && <p className="text-body-xs text-warm">{error}</p>}

      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink">{a.summary}</p>
                <p className="text-body-xs text-ink-faint mt-0.5">
                  {a.tool}
                  {typeof a.estimatedCredits === "number" ? ` · ~${a.estimatedCredits} credits` : ""}
                  {" · expires "}
                  {new Date(a.expiresAt).toLocaleTimeString()}
                  {a.callbackUrl ? " · grant auto-delivers to agent" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => void decide(a.id, "approved")}
                  className="btn-press rounded-lg bg-accent px-3 py-1.5 text-body-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50 min-h-[36px]"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === a.id}
                  onClick={() => void decide(a.id, "denied")}
                  className="btn-press rounded-lg border border-ink/15 px-3 py-1.5 text-body-xs font-medium text-ink-muted hover:text-ink disabled:opacity-50 min-h-[36px]"
                >
                  Deny
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
