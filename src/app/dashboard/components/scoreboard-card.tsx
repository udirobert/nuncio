"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { LottieIcon } from "@/components/lottie-icon";

interface LiveSessionMetrics {
  userTurns: number;
  agentTurns: number;
  questionTopics: string[];
  bookingClicked: boolean;
  bookingUrlPresent: boolean;
  lastEvent?: string;
  firstUserTurnAt?: string;
  durationMs?: number;
}

interface LiveSession {
  id: string;
  shareId: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  terminalReason?: string;
  metrics?: LiveSessionMetrics;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 1000) return "0s";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

export function ScoreboardCard() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/live/sessions")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load sessions");
        return r.json();
      })
      .then((data: { sessions?: LiveSession[] }) => {
        setSessions(data.sessions || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load live session metrics.");
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    const total = sessions.length;
    const started = sessions.filter((s) => s.metrics?.firstUserTurnAt).length;
    const ended = sessions.filter((s) => s.status === "ended").length;
    const bookings = sessions.filter((s) => s.metrics?.bookingClicked).length;
    const withBookingUrl = sessions.filter((s) => s.metrics?.bookingUrlPresent).length;
    const userTurns = sessions.map((s) => s.metrics?.userTurns || 0);
    const agentTurns = sessions.map((s) => s.metrics?.agentTurns || 0);
    const durations = sessions.map((s) => s.durationMs || s.metrics?.durationMs || 0).filter((d) => d > 0);

    const topicCounts: Record<string, number> = {};
    sessions.forEach((s) => {
      (s.metrics?.questionTopics || []).forEach((t) => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });

    const topicList = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxTopic = topicList[0]?.[1] || 1;

    return {
      total,
      started,
      ended,
      bookings,
      bookingRate: withBookingUrl > 0 ? Math.round((bookings / withBookingUrl) * 100) : 0,
      startRate: total > 0 ? Math.round((started / total) * 100) : 0,
      medianUserTurns: median(userTurns),
      medianAgentTurns: median(agentTurns),
      medianDuration: median(durations),
      topicList,
      maxTopic,
    };
  }, [sessions]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5 flex items-center justify-center min-h-[200px]">
        <LottieIcon name="spinner" className="w-6 h-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5 text-sm text-ink-muted">
        {error}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5 text-center">
        <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Live scoreboard
        </span>
        <p className="text-sm text-ink-muted mt-4 mb-3">No live sessions yet.</p>
        <p className="text-xs text-ink-faint">Share a live link to start collecting metrics.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-cream-dark bg-white p-5 space-y-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
          Live scoreboard
        </span>
        <span className="text-label-xs uppercase tracking-widest text-ink-faint">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <Stat value={stats.total} label="Total" />
        <Stat value={`${stats.startRate}%`} label="Started" />
        <Stat value={stats.ended} label="Completed" />
        <Stat value={stats.bookings} label="Bookings" />
        <Stat value={`${stats.medianUserTurns}`} label="Median turns" />
        <Stat value={formatDuration(stats.medianDuration)} label="Median time" />
      </div>

      {stats.topicList.length > 0 && (
        <div className="space-y-2">
          <span className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
            Question topics
          </span>
          <div className="space-y-2">
            {stats.topicList.map(([topic, count]) => (
              <div key={topic} className="flex items-center gap-3">
                <span className="w-24 text-xs text-ink-muted capitalize">{topic.replace(/_/g, " ")}</span>
                <div className="flex-1 h-2 bg-cream-dark/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${Math.round((count / stats.maxTopic) * 100)}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-ink">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="font-display text-2xl text-ink">{value}</div>
      <div className="text-label-xs uppercase tracking-widest text-ink-faint">{label}</div>
    </div>
  );
}
