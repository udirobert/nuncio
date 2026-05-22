"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Link from "next/link";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
}

interface BillingData {
  balance: number;
  plan: string;
  transactions: Transaction[];
}

export function CreditCard() {
  const [data, setData] = useState<BillingData | null>(null);

  useEffect(() => {
    fetch("/api/billing/balance")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-5 space-y-4">
      <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
        Credits
      </span>

      <div className="flex items-baseline gap-1">
        <span className="font-[family-name:var(--font-display)] text-4xl text-ink">
          {data?.balance ?? "—"}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-faint">Plan</span>
        <span className="text-ink font-medium capitalize">{data?.plan || "free"}</span>
      </div>

      {data && data.transactions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-cream-dark">
          <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium">
            Recent
          </span>
          {data.transactions.slice(0, 5).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between text-[11px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                    tx.type === "grant"
                      ? "bg-success"
                      : tx.type === "debit"
                        ? "bg-accent"
                        : "bg-warm"
                  }`}
                />
                <span className="text-ink-muted truncate">{tx.reason}</span>
              </div>
              <span
                className={`shrink-0 font-medium ${
                  tx.amount > 0 ? "text-success" : "text-ink"
                }`}
              >
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/pricing"
        className="block text-center text-[11px] uppercase tracking-widest font-medium text-accent hover:text-accent/80 transition-colors pt-2 border-t border-cream-dark"
      >
        Buy credits
      </Link>
    </div>
  );
}
