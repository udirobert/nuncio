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
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] uppercase tracking-widest font-medium text-ink-muted hover:text-ink transition-colors"
      >
        {session.authenticated ? session.email?.split("@")[0] : "Sign in"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-cream-dark bg-white p-3 shadow-lg"
          >
            {session.authenticated ? (
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
                  href="/pricing"
                  onClick={() => setOpen(false)}
                  className="block text-[11px] text-accent hover:text-accent-soft transition-colors"
                >
                  Buy credits
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-warm hover:text-warm-soft transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-ink-muted">Not signed in</p>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block text-[11px] text-accent hover:text-accent-soft transition-colors"
                >
                  Sign in
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
