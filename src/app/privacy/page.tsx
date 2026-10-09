import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Privacy policy — nuncio",
  description:
    "What nuncio stores, what it never stores, and which third parties touch your data.",
};

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "What we store",
    body: (
      <>
        Your workspace profile (name, role, company, sender brief, playbook),
        the research profiles and scripts you generate, share records for your
        links, and billing/credit state. Recipient names appear only on share
        records you create.
      </>
    ),
  },
  {
    title: "What we deliberately do not store",
    body: (
      <>
        Live avatar conversations are instrumented with{" "}
        <strong>metric labels only</strong> (turn counts, question-topic
        categories, drop-off markers) — nuncio does not persist or log raw
        dialogue. Private handoff invitations store bounded context (a summary,
        interests, unanswered questions), never transcripts. The free{" "}
        <code>research_and_draft</code> tool processes the prospect URL and
        brief you send to draft a message; that route does not persist your
        input as workspace data.
      </>
    ),
  },
  {
    title: "Third parties",
    body: (
      <>
        Research: TinyFish (public-web search). Language models: our configured
        LLM providers. Voice/video: ElevenLabs, HeyGen, Synthesia, Anam,
        LiveKit. Analytics: PostHog. Errors: Sentry (opt-in, only when
        configured). Payments: Stripe. Email: Resend. Each processes data under
        its own terms, only for the step it performs.
      </>
    ),
  },
  {
    title: "Analytics identifiers",
    body: (
      <>
        Product analytics use a salted SHA-256 hash of the request IP as a
        stable identifier — the raw address is never sent to PostHog. Usage
        events carry counts and labels, never prospect URLs, briefs, or drafted
        message text.
      </>
    ),
  },
  {
    title: "Referral attribution",
    body: (
      <>
        If you open nuncio from a shared invite link (<code>?ref=…</code>), we
        store that reference in your browser&apos;s localStorage for up to 30
        days so your signup can be attributed to the person who shared nuncio
        with you. It is removed once attributed and is never used for anything
        else.
      </>
    ),
  },
  {
    title: "Inside ChatGPT and other agent surfaces",
    body: (
      <>
        Our free tool runs read-only research and drafting. nuncio never
        initiates checkout or collects payment inside ChatGPT; paid features
        require signing in on our own site with an existing account.
      </>
    ),
  },
  {
    title: "Deleting your data",
    body: (
      <>
        Contact us (see{" "}
        <Link href="/support" className="text-accent hover:underline">
          support
        </Link>
        ) and we will delete your workspace and associated records.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header stage="input" />

      <main className="flex-1 pt-24 pb-20">
        <section className="px-6 py-12 max-w-[720px] mx-auto">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-[0.9] mb-4">
            Privacy
            <br />
            <span className="text-ink-light">policy</span>
          </h1>
          <p className="text-ink-muted text-[15px] leading-relaxed max-w-[480px] mb-10">
            nuncio is built on honest presence — that includes being plain
            about what data exists and what doesn&apos;t.
          </p>

          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="font-display text-xl tracking-tight mb-2">
                  {section.title}
                </h2>
                <div className="text-sm text-ink-muted leading-relaxed">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <p className="text-label-base text-ink-faint mt-12">
            Last updated: October 2026
          </p>
        </section>
      </main>
    </div>
  );
}
