"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

interface SessionData {
  authenticated: boolean;
  email?: string;
  plan?: string;
  balance?: number;
}

export function AccountMenu() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/account/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ authenticated: false }));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    setOpen(false);
    router.refresh();
  }

  if (!session) return null;

  return (
    <div ref={menuRef} className="relative">
      {session.authenticated ? (
        <button
          onClick={() => setOpen(!open)}
          className="text-[11px] uppercase tracking-widest font-medium text-ink-muted hover:text-ink transition-colors"
        >
          {session.email?.split("@")[0]}
        </button>
      ) : (
        <Link
          href="/login"
          className="inline-flex items-center rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-[11px] uppercase tracking-widest font-medium text-accent hover:bg-accent/10 transition-colors"
        >
          Sign in
        </Link>
      )}

      <AnimatePresence>
        {open && session.authenticated && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-cream-dark bg-white p-3 shadow-lg"
          >
            <div className="space-y-2">
              <p className="text-xs text-ink-muted truncate">{session.email}</p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-faint">Plan</span>
                <span className="text-ink font-medium capitalize">{session.plan || "free"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-faint">Credits</span>
                <span className="text-ink font-medium">{session.balance ?? "—"}</span>
              </div>
              <hr className="border-cream-dark my-2" />
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="block text-[11px] text-accent hover:text-accent-soft transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/pricing"
                onClick={() => setOpen(false)}
                className="block text-[11px] text-accent hover:text-accent-soft transition-colors"
              >
                Buy credits
              </Link>
              <button
                onClick={() => {
                  localStorage.removeItem("nuncio_onboarding_done");
                  window.location.reload();
                }}
                className="block text-[11px] text-ink-faint hover:text-ink transition-colors"
              >
                Show tips
              </button>
              <button
                onClick={handleLogout}
                className="text-[11px] text-warm hover:text-warm-soft transition-colors"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
