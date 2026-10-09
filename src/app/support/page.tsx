import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Support — nuncio",
  description: "Contact nuncio for account, data, or plugin questions.",
};

const SUPPORT_EMAIL = process.env.NUNCIO_SUPPORT_EMAIL || "support@example.com";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header stage="input" />

      <main className="flex-1 pt-24 pb-20">
        <section className="px-6 py-12 max-w-[720px] mx-auto">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.9] mb-4">
            Support
          </h1>
          <p className="text-ink-muted text-[15px] leading-relaxed max-w-[480px] mb-8">
            Questions about your account, a live link, data deletion, or our
            ChatGPT/MCP tool — email us and a human will answer.
          </p>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-6 py-3.5 text-sm font-medium shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5 transition-[color,background-color,border-color,opacity,box-shadow,transform]"
          >
            {SUPPORT_EMAIL}
          </a>

          <p className="text-sm text-ink-muted leading-relaxed mt-8 max-w-[480px]">
            You can also read how we handle data on the{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              privacy policy
            </Link>{" "}
            page.
          </p>
        </section>
      </main>
    </div>
  );
}
