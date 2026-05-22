"use client";

import Link from "next/link";
import { motion } from "motion/react";

const ACTIONS = [
  {
    label: "Studio",
    subtitle: "Single video with canvas",
    href: "/studio",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 3v18" />
        <path d="M3 9h18" />
      </svg>
    ),
  },
  {
    label: "Batch",
    subtitle: "Multi-profile campaigns",
    href: "/batch",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Pricing",
    subtitle: "Plans & credit packs",
    href: "/pricing",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export function QuickActions() {
  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-3">
      <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
        Quick actions
      </span>

      <div className="space-y-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-cream-dark/30 transition-colors group"
          >
            <span className="text-ink-faint group-hover:text-accent transition-colors">
              {action.icon}
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-widest font-medium text-ink group-hover:text-accent transition-colors">
                {action.label}
              </div>
              <div className="text-[10px] text-ink-faint">{action.subtitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
