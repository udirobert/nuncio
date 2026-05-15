"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

/**
 * /playbook — Worked examples of great nuncio outreach.
 *
 * Each example shows: recipient profile, the brief, the generated script,
 * and a teardown of what made it land. Dual purpose:
 * - Onboarding: "show me one for my situation"
 * - Marketing: SEO-rich, shareable, demonstrates the product's intelligence
 */

interface PlaybookEntry {
  id: string;
  category: string;
  categoryColor: string;
  recipient: {
    name: string;
    role: string;
    company: string;
    platform: string;
    url: string;
  };
  brief: string;
  script: string;
  teardown: {
    whatWorked: string[];
    whyItLands: string;
    skipped: string[];
  };
}

const PLAYBOOK: PlaybookEntry[] = [
  {
    id: "product-feedback",
    category: "Product feedback",
    categoryColor: "bg-accent-soft text-accent",
    recipient: {
      name: "Onee Yekeh",
      role: "Product Manager",
      company: "HeyGen",
      platform: "LinkedIn",
      url: "https://ca.linkedin.com/in/yekeh",
    },
    brief:
      "I'm building nuncio, an agentic video personalization pipeline that uses HeyGen to turn public profile context into a short, tailored outreach video. I'd love feedback from a HeyGen product perspective on making developer-facing video agents feel genuinely useful and not like generic automation.",
    script: `Hey Onee — I came across your work on the HeyGen developer platform, and your recent push to make the Video Agent API more agent-friendly really resonated with me.

I'm building nuncio — it's a pipeline that takes someone's public profile, researches them, writes a personalised script, and renders a video using HeyGen's Video Agent. The whole thing runs autonomously in about 90 seconds.

What I'd love your perspective on is this: how do we make developer-facing video agents feel genuinely useful rather than just "AI slop with a face"? Your work on the CLI and the MCP connector suggests you've thought deeply about this.

I have a few specific questions about prompt structure and scene composition that I think would take 15 minutes. Would you be open to a quick call next week?`,
    teardown: {
      whatWorked: [
        "References his specific work (Video Agent API, CLI, MCP connector) — not just his title",
        "Positions the ask as product feedback, not a sales pitch — flattering without being sycophantic",
        "Shows the sender has already built something with HeyGen — credibility signal",
        "Specific time ask (15 minutes) — low commitment, easy to say yes to",
      ],
      whyItLands:
        "This works because it demonstrates the sender has done real work with HeyGen's tools and is asking for expertise, not attention. The recipient feels like a peer being consulted, not a target being pitched.",
      skipped: [
        "His personal background/education — too generic, not relevant to the ask",
        "HeyGen's funding/valuation — corporate context doesn't help a product conversation",
        "Generic compliments about 'amazing product' — hollow without specifics",
      ],
    },
  },
  {
    id: "founder-growth",
    category: "Founder-to-founder",
    categoryColor: "bg-warm-soft text-warm",
    recipient: {
      name: "Tim Glaser",
      role: "CTO & Co-founder",
      company: "PostHog",
      platform: "Twitter/X",
      url: "https://x.com/timgl",
    },
    brief:
      "I'm building nuncio, a personalized video outreach agent for founders and growth teams. I'd love feedback from a PostHog perspective on using product context and behavioral signals to make outreach feel more useful, measurable, and less spammy.",
    script: `Hey Tim — I've been following PostHog's approach to product analytics and your writing on making data actionable for growth teams.

I'm building nuncio — it's an agent that turns someone's public profile into a personalised video in 90 seconds. The thesis is that outreach should feel like a thoughtful message from a peer, not a template with a name swapped in.

Where I'd love your perspective: PostHog thinks deeply about behavioral signals and what makes product interactions feel useful vs annoying. I'm trying to apply that same lens to outreach — using real context about someone's work to make a video that's actually worth watching.

Specifically, I'm curious how you'd think about measuring whether personalised video outreach is landing vs being ignored. Would you be open to a 15-minute chat about signal vs noise in outreach?`,
    teardown: {
      whatWorked: [
        "Connects PostHog's domain (behavioral signals, useful vs annoying) to the sender's problem",
        "Frames the ask in Tim's language — 'signal vs noise' is how PostHog thinks",
        "Doesn't pitch nuncio as a product to buy — positions it as a shared intellectual problem",
        "Acknowledges Tim's writing specifically, not just his company",
      ],
      whyItLands:
        "This works because it maps the recipient's expertise onto the sender's challenge. Tim isn't being asked to evaluate a product — he's being asked to think about a problem he already cares about (useful vs spammy interactions) in a new context.",
      skipped: [
        "PostHog's revenue/growth metrics — irrelevant to the ask",
        "Tim's YC batch or fundraising history — too far back, not current",
        "Comparing nuncio to PostHog competitors — would feel adversarial",
      ],
    },
  },
  {
    id: "creative-infra",
    category: "Creative infrastructure",
    categoryColor: "bg-success-soft text-success",
    recipient: {
      name: "Gorkem Yurtseven",
      role: "Co-founder & CTO",
      company: "Fal",
      platform: "Twitter/X",
      url: "https://x.com/gorkem",
    },
    brief:
      "I'm building nuncio, an agentic video pipeline that can use generative media assets to make personalized business videos feel more cinematic. I'd love feedback from a Fal perspective on fast, scalable creative generation inside developer workflows.",
    script: `Hey Gorkem — I've been watching what Fal is doing with fast inference for generative media, and your focus on making creative generation feel like a developer primitive rather than a design tool really clicks with what I'm building.

nuncio is an agentic pipeline that turns someone's public profile into a personalised outreach video — research, script, visuals, render, all in about 90 seconds. Right now the visual layer is functional but not cinematic.

What I'm curious about: how do you think about making generated visuals feel intentional rather than "AI-generated"? Fal's approach to speed + quality suggests you've cracked something about making generative media feel production-ready rather than demo-ready.

I'd love 15 minutes to talk about how fast creative generation could make personalised video feel less like a template and more like a crafted piece. Open to a call next week?`,
    teardown: {
      whatWorked: [
        "Identifies Fal's specific positioning (developer primitive, not design tool) — shows deep understanding",
        "Frames the gap honestly ('functional but not cinematic') — vulnerability builds trust",
        "Asks about a problem Gorkem has solved (speed + quality) rather than asking him to solve the sender's problem",
        "The phrase 'production-ready rather than demo-ready' mirrors Fal's own messaging",
      ],
      whyItLands:
        "This works because it positions the sender as someone building in an adjacent space who respects Fal's craft. The ask is about philosophy (how to make generated media feel intentional) rather than implementation (how to use your API) — which is more flattering and more interesting to answer.",
      skipped: [
        "Fal's pricing or API specifics — too transactional for a first message",
        "Comparing Fal to Replicate/Stability — would feel like a vendor evaluation",
        "Gorkem's personal background — the company's work is more relevant here",
      ],
    },
  },
  {
    id: "investor-intro",
    category: "Investor pitch",
    categoryColor: "bg-[#FFF3E0] text-[#E65100]",
    recipient: {
      name: "Sarah Chen",
      role: "Partner",
      company: "Sequoia Capital",
      platform: "LinkedIn",
      url: "https://linkedin.com/in/sarahchen",
    },
    brief:
      "I'm raising a seed round for nuncio. Sarah led Sequoia's investment in a video infrastructure company last year. I want to introduce what we're building and why personalised video outreach is a $10B+ market.",
    script: `Hey Sarah — I noticed you led Sequoia's investment in Descript last year, and your thesis on video becoming a developer primitive really aligns with what we're building.

I'm the founder of nuncio. We turn any social profile into a personalised outreach video in 90 seconds — fully autonomous. The agent researches the person, writes a script that references their actual work, and renders it with a cloned voice. No templates, no manual editing.

The market signal is strong: sales teams using personalised video see 3-5x reply rates vs text email, but the production cost makes it impossible at scale. We've collapsed that from 30 minutes per video to 90 seconds.

We're raising a seed round and I'd love to share a 2-minute demo. Would a 20-minute call work sometime next week?`,
    teardown: {
      whatWorked: [
        "Opens with her specific investment thesis (video as developer primitive) — not generic 'you invest in AI'",
        "Leads with the market insight (3-5x reply rates) before the product description",
        "Quantifies the improvement (30 min → 90 seconds) — investors think in multiples",
        "Specific ask (20-minute call, 2-minute demo) — respects her time",
      ],
      whyItLands:
        "This works because it connects the sender's company to the investor's existing thesis. Sarah doesn't need to be convinced that video matters — she already believes it. The pitch just shows a new application of her existing conviction.",
      skipped: [
        "Sequoia's AUM or fund size — she knows where she works",
        "Other companies in her portfolio — could feel like name-dropping",
        "Technical architecture details — save for the call, not the intro",
      ],
    },
  },
  {
    id: "recruiting",
    category: "Recruiting",
    categoryColor: "bg-[#E3F2FD] text-[#1565C0]",
    recipient: {
      name: "Alex Rivera",
      role: "Senior ML Engineer",
      company: "Anthropic",
      platform: "GitHub",
      url: "https://github.com/arivera",
    },
    brief:
      "We're hiring a founding ML engineer for nuncio. Alex has deep experience in LLM applications and has contributed to open-source prompt engineering tools. I want to show this isn't a generic recruiter blast.",
    script: `Hey Alex — I came across your contributions to the prompt-engineering-guide repo, specifically your work on structured output parsing and chain-of-thought validation. That's exactly the kind of thinking we need.

I'm the founder of nuncio — we're building an agentic pipeline that turns social profiles into personalised videos. The ML challenge is fascinating: we need to synthesise cross-platform context into a coherent person-model, then generate scripts that feel genuinely personalised without hallucinating details.

We're hiring a founding ML engineer. The role is: own the intelligence layer end-to-end. Profile synthesis, script generation, personalisation quality scoring, and eventually a feedback loop that learns what makes outreach land.

This isn't a recruiter blast — I'm reaching out because your open-source work shows you think carefully about LLM reliability, which is our core technical challenge. Would you be open to a conversation about what we're building?`,
    teardown: {
      whatWorked: [
        "References specific open-source contributions (structured output parsing, CoT validation) — proves the sender actually looked at their work",
        "Frames the role as a technical challenge, not a job listing — engineers respond to interesting problems",
        "Explicitly says 'this isn't a recruiter blast' and backs it up with specifics",
        "Describes the ML challenge in enough detail to be intellectually interesting",
      ],
      whyItLands:
        "This works because it treats the recipient as a craftsperson whose specific skills are needed, not a resume that matches keywords. The technical challenge description is honest and interesting enough that even if they're not looking, they might reply out of curiosity.",
      skipped: [
        "Salary/equity numbers — too early for a first message",
        "Company stage/funding — save for the conversation",
        "Their current role at Anthropic — don't make them feel like you're poaching",
      ],
    },
  },
  {
    id: "conference-followup",
    category: "Conference follow-up",
    categoryColor: "bg-[#F3E5F5] text-[#7B1FA2]",
    recipient: {
      name: "Maya Patel",
      role: "VP of Sales",
      company: "Gong",
      platform: "LinkedIn",
      url: "https://linkedin.com/in/mayapatel",
    },
    brief:
      "Met Maya briefly at SaaStr Annual. She mentioned Gong is exploring video in their outreach sequences. I want to follow up while the conversation is fresh.",
    script: `Hey Maya — great meeting you at SaaStr last week. Your point about Gong's data showing that personalised touchpoints in the first 48 hours have 4x the conversion of generic sequences really stuck with me.

I'm the one who mentioned we're building nuncio — the tool that generates personalised video outreach from someone's public profile in 90 seconds. After our conversation, I think there's a natural fit with what Gong is exploring around video in sequences.

Specifically: what if every rep could send a video that references the prospect's actual work, generated in the time it takes to write a subject line? That's what we're shipping.

I'd love to show you a live demo — I'll generate one addressed to you right now if you want to see it in action. Would 20 minutes work this week while SaaStr is still fresh?`,
    teardown: {
      whatWorked: [
        "References the specific conversation at SaaStr (48-hour stat) — proves it was a real meeting",
        "Connects their stated interest (video in sequences) to the sender's product — natural, not forced",
        "Offers to demo live ('generate one addressed to you') — meta-demonstration of the product",
        "Time pressure ('while SaaStr is still fresh') — creates urgency without being pushy",
      ],
      whyItLands:
        "This works because it's a genuine follow-up to a real conversation, not a cold outreach disguised as one. The specific detail from their chat (the 48-hour stat) is something only someone who was actually there would know.",
      skipped: [
        "Gong's revenue or market position — she knows her own company",
        "Generic SaaStr recap — everyone got the same emails",
        "Asking for an intro to her team — too aggressive for a follow-up",
      ],
    },
  },
];

function PlaybookCard({ entry, isExpanded, onToggle }: {
  entry: PlaybookEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-cream-dark bg-white overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start gap-4 hover:bg-cream-dark/20 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full ${entry.categoryColor}`}>
              {entry.category}
            </span>
          </div>
          <h3 className="text-base font-medium text-ink mb-1">
            {entry.recipient.name}
          </h3>
          <p className="text-sm text-ink-muted">
            {entry.recipient.role} at {entry.recipient.company} · {entry.recipient.platform}
          </p>
        </div>
        <svg
          viewBox="0 0 16 16"
          className={`w-4 h-4 text-ink-faint transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="px-6 pb-6 space-y-6 border-t border-cream-dark/60 pt-5"
        >
          {/* Brief */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-2">
              Sender brief
            </h4>
            <p className="text-sm text-ink-muted leading-relaxed italic">
              &ldquo;{entry.brief}&rdquo;
            </p>
          </div>

          {/* Generated script */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-ink-faint font-medium mb-2">
              Generated script
            </h4>
            <div className="rounded-xl bg-cream-dark/40 p-4">
              <p className="text-[14px] leading-[1.7] text-ink-light whitespace-pre-wrap">
                {entry.script}
              </p>
            </div>
          </div>

          {/* Teardown */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-ink-faint font-medium">
              Why this works
            </h4>

            <div className="space-y-2">
              {entry.teardown.whatWorked.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-success-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 text-success" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 8.5l3.5 3.5L13 5" />
                    </svg>
                  </span>
                  <p className="text-sm text-ink-light leading-relaxed">{point}</p>
                </div>
              ))}
            </div>

            <p className="text-sm text-ink-muted leading-relaxed bg-accent-soft/30 rounded-xl px-4 py-3 border border-accent/10">
              {entry.teardown.whyItLands}
            </p>

            {/* What was skipped */}
            <div>
              <h5 className="text-[11px] uppercase tracking-widest text-ink-faint font-medium mb-2">
                Deliberately skipped
              </h5>
              <div className="space-y-1.5">
                {entry.teardown.skipped.map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg viewBox="0 0 16 16" className="w-2.5 h-2.5 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 8h8" />
                      </svg>
                    </span>
                    <p className="text-xs text-ink-faint leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Use this example CTA */}
          <div className="pt-2">
            <Link
              href={`/?url=${encodeURIComponent(entry.recipient.url)}&brief=${encodeURIComponent(entry.brief)}`}
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-5 py-3 text-sm font-medium shadow-lg shadow-ink/10 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Try this example
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </motion.div>
      )}
    </motion.article>
  );
}

export default function PlaybookPage() {
  const [expandedId, setExpandedId] = useState<string | null>("product-feedback");

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-dark/60">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink hover:text-ink-light transition-colors"
        >
          nuncio
        </Link>
        <Link
          href="/"
          className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-4 py-2 text-xs font-medium"
        >
          Generate a video
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 max-w-[720px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[0.9] mb-4">
            The nuncio
            <br />
            <span className="italic">playbook</span>
          </h1>
          <p className="text-ink-muted text-[15px] leading-relaxed max-w-[480px]">
            Worked examples of great personalised outreach. Each one shows the
            recipient, the brief, the generated script, and a teardown of what
            made it land — and what was deliberately left out.
          </p>
        </motion.div>
      </section>

      {/* Playbook entries */}
      <section className="px-6 pb-20 max-w-[720px] mx-auto">
        <div className="space-y-3">
          {PLAYBOOK.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <PlaybookCard
                entry={entry}
                isExpanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 max-w-[720px] mx-auto text-center">
        <div className="rounded-2xl border border-cream-dark bg-white/80 px-8 py-8">
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight mb-2">
            Ready to send yours?
          </h2>
          <p className="text-sm text-ink-muted mb-5">
            Paste a profile URL. Get a personalised video in 90 seconds.
          </p>
          <Link
            href="/"
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-ink text-cream px-6 py-3.5 text-sm font-medium shadow-xl shadow-ink/15 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            Generate a video
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 text-center border-t border-cream-dark/60">
        <p className="text-[11px] text-ink-faint">
          nuncio — your intelligent emissary
        </p>
      </footer>
    </div>
  );
}
