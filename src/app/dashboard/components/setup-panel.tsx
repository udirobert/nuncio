"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface BriefData {
  senderName?: string;
  senderBusiness?: string;
  playbookWants?: string;
  playbookOffer?: string;
  playbookWiggleRoom?: string;
  playbookConstraints?: string;
  bookingUrl?: string;
  synthesiaAvatarId?: string;
  liveVoiceId?: string;
  liveReadiness?: { configured: boolean; playbookConfigured: boolean };
}

function validHttpsUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

interface StatusItem {
  label: string;
  state: boolean | null;
}

function StatusList({ items }: { items: StatusItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-body-xs">
          {item.state === null ? (
            <span className="w-4 h-4 rounded-full bg-cream-dark shrink-0" aria-hidden />
          ) : item.state ? (
            <span className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-success" fill="currentColor">
                <path d="M10.28 2.22a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06L3.75 7.69l5.47-5.47a.75.75 0 0 1 1.06 0z" />
              </svg>
            </span>
          ) : (
            <span className="w-4 h-4 rounded-full bg-cream-dark/60 shrink-0" aria-hidden />
          )}
          <span className="text-ink-muted">
            {labelText(item)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function labelText(item: StatusItem): string {
  const suffix = item.state === null ? "Unknown" : item.state ? "Set" : "Not set";
  return `${item.label} — ${suffix}`;
}

export function SetupPanel({ variant = "full" }: { variant?: "full" | "summary" }) {
  const [snapshot, setSnapshot] = useState<BriefData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [senderBusiness, setSenderBusiness] = useState("");
  const [playbookWants, setPlaybookWants] = useState("");
  const [playbookOffer, setPlaybookOffer] = useState("");
  const [playbookWiggleRoom, setPlaybookWiggleRoom] = useState("");
  const [playbookConstraints, setPlaybookConstraints] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [synthesiaAvatarId, setSynthesiaAvatarId] = useState("");
  const [liveVoiceId, setLiveVoiceId] = useState("");

  const genRef = useRef(0);
  const mountedRef = useRef(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSummary = variant === "summary";

  const load = useCallback(async (applyForm: boolean): Promise<boolean> => {
    const gen = ++genRef.current;
    try {
      const res = await fetch("/api/account/brief", { cache: "no-store" });
      if (!res.ok) throw new Error("brief fetch failed");
      const data = (await res.json()) as BriefData;
      if (!mountedRef.current || gen !== genRef.current) return false;
      setSnapshot(data);
      setLoadError(false);
      setRefreshFailed(false);
      setLoaded(true);
      if (applyForm && !isSummary) {
        setSenderName(data.senderName ?? "");
        setSenderBusiness(data.senderBusiness ?? "");
        setPlaybookWants(data.playbookWants ?? "");
        setPlaybookOffer(data.playbookOffer ?? "");
        setPlaybookWiggleRoom(data.playbookWiggleRoom ?? "");
        setPlaybookConstraints(data.playbookConstraints ?? "");
        setBookingUrl(data.bookingUrl ?? "");
        setSynthesiaAvatarId(data.synthesiaAvatarId ?? "");
        setLiveVoiceId(data.liveVoiceId ?? "");
      }
      return true;
    } catch {
      if (mountedRef.current && gen === genRef.current) {
        setSnapshot(null);
        setLoadError(true);
      }
      return false;
    }
  }, [isSummary]);

  useEffect(() => {
    mountedRef.current = true;
    queueMicrotask(() => {
      if (mountedRef.current) void load(true);
    });
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [load]);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setDirty(true);
    setSaved(false);
    setter(v);
  };

  const bookingValid = validHttpsUrl(bookingUrl);
  const bookingEmpty = !bookingUrl.trim();
  const canSave = loaded && dirty && senderName.trim().length > 0 && (bookingEmpty || bookingValid) && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const gen = ++genRef.current;
    try {
      const res = await fetch("/api/account/brief", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: senderName.trim(),
          senderBusiness,
          playbookWants,
          playbookOffer,
          playbookWiggleRoom,
          playbookConstraints,
          bookingUrl: bookingUrl.trim(),
          synthesiaAvatarId,
          liveVoiceId,
        }),
      });
      if (!mountedRef.current || gen !== genRef.current) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(data.error || "Could not save — try again.");
        return;
      }
      setDirty(false);
      const refreshed = await load(false);
      if (!mountedRef.current) return;
      if (refreshed) {
        setRefreshFailed(false);
        setSaved(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setSaved(false), 3000);
      } else {
        setRefreshFailed(true);
      }
    } catch {
      if (mountedRef.current) setSaveError("Could not save — check your connection.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const items: StatusItem[] = [
    { label: "Identity", state: snapshot ? Boolean(snapshot.senderName?.trim()) : null },
    { label: "Playbook", state: snapshot?.liveReadiness ? Boolean(snapshot.liveReadiness.playbookConfigured) : null },
    { label: "Live provider", state: snapshot?.liveReadiness ? Boolean(snapshot.liveReadiness.configured) : null },
    { label: "Scheduling link", state: snapshot ? validHttpsUrl(snapshot.bookingUrl ?? "") : null },
  ];

  if (isSummary) {
    return (
      <div className="space-y-3">
        {loadError ? (
          <>
            <p className="text-body-xs text-ink-faint">Status unknown — couldn&apos;t load your setup.</p>
            <button
              onClick={() => void load(true)}
              className="btn-press rounded-lg border border-ink/15 px-3 py-1.5 text-body-xs font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Retry
            </button>
          </>
        ) : (
          <StatusList items={items} />
        )}
        <p className="text-label-base text-ink-faint">
          Configuration presence, not live health. Prospects choose: ask the AI, request you, or pick a time — nothing
          human connects without your acceptance.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard?view=setup"
            className="text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Open setup →
          </Link>
          <Link href="/studio" className="text-label-base uppercase tracking-widest font-medium text-ink-faint hover:text-ink transition-colors">
            Create a first touch
          </Link>
        </div>
      </div>
    );
  }

  if (loadError && !loaded) {
    return (
      <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-3">
        <h2 className="font-display text-lg text-ink">Setup</h2>
        <p className="text-body-sm text-warm">Couldn&apos;t load your current setup.</p>
        <button
          onClick={() => void load(true)}
          className="btn-press rounded-lg border border-ink/15 px-4 py-2.5 text-body-xs font-medium text-ink-muted hover:text-ink transition-colors min-h-[44px]"
        >
          Retry
        </button>
      </div>
    );
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint disabled:opacity-50";
  const savedBooking = snapshot?.bookingUrl?.trim() ?? "";
  const savedBookingOk = validHttpsUrl(savedBooking);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 rounded-2xl border border-cream-dark bg-white p-5 space-y-6">
        <div>
          <h2 className="font-display text-lg text-ink">Your representative</h2>
          <p className="text-body-xs text-ink-muted mt-1">
            Set who your disclosed AI representative speaks for, and the boundaries it answers within. Saving settings
            doesn&apos;t verify provider availability — the checklist shows configuration presence, not live health.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={!loaded || saving} className="space-y-6 disabled:opacity-70">
            <section id="identity" className="scroll-mt-28 space-y-3">
              <h3 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">1 · Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-body-xs text-ink-muted">Your name <span className="text-warm">*</span></span>
                  <input value={senderName} onChange={(e) => edit(setSenderName)(e.target.value)} required className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-body-xs text-ink-muted">Business or role (optional)</span>
                  <input value={senderBusiness} onChange={(e) => edit(setSenderBusiness)(e.target.value)} className={inputCls} />
                </label>
              </div>
            </section>

            <section id="playbook" className="scroll-mt-28 space-y-3">
              <h3 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">2 · Playbook</h3>
              <label className="block">
                <span className="text-body-xs text-ink-muted">What you want</span>
                <textarea value={playbookWants} onChange={(e) => edit(setPlaybookWants)(e.target.value)} rows={2} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-body-xs text-ink-muted">What you offer</span>
                <textarea value={playbookOffer} onChange={(e) => edit(setPlaybookOffer)(e.target.value)} rows={2} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-body-xs text-ink-muted">Where there is room to move (optional)</span>
                <textarea value={playbookWiggleRoom} onChange={(e) => edit(setPlaybookWiggleRoom)(e.target.value)} rows={2} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-body-xs text-ink-muted">What it must never promise</span>
                <textarea value={playbookConstraints} onChange={(e) => edit(setPlaybookConstraints)(e.target.value)} rows={2} className={inputCls} />
              </label>
            </section>

            <section id="scheduling" className="scroll-mt-28 space-y-3">
              <h3 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">3 · Scheduling (optional)</h3>
              <label className="block">
                <span className="text-body-xs text-ink-muted">Booking link — shown as “Choose a time” on your conversation links</span>
                <input
                  value={bookingUrl}
                  onChange={(e) => edit(setBookingUrl)(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                  className={inputCls}
                />
              </label>
              {!bookingEmpty && !bookingValid && (
                <p className="text-body-xs text-warm">Use a full https:// link to your scheduling page.</p>
              )}
            </section>

            <details id="live" className="scroll-mt-28 rounded-xl border border-cream-dark p-4 space-y-3">
              <summary className="text-label-sm uppercase tracking-widest text-ink-faint font-medium cursor-pointer list-none">
                4 · Advanced — avatar &amp; voice
              </summary>
              <p className="text-body-xs text-ink-faint">
                The live twin uses this Synthesia avatar and voice for your representative. Blank uses the deployment
                default, if configured. The demo avatar may not resemble you. Never enter API keys here.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-body-xs text-ink-muted">Synthesia interactive avatar ID</span>
                  <input value={synthesiaAvatarId} onChange={(e) => edit(setSynthesiaAvatarId)(e.target.value)} placeholder="av_…" className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-body-xs text-ink-muted">ElevenLabs voice ID</span>
                  <input value={liveVoiceId} onChange={(e) => edit(setLiveVoiceId)(e.target.value)} placeholder="ElevenLabs voice id" className={inputCls} />
                </label>
              </div>
            </details>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={!canSave}
                className="btn-press rounded-xl bg-ink text-cream px-5 py-2.5 text-body-xs font-medium disabled:opacity-50 min-h-[44px]"
              >
                {saving ? "Saving…" : "Save setup"}
              </button>
              {saved && <span className="text-body-xs text-success">Saved</span>}
              {refreshFailed && (
                <span className="text-body-xs text-warm">
                  Settings saved; status refresh failed.{" "}
                  <button type="button" onClick={() => void load(false)} className="underline">Retry</button>
                </span>
              )}
              {saveError && <span className="text-body-xs text-warm">{saveError}</span>}
            </div>
          </fieldset>
        </form>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-cream-dark bg-white/70 p-5">
          <h3 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium mb-3">Status</h3>
          {loadError && loaded ? (
            <>
              <p className="text-body-xs text-ink-faint">Status unknown — refresh failed.</p>
              <button
                onClick={() => void load(false)}
                className="mt-2 btn-press rounded-lg border border-ink/15 px-3 py-1.5 text-body-xs font-medium text-ink-muted hover:text-ink transition-colors"
              >
                Retry
              </button>
            </>
          ) : (
            <StatusList items={items} />
          )}
          <p className="text-label-base text-ink-faint mt-3">
            Configuration presence, not live health.
          </p>
        </div>

        <div className="rounded-2xl border border-cream-dark bg-cream/40 p-5 space-y-3">
          <h3 className="text-label-sm uppercase tracking-widest text-ink-faint font-medium">Prospect preview · layout only</h3>
          <div className="rounded-xl border border-cream-dark bg-white p-4 space-y-2.5 pointer-events-none select-none">
            <p className="text-label-base text-ink-faint">A conversation with</p>
            <p className="font-display text-xl text-ink break-words">{snapshot?.senderName?.trim() || "Your name"}</p>
            <div className="space-y-1.5 pt-1">
              {["Ask the AI representative", `Request ${snapshot?.senderName?.trim() || "you"}`].map((label) => (
                <div key={label} className="rounded-lg border border-cream-dark bg-cream/60 px-3 py-2 text-body-xs text-ink-muted break-words">
                  {label}
                </div>
              ))}
              {savedBookingOk && (
                <div className="rounded-lg border border-cream-dark bg-cream/60 px-3 py-2 text-body-xs text-ink-muted">
                  Choose a time
                </div>
              )}
            </div>
            <p className="text-label-base text-ink-faint">
              {snapshot === null
                ? "Status unknown — load the panel to preview readiness."
                : snapshot.liveReadiness?.playbookConfigured
                  ? "Playbook configured — the representative answers from it."
                  : "No playbook saved yet."}
            </p>
          </div>
          <Link href="/#prospect-experience" className="inline-block text-label-base uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors">
            Preview the experience →
          </Link>
          <p className="text-label-base text-ink-faint">
            Next: <Link href="/studio" className="text-accent hover:underline">create a first touch</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
