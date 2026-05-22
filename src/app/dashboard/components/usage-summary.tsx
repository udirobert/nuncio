"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";

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

interface RecentVideo {
  id: string;
  videoUrl?: string;
  recipientName?: string;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  type: "video" | "batch";
  label: string;
  subtitle: string;
  status: "completed" | "failed" | "partial";
  url?: string;
  createdAt: string;
}

export function UsageSummary() {
  const [videos, setVideos] = useState<RecentVideo[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    fetch("/api/videos/recent?limit=50")
      .then((r) => r.json())
      .then((data) => setVideos(data.videos || []))
      .catch(() => {});

    fetch("/api/batch")
      .then((r) => r.json())
      .then(setBatches)
      .catch(() => {});
  }, []);

  const totalVideos = videos.length + batches.reduce((s, b) => s + b.completedCount + b.failedCount, 0);
  const completedVideos = videos.length + batches.reduce((s, b) => s + b.completedCount, 0);
  const activeBatches = batches.filter((b) => b.status === "running" || b.status === "queued").length;

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
      <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
        This month
      </span>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-[family-name:var(--font-display)] text-2xl text-ink">
            {totalVideos}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">
            Videos
          </div>
        </div>
        <div>
          <div className="font-[family-name:var(--font-display)] text-2xl text-ink">
            {completedVideos}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">
            Completed
          </div>
        </div>
        <div>
          <div className="font-[family-name:var(--font-display)] text-2xl text-ink">
            {activeBatches}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">
            Active campaigns
          </div>
        </div>
        <div>
          <div className="font-[family-name:var(--font-display)] text-2xl text-ink">
            {batches.length}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">
            Campaigns
          </div>
        </div>
      </div>
    </div>
  );
}
