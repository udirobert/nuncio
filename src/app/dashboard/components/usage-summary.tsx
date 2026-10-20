"use client";

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

export function UsageSummary({
  videoCount,
  batches,
}: {
  videoCount: number;
  batches: Batch[];
}) {
  const totalVideos = videoCount + batches.reduce((s, b) => s + b.completedCount + b.failedCount, 0);
  const completedVideos = videoCount + batches.reduce((s, b) => s + b.completedCount, 0);
  const activeBatches = batches.filter((b) => b.status === "running" || b.status === "queued").length;

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
      <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
        Usage
      </span>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-display text-2xl text-ink">
            {totalVideos}
          </div>
          <div className="text-label-sm uppercase tracking-widest text-ink-faint mt-0.5">
            First touches
          </div>
        </div>
        <div>
          <div className="font-display text-2xl text-ink">
            {completedVideos}
          </div>
          <div className="text-label-sm uppercase tracking-widest text-ink-faint mt-0.5">
            Completed
          </div>
        </div>
        <div>
          <div className="font-display text-2xl text-ink">
            {activeBatches}
          </div>
          <div className="text-label-sm uppercase tracking-widest text-ink-faint mt-0.5">
            Active campaigns
          </div>
        </div>
        <div>
          <div className="font-display text-2xl text-ink">
            {batches.length}
          </div>
          <div className="text-label-sm uppercase tracking-widest text-ink-faint mt-0.5">
            Campaigns
          </div>
        </div>
      </div>
    </div>
  );
}
