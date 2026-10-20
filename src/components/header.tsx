"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type { PipelineState } from "@/lib/pipeline";
import { AccountMenu } from "@/components/account-menu";
import { APP_ROUTES, MEMBER_NAV, PUBLIC_NAV, SECONDARY_NAV, type NavItem } from "@/lib/navigation";

interface HeaderProps {
  stage?: PipelineState["stage"];
  isDemo?: boolean;
}

const STAGE_LABELS: Record<PipelineState["stage"], string> = {
  input: "",
  progress: "Working",
  profilePicker: "Profiles",
  coach: "Angles",
  review: "Review",
  done: "Complete",
  error: "",
};

export function Header({ stage, isDemo }: HeaderProps) {
  const pathname = usePathname();
  const showStage = stage && stage !== "input" && stage !== "error";
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/account/session")
      .then((r) => r.json())
      .then((s) => {
        if (s.authenticated) {
          setAuthenticated(true);
          if (typeof s.balance === "number") setCreditBalance(s.balance);
        }
      })
      .catch(() => {});
  }, []);

  // Members get the three spaces of the product. Everyone else gets the two
  // things they can actually open — member surfaces dead-end at the login wall.
  const primaryNav: NavItem[] = authenticated ? MEMBER_NAV : PUBLIC_NAV;
  const isActive = (href: string) => pathname === href;

  const navLinkClass = (active: boolean) =>
    `text-label-base uppercase tracking-widest font-medium transition-colors ${
      active ? "text-accent" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-cream/80 backdrop-blur-md border-b border-cream-dark/60 pointer-events-auto">
      {/* Mobile nav dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Main navigation"
            className="xl:hidden pointer-events-auto absolute top-full left-6 right-6 mt-2 rounded-2xl border border-cream-dark bg-cream shadow-lg shadow-ink/5 p-2 flex flex-col"
          >
            <p className="px-4 pt-2 pb-1 text-label-xs uppercase tracking-widest text-ink-faint font-medium">
              {authenticated ? "Your workspace" : "Explore"}
            </p>
            {primaryNav.map((link, i) => {
              const active = isActive(link.href);
              return (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i, duration: 0.25 }}
                >
                  <Link
                    href={link.href}
                    title={link.description}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded-xl px-4 py-3 text-body-sm font-medium transition-colors ${
                      active ? "bg-accent-soft text-accent" : "text-ink hover:bg-cream-dark/50"
                    }`}
                  >
                    {link.label}
                    <span className="block text-label-base font-normal text-ink-faint">
                      {link.description}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
            {authenticated && (
              <>
                <p className="px-4 pt-3 pb-1 text-label-xs uppercase tracking-widest text-ink-faint font-medium border-t border-cream-dark mt-1">
                  More
                </p>
                {SECONDARY_NAV.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.description}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`block rounded-xl px-4 py-3 text-body-sm font-medium transition-colors ${
                      isActive(link.href) ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-cream-dark/50"
                    }`}
                  >
                    {link.label}
                    <span className="block text-label-base font-normal text-ink-faint">
                      {link.description}
                    </span>
                  </Link>
                ))}
              </>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="pointer-events-auto flex items-center gap-3"
      >
        <Link
          href={authenticated ? APP_ROUTES.inbox : APP_ROUTES.home}
          className="font-display text-xl font-medium tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
          className="xl:hidden btn-press flex items-center justify-center w-9 h-9 rounded-lg border border-cream-dark bg-white/70 text-ink-muted hover:text-ink transition-colors"
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileMenuOpen ? (
              <motion.svg
                key="close"
                initial={{ opacity: 0, rotate: -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 45 }}
                transition={{ duration: 0.2 }}
                viewBox="0 0 16 16"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </motion.svg>
            ) : (
              <motion.svg
                key="menu"
                initial={{ opacity: 0, rotate: 45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -45 }}
                transition={{ duration: 0.2 }}
                viewBox="0 0 16 16"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M3 5h10M3 8h10M3 11h10" />
              </motion.svg>
            )}
          </AnimatePresence>
        </button>
      </motion.div>

      <div className="pointer-events-auto flex items-center gap-6">
        <nav aria-label="Main navigation" className="hidden xl:flex items-center gap-5">
          {primaryNav.map((link) => {
            const active = isActive(link.href);
            // Create is the one action, not one of three places — it gets the
            // primary treatment so "where do I go to make something?" has one answer.
            const isPrimaryAction = link.href === APP_ROUTES.create;
            return (
              <motion.div
                key={link.href}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Link
                  href={link.href}
                  title={link.description}
                  aria-current={active ? "page" : undefined}
                  className={
                    isPrimaryAction
                      ? `rounded-xl px-4 py-2 text-label-base uppercase tracking-widest font-medium transition-colors ${
                          active
                            ? "bg-accent text-white"
                            : "border border-ink/15 text-ink hover:bg-white hover:border-ink/30"
                        }`
                      : navLinkClass(active)
                  }
                >
                  {link.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>

          {creditBalance !== null && (
            <Link
              href={APP_ROUTES.pricing}
              title="Credits — research, drafts and renders each spend from this balance. Click for packs."
              aria-label={`${creditBalance} credits remaining — research, drafts and renders each spend from this balance`}
              className={`text-label-sm font-bold tabular-nums px-2 py-0.5 rounded-md transition-colors ${
                creditBalance < 11
                  ? "bg-warm-soft text-warm hover:bg-warm-soft/80"
                  : "bg-cream-dark text-ink-muted hover:bg-cream-dark/80"
              }`}
            >
              {creditBalance} cr
            </Link>
          )}

          <AccountMenu />

          {isDemo && (
            <span className="text-label-sm uppercase tracking-widest font-medium text-warm bg-warm-soft px-2 py-0.5 rounded-full">
              Demo
            </span>
          )}

        <AnimatePresence>
          {showStage && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-cream-dark px-3 py-1.5 rounded-full shadow-sm"
            >
              {stage === "progress" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
              )}
              {stage === "done" && (
                <span className="flex h-2 w-2 rounded-full bg-success" />
              )}
              <span className="text-label-sm uppercase tracking-widest text-ink-light font-medium">
                {STAGE_LABELS[stage]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
