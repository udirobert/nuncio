"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LottieIcon } from "@/components/lottie-icon";

interface VideoData {
  id: string;
  videoUrl?: string;
  recipientName?: string;
  createdAt: string;
  privacy?: string;
}

interface FirstTouch {
  id: string;
  recipientName?: string;
  senderName?: string;
  createdAt: string;
  privacy?: string;
  deliveryMode?: string;
  hasRecordedVideo: boolean;
  invitationProtected: boolean;
}

interface BatchJob {
  id: string;
  url: string;
  recipientName?: string;
  status: string;
  videoId?: string;
  error?: string;
}

interface Batch {
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

function batchStatus(b: Batch): "completed" | "failed" | "running" | "partial" {
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

export function RecentVideos() {
  const [firstTouches, setFirstTouches] = useState<FirstTouch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchError, setBatchError] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/videos/recent?limit=20")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (Array.isArray(data.firstTouches)) {
          setFirstTouches(data.firstTouches);
        } else {
          setFirstTouches(
            (data.videos || []).map((v: VideoData) => ({
              id: v.id,
              recipientName: v.recipientName,
              createdAt: v.createdAt,
              privacy: v.privacy,
              deliveryMode: "video",
              hasRecordedVideo: true,
              invitationProtected: false,
            }))
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setFetchError(true);
        setLoading(false);
      });

    fetch("/api/batch")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .catch(() => setBatchError(true));
  }, []);

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

  if (loading) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5">
        <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Recent first touches
        </span>
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-cream-dark/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5">
        <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Recent first touches
        </span>
        <p className="text-sm text-warm mt-4">Couldn&apos;t load recent first touches — try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Recent first touches
        </span>
        <Link
          href="/studio"
          className="text-label-sm uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Create one
        </Link>
      </div>

      {firstTouches.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-ink-muted mb-3">No first touches yet</p>
          <Link
            href="/studio"
            className="inline-block text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Create your first touch
          </Link>
        </div>
      ) : (
        <ul className="space-y-1">
          {firstTouches.map((ft) => {
            const isLive = ft.deliveryMode === "livelink";
            const href = isLive ? `/live/${ft.id}` : `/v/${ft.id}`;
            const label = isLive ? "Live link created" : "Recorded first touch";
            const created = formatDate(ft.createdAt);
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
                    <div className="text-body-xs text-ink font-medium truncate">
                      {ft.recipientName || "Untitled"}
                    </div>
                    <div className="text-label-sm text-ink-faint">
                      {label} · {created}
                      {ft.hasRecordedVideo && isLive ? " · recorded fallback included" : ""}
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
