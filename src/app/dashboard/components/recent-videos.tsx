"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Link from "next/link";

interface VideoData {
  id: string;
  videoUrl?: string;
  recipientName?: string;
  createdAt: string;
  privacy?: string;
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

interface ActivityEntry {
  id: string;
  type: "video" | "batch" | "batch_job";
  label: string;
  status: "completed" | "failed" | "running" | "partial";
  url?: string;
  detail?: string;
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

function groupByDate(entries: ActivityEntry[]): Map<string, ActivityEntry[]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const key = formatDate(entry.createdAt);
    const existing = groups.get(key) || [];
    existing.push(entry);
    groups.set(key, existing);
  }
  return groups;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
            <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
          </svg>
        </span>
      );
    case "failed":
      return (
        <span className="w-4 h-4 rounded-full bg-error/10 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-error" fill="currentColor">
            <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zM4.1 3.4a.5.5 0 0 1 .7 0L6 4.6l1.2-1.2a.5.5 0 0 1 .7.7L6.8 5.3l1.1 1.2a.5.5 0 0 1-.7.7L6 6 4.8 7.2a.5.5 0 0 1-.7-.7L5.2 5.3 4.1 4.1a.5.5 0 0 1 0-.7z" />
          </svg>
        </span>
      );
    case "running":
      return (
        <span className="relative flex h-4 w-4 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-25" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-accent/20" />
        </span>
      );
    case "partial":
      return (
        <span className="w-4 h-4 rounded-full bg-warm/10 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-warm" fill="currentColor">
            <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zm0 2a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V2.5A.5.5 0 0 1 6 2zm0 7a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
          </svg>
        </span>
      );
    default:
      return null;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "completed": return "text-success";
    case "failed": return "text-error";
    case "running": return "text-accent";
    case "partial": return "text-warm";
    default: return "text-ink-faint";
  }
}

export function RecentVideos() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/videos/recent?limit=20").then((r) => r.json()),
      fetch("/api/batch").then((r) => r.json()),
    ])
      .then(([videoData, batchData]) => {
        setVideos(videoData.videos || []);
        setBatches(batchData || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const entries: ActivityEntry[] = [
    ...videos.map((v) => ({
      id: v.id,
      type: "video" as const,
      label: v.recipientName || "Untitled video",
      status: "completed" as const,
      url: v.videoUrl,
      detail: "Studio video",
      createdAt: v.createdAt,
    })),
    ...batches.map((b) => {
      const completedCount = b.completedCount || 0;
      const failedCount = b.failedCount || 0;
      const totalJobs = b.jobs?.length || 0;
      let status: "completed" | "failed" | "running" | "partial";
      if (b.status === "running" || b.status === "queued") {
        status = "running";
      } else if (failedCount > 0 && completedCount > 0) {
        status = "partial";
      } else if (failedCount === totalJobs) {
        status = "failed";
      } else {
        status = "completed";
      }

      return {
        id: b.id,
        type: "batch" as const,
        label: b.name || "Untitled campaign",
        status,
        detail: `${completedCount}/${totalJobs} profiles`,
        createdAt: b.createdAt,
      };
    }),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  if (loading) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Recent activity
        </span>
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-cream-dark/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5 text-center">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
          Recent activity
        </span>
        <p className="text-sm text-ink-muted mt-4 mb-3">No videos yet</p>
        <Link
          href="/studio"
          className="inline-block text-[11px] uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Create your first video
        </Link>
      </div>
    );
  }

  const grouped = groupByDate(entries);

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
      <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
        Recent activity
      </span>

      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([dateLabel, dateEntries]) => (
          <div key={dateLabel}>
            <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-2">
              {dateLabel}
            </div>
            <div className="space-y-1">
              {dateEntries.map((entry) => (
                <div
                  key={`${entry.type}-${entry.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-cream-dark/20 transition-colors group"
                >
                  <StatusIcon status={entry.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-ink font-medium truncate">
                      {entry.label}
                    </div>
                    <div className="text-[10px] text-ink-faint">
                      {entry.detail}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.status === "running" && (
                      <span className="text-[10px] text-accent">In progress</span>
                    )}
                    {entry.status === "completed" && entry.type === "video" && (
                      <Link
                        href={entry.url || "#"}
                        target="_blank"
                        className="text-[10px] uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    )}
                    {entry.type === "batch" && (
                      <Link
                        href="/batch"
                        className="text-[10px] uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
