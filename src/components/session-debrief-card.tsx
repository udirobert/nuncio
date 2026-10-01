"use client";

/**
 * Post-session debrief card — renders persisted live-session metrics only.
 *
 * Metrics are classification labels and counters (questionTopics,
 * bookingClicked, userTurns) — raw dialogue is never stored here and never
 * rendered here.
 */
export interface SessionDebriefMetrics {
  userTurns: number;
  agentTurns?: number;
  questionTopics: string[];
  bookingClicked: boolean;
}

function humanizeTopic(topic: string): string {
  return topic.replace(/_/g, " ");
}

export function SessionDebriefCard({
  metrics,
  title = "Session debrief",
  subtitle,
}: {
  metrics: SessionDebriefMetrics;
  title?: string;
  subtitle?: string;
}) {
  const topics = Array.isArray(metrics.questionTopics) ? metrics.questionTopics : [];
  const turns = Math.max(0, metrics.userTurns || 0);
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-cream-dark bg-white/70 p-4"
    >
      <p className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">
        {title}
      </p>
      {subtitle && (
        <p className="text-body-xs text-ink-muted mt-1">{subtitle}</p>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-label-xs uppercase tracking-widest text-ink-faint">
            Questions
          </dt>
          <dd className="font-display text-2xl text-ink">{turns}</dd>
        </div>
        <div>
          <dt className="text-label-xs uppercase tracking-widest text-ink-faint">
            Topics
          </dt>
          <dd className="font-display text-2xl text-ink">{topics.length}</dd>
        </div>
        <div>
          <dt className="text-label-xs uppercase tracking-widest text-ink-faint">
            Booking
          </dt>
          <dd className="text-body-sm text-ink font-medium pt-1">
            {metrics.bookingClicked ? "Clicked ✓" : "No click"}
          </dd>
        </div>
      </dl>
      {topics.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <li
              key={topic}
              className="rounded-full border border-cream-dark bg-white px-2.5 py-1 text-label-base text-ink-muted capitalize"
            >
              {humanizeTopic(topic)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-body-xs text-ink-faint">
          No question topics detected.
        </p>
      )}
      <p className="mt-3 text-label-xs text-ink-faint">
        Topic labels only — nothing said in the conversation is stored here.
      </p>
    </section>
  );
}
