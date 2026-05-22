"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import type { PipelineState } from "@/lib/pipeline";
import { AccountMenu } from "@/components/account-menu";

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

  const NAV_LINKS = [
    { label: "Video", href: "/", subtitle: "Quick render" },
    { label: "Studio", href: "/studio", subtitle: "Canvas" },
    { label: "Playbook", href: "/playbook" },
    { label: "Pricing", href: "/pricing" },
    { label: "Batch", href: "/batch" },
    { label: "Dashboard", href: "/dashboard" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="pointer-events-auto"
      >
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
      </motion.div>

      <div className="pointer-events-auto flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <motion.div
                key={link.href}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <Link
                  href={link.href}
                  className={`text-[11px] uppercase tracking-widest font-medium transition-colors ${
                    isActive ? "text-accent" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {link.label}
                  {link.subtitle && (
                    <span className="normal-case tracking-normal text-[9px] text-ink-faint ml-1">
                      {link.subtitle}
                    </span>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

          <AccountMenu />

          {isDemo && (
            <span className="text-[10px] uppercase tracking-widest font-medium text-warm bg-warm-soft px-2 py-0.5 rounded-full">
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
              <span className="text-[10px] uppercase tracking-widest text-ink-light font-medium">
                {STAGE_LABELS[stage]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
