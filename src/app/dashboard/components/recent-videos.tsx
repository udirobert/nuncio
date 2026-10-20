"use client";

import { useState } from "react";
import Link from "next/link";
import { LottieIcon } from "@/components/lottie-icon";
import { TeachingLadder } from "./teaching-ladder";
import { RelationshipChip, relationshipSentence } from "@/components/relationship-chip";
import type { InboxEntry } from "@/lib/inbox";
import { APP_ROUTES } from "@/lib/navigation";

interface BatchJob {
  id: string;
  url: string;
  recipientName?: string;
  status: string;
  videoId?: string;
  error?: string;
}

export interface BatchSummary {
  id: string;
  name: string;
  status: string;
  jobs: BatchJob[];
  completedCount: number;
  failedCount: number;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function batchStatus(b: BatchSummary): "completed" | "failed" | "running" | "partial" {
  const completedCount = b.completedCount || 0;
  const failedCount = b.failedCount || 0;
  const totalJobs = b.jobs?.length || 0;
  if (b.status === "running" || b.status === "queued") return "running";
  if (failedCount > 0 && completedCount > 0) return "partial";
  if (failedCount === totalJobs) return "failed";
  return "completed";
}

const BATCH_STATUS_TEXT: Record<string, string> = {
  completed: "Completed",
  failed: "Failed",
  running: "Running",
  partial: "Partial",
};

export function RecentVideos({
  entries,
  batches,
  batchError,
}: {
  entries: InboxEntry[];
  batches: BatchSummary[];
  batchError: boolean;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);

  const copyLink = async (id: string, href: string) => {
    setCopyFailedId(null);
    const url = new URL(href, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopyFailedId(id);
    }
  };

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Sent first touches
        </span>
        <Link
          href={APP_ROUTES.create}
          className="text-label-sm uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Create one
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-ink-muted mb-1">No first touches yet</p>
          <p className="text-label-base text-ink-faint mb-3">Your first link is the start — conversations and bookings follow.</p>
          <div className="max-w-[320px] mx-auto">
            <TeachingLadder activeStep={0} compact />
          </div>
        </div>
      ) : (
        <ul className="space-y-1">
          {entries.map((ft) => {
            const isLive = ft.deliveryMode === "livelink";
            const href = isLive ? `/live/${ft.id}` : `/v/${ft.id}`;
            const created = formatDate(ft.createdAt);
            const waiting = ft.firstViewedAt ? formatDate(ft.firstViewedAt) : null;
            return (
              <li key={ft.id} className="p-2.5 rounded-xl hover:bg-cream-dark/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      isLive ? "bg-accent/10" : "bg-success/10"
                    }`}
                  >
                    {isLive ? (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="6" cy="6" r="4" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
                        <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-body-xs text-ink font-medium truncate">
                        {ft.recipientName || "Untitled"}
                      </span>
                      <RelationshipChip state={ft.state} />
                    </div>
                    <div className="text-label-sm text-ink-faint truncate">
                      {relationshipSentence(ft.state, ft.recipientName, waiting)}
                    </div>
                    <div className="text-label-xs text-ink-faint">
                      {isLive ? "Live link" : "Recorded first touch"} · sent {created}
                      {ft.conversationCount > 0 ? ` · ${ft.conversationCount} conversation${ft.conversationCount > 1 ? "s" : ""}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ft.invitationProtected ? (
                      <Link
                        href={href}
                        className="text-label-sm uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
                      >
                        Owner view
                      </Link>
                    ) : (
                      <>
                        <button
                          onClick={() => copyLink(ft.id, href)}
                          className="text-label-sm uppercase tracking-widest font-medium text-ink-faint hover:text-ink transition-colors min-h-[44px] px-1"
                        >
                          {copiedId === ft.id ? "Copied!" : "Copy link"}
                        </button>
                        <Link
                          href={href}
                          target="_blank"
                          className="text-label-sm uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
                        >
                          View
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                {ft.invitationProtected && (
                  <p className="text-label-base text-ink-faint mt-1 ml-7">
                    Private invitation: send the original link from the authorized handoff; this is your owner view.
                  </p>
                )}
                {copyFailedId === ft.id && (
                  <p className="text-label-base text-warm mt-1 ml-7">
                    Copy unavailable. Use View to open the link.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {batchError && (
        <p className="text-label-base text-ink-faint border-t border-cream-dark pt-3">
          Batch campaigns couldn&apos;t be loaded.
        </p>
      )}

      {batches.length > 0 && (
        <details className="border-t border-cream-dark pt-3">
          <summary className="text-label-sm uppercase tracking-widest text-ink-faint font-medium cursor-pointer list-none">
            Batch campaigns ({batches.length})
          </summary>
          <ul className="space-y-1 pt-3">
            {batches.map((b) => {
              const status = batchStatus(b);
              const totalJobs = b.jobs?.length || 0;
              return (
                <li key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-cream-dark/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-body-xs text-ink font-medium truncate">{b.name || "Untitled campaign"}</div>
                    <div className="text-label-sm text-ink-faint">
                      <span
                        className={
                          status === "completed"
                            ? "text-success"
                            : status === "failed"
                              ? "text-error"
                              : status === "running"
                                ? "text-accent"
                                : "text-warm"
                        }
                      >
                        {BATCH_STATUS_TEXT[status]}
                      </span>
                      {" · "}
                      {status === "running" && <LottieIcon name="spinner" className="inline w-3 h-3 align-[-2px]" />}
                      {(b.completedCount || 0)}/{totalJobs} profiles · {formatDate(b.createdAt)}
                    </div>
                  </div>
                  <Link
                    href="/batch"
                    className="text-label-sm uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors shrink-0"
                  >
                    Open
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
