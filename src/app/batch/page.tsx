"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Link from "next/link";

interface Batch {
  id: string;
  name: string;
  status: string;
  jobs: { url: string; status: string }[];
  completedCount: number;
  failedCount: number;
  createdAt: string;
}

export default function BatchPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [urls, setUrls] = useState("");
  const [senderBrief, setSenderBrief] = useState("");

  useEffect(() => {
    fetch("/api/batch")
      .then((r) => r.json())
      .then(setBatches)
      .catch(() => {});
  }, []);

  async function loadBatches() {
    try {
      const res = await fetch("/api/batch");
      if (res.ok) setBatches(await res.json());
    } catch {
      // ignore
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const urlList = urls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

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
      loadBatches();
    }
  }

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
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft transition-colors"
        >
          {showForm ? "Cancel" : "New batch"}
        </button>
      </div>

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
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="Profile URLs, one per line&#10;https://linkedin.com/in/..."
            rows={5}
            required
            className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors resize-none"
          />
          <textarea
            value={senderBrief}
            onChange={(e) => setSenderBrief(e.target.value)}
            placeholder="Sender brief (who are you and why are you reaching out?)"
            rows={3}
            required
            className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors resize-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-soft transition-colors"
          >
            Create batch
          </button>
        </motion.form>
      )}

      {batches.length === 0 && !showForm && (
        <p className="text-sm text-ink-faint text-center py-16">
          No batches yet. Create one to get started.
        </p>
      )}

      <div className="space-y-3">
        {batches.map((batch) => (
          <motion.div
            key={batch.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-cream-dark bg-white p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-ink">{batch.name}</h3>
              <span className={`text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full ${
                batch.status === "completed"
                  ? "text-success bg-success/10"
                  : batch.status === "failed"
                    ? "text-warm bg-warm-soft"
                    : "text-ink-faint bg-cream-dark"
              }`}>
                {batch.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-ink-muted">
              <span>{batch.jobs.length} profiles</span>
              <span>{batch.completedCount} completed</span>
              {batch.failedCount > 0 && <span className="text-warm">{batch.failedCount} failed</span>}
              <span className="text-ink-faint">{new Date(batch.createdAt).toLocaleDateString()}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
