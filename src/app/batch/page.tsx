"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";

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
  senderBrief: string;
  status: string;
  jobs: BatchJob[];
  completedCount: number;
  failedCount: number;
  createdAt: string;
}

function statusColor(status: string) {
  switch (status) {
    case "completed": return "text-success bg-success/10";
    case "failed": return "text-warm bg-warm-soft";
    case "running":
    case "processing": return "text-accent bg-accent-soft/30";
    default: return "text-ink-faint bg-cream-dark";
  }
}

function parseCSV(text: string): Array<{ url: string; name?: string }> {
  const lines = text.split("\n").filter((l) => l.trim());
  const results: Array<{ url: string; name?: string }> = [];

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length === 0 || !parts[0]) continue;
    const url = parts[0];
    const name = parts.length > 1 ? parts[1].replace(/^"|"$/g, "") : undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      results.push({ url, name });
    }
  }
  return results;
}

export default function BatchPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [senderBrief, setSenderBrief] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nuncio_sender_brief");
      if (stored) {
        localStorage.removeItem("nuncio_sender_brief");
        return stored;
      }
    }
    return "";
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [emailNotify, setEmailNotify] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/batch");
      if (res.ok) setBatches(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/batch")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setBatches(data); })
      .catch(() => {});
    localStorage.removeItem("nuncio_profile_name");
    localStorage.removeItem("nuncio_profile_company");
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const hasRunning = batches.some((b) => b.status === "running" || b.status === "queued");
    if (hasRunning) {
      pollRef.current = setInterval(loadBatches, 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batches, loadBatches]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const entries = parseCSV(text);
      if (entries.length === 0) {
        setError("No valid URLs found in CSV. Each line should have a URL, optionally followed by a name.");
        return;
      }
      const urlLines = entries.map((e) => e.url).join("\n");
      setUrls((prev) => (prev ? prev + "\n" : "") + urlLines);
      setError("");
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, urls: urlList, senderBrief }),
      });

      if (res.ok) {
        setShowForm(false);
        setName("");
        setUrls("");
        setSenderBrief("");
        await loadBatches();
      } else {
        const body = await res.json();
        setError(body.error || "Failed to create batch");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(batchId: string) {
    setDeleting(batchId);
    try {
      await fetch(`/api/batch/${batchId}`, { method: "DELETE" });
      await loadBatches();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  async function handleRetry(batchId: string) {
    setRetrying(batchId);
    try {
      await fetch("/api/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: batchId }),
      });
      await loadBatches();
    } catch {
      // ignore
    } finally {
      setRetrying(null);
    }
  }

  const totalJobs = batches.reduce((sum, b) => sum + b.jobs.length, 0);
  const completedJobs = batches.reduce((sum, b) => sum + b.completedCount, 0);
  const failedJobs = batches.reduce((sum, b) => sum + b.failedCount, 0);

  return (
    <div className="flex-1 px-6 py-24 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-ink"
          >
            nuncio
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight mt-4">
            Batch
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Create and manage batch video campaigns.
          </p>
          <Link
            href="/studio"
            className="text-[11px] text-accent hover:text-accent/80 transition-colors mt-2 inline-block"
          >
            Need a single, cinematic video? Try Studio →
          </Link>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft transition-colors"
        >
          {showForm ? "Cancel" : "New batch"}
        </button>
      </div>

      {batches.length > 0 && (
        <div className="mb-6 flex items-center gap-4 text-[11px] text-ink-muted">
          <span>{batches.length} campaigns</span>
          <span>{totalJobs} profiles</span>
          <span>{completedJobs} completed</span>
          {failedJobs > 0 && <span className="text-warm">{failedJobs} failed</span>}
        </div>
      )}

      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="mb-8 space-y-4 rounded-2xl border border-cream-dark bg-white p-6"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaign name"
            required
            className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors"
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-widest font-medium text-ink-muted">
                Profile URLs
              </label>
              <label className="text-[10px] text-accent cursor-pointer hover:text-accent-light transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                Import CSV
              </label>
            </div>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://linkedin.com/in/...&#10;https://x.com/..."
              rows={5}
              required
              className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors resize-none"
            />
            <p className="text-[10px] text-ink-faint mt-1">
              One URL per line, or upload a CSV with columns: url, recipient name
            </p>
          </div>
          <textarea
            value={senderBrief}
            onChange={(e) => setSenderBrief(e.target.value)}
            placeholder="Sender brief (who are you and why are you reaching out?)"
            rows={3}
            required
            className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors resize-none"
          />
          {error && (
            <p className="text-[11px] text-warm font-medium">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[11px] text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotify}
                onChange={(e) => setEmailNotify(e.target.checked)}
                className="rounded border-cream-dark text-accent focus:ring-accent/30"
              />
              Email me when complete
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-soft transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {submitting && (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {submitting ? "Creating..." : "Create batch"}
            </button>
          </div>
        </motion.form>
      )}

      {batches.length === 0 && !showForm && (
        <div className="text-center py-20">
          <p className="text-sm text-ink-faint mb-2">No batches yet.</p>
          <p className="text-[11px] text-ink-faint/60">Upload a CSV or paste profile URLs to start a campaign.</p>
        </div>
      )}

      <div className="space-y-3">
        {batches.map((batch) => {
          const progress = batch.jobs.length > 0
            ? Math.round(((batch.completedCount + batch.failedCount) / batch.jobs.length) * 100)
            : 0;

          return (
            <motion.div
              key={batch.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-cream-dark bg-white overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === batch.id ? null : batch.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm text-ink">{batch.name}</h3>
                  <div className="flex items-center gap-2">
                    {batch.status === "failed" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetry(batch.id); }}
                        disabled={retrying === batch.id}
                        className="text-[10px] uppercase tracking-widest font-medium text-accent hover:text-accent-light transition-colors disabled:opacity-40"
                      >
                        {retrying === batch.id ? "Retrying..." : "Retry"}
                      </button>
                    )}
                    {batch.status !== "running" && batch.status !== "queued" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(batch.id); }}
                        disabled={deleting === batch.id}
                        className="text-[10px] uppercase tracking-widest font-medium text-warm hover:text-warm-light transition-colors disabled:opacity-40"
                      >
                        {deleting === batch.id ? "..." : "Delete"}
                      </button>
                    )}
                    <span className={`text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full ${statusColor(batch.status)}`}>
                      {batch.status}
                    </span>
                    <motion.span
                      animate={{ rotate: expanded === batch.id ? 180 : 0 }}
                      className="text-ink-faint text-xs"
                    >
                      ▾
                    </motion.span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-ink-muted">
                  <span>{batch.jobs.length} profiles</span>
                  <span>{batch.completedCount} completed</span>
                  {batch.failedCount > 0 && <span className="text-warn">{batch.failedCount} failed</span>}
                  <span className="text-ink-faint">{new Date(batch.createdAt).toLocaleDateString()}</span>
                </div>
                {(batch.status === "running" || batch.status === "queued") && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-ink-faint mb-1">
                      <span>{progress}%</span>
                      <span>{batch.completedCount + batch.failedCount}/{batch.jobs.length}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-cream-dark overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full rounded-full bg-accent"
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}
              </button>

              <AnimatePresence>
                {expanded === batch.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-cream-dark"
                  >
                    <div className="divide-y divide-cream-dark">
                      {batch.jobs.map((job) => (
                        <div key={job.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-ink truncate">{job.url}</p>
                              {job.recipientName && (
                                <p className="text-[10px] text-ink-faint mt-0.5">{job.recipientName}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {job.status === "completed" && job.videoId && (
                                <Link
                                  href={`/v/${job.videoId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] uppercase tracking-widest font-medium text-accent hover:text-accent-light transition-colors"
                                >
                                  View
                                </Link>
                              )}
                              {job.error && (
                                <span
                                  title={job.error}
                                  className="text-[10px] uppercase tracking-widest font-medium text-warm cursor-default"
                                >
                                  Error
                                </span>
                              )}
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor(job.status)}`}>
                                {job.status}
                              </span>
                            </div>
                          </div>
                          {job.error && (
                            <p className="text-[10px] text-warm mt-1 leading-relaxed">{job.error}</p>
                          )}
                          {job.status === "processing" && (
                            <div className="mt-2">
                              <div className="w-full h-1 rounded-full bg-cream-dark overflow-hidden">
                                <div className="h-full rounded-full bg-accent/60 animate-pulse" style={{ width: "40%" }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
