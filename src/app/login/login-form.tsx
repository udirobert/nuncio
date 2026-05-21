"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import Link from "next/link";

type Step = "email" | "check" | "done";

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [initialError] = useState(() => {
    if (errorParam === "invalid_or_expired") {
      return "That link has expired or is invalid. Please request a new one.";
    }
    if (errorParam === "missing_token") {
      return "Missing verification token.";
    }
    return "";
  });

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState(initialError);
  const [devLink, setDevLink] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setStep("check");
      if (data.devLink) {
        setDevLink(data.devLink);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-xl font-medium tracking-tight text-ink hover:text-ink-light transition-colors"
          >
            nuncio
          </Link>
        </div>

        {step === "email" && (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight mb-2">
              Sign in
            </h1>
            <p className="text-sm text-ink-muted mb-8">
              Enter your email to receive a magic sign-in link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-cream-dark bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors"
              />

              {error && (
                <p className="text-xs text-warm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-soft transition-colors disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        )}

        {step === "check" && (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight mb-2">
              Check your email
            </h1>
            <p className="text-sm text-ink-muted mb-4">
              We sent a magic sign-in link to <strong className="text-ink">{email}</strong>.
            </p>
            <p className="text-xs text-ink-faint mb-8">
              Click the link in the email to sign in. It expires in 15 minutes.
            </p>

            {devLink && (
              <div className="rounded-xl border border-accent/20 bg-accent-soft/25 p-4">
                <p className="text-xs font-medium text-accent mb-2">Development mode</p>
                <a
                  href={devLink}
                  className="text-sm text-accent underline underline-offset-2 break-all"
                >
                  {devLink}
                </a>
              </div>
            )}

            <button
              onClick={() => setStep("email")}
              className="mt-6 text-xs text-ink-muted hover:text-ink transition-colors underline underline-offset-2"
            >
              Use a different email
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
