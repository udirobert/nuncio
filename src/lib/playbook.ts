import type { IntentId } from "@/components/intent-chips";

export interface PlaybookEntry {
  id: string;
  category: string;
  categoryColor: string;
  intent?: IntentId;
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

export const PLAYBOOK: PlaybookEntry[] = [
  {
    id: "product-feedback",
    category: "Product feedback",
    categoryColor: "bg-accent-soft text-accent",
    intent: "warm_intro",
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
    intent: "warm_intro",
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
    intent: "warm_intro",
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
    categoryColor: "bg-warm-soft text-warm",
    intent: "investor_pitch",
    recipient: {
      name: "Priya Sharma",
      role: "Partner",
      company: "Accel",
      platform: "LinkedIn",
      url: "https://linkedin.com/in/priyasharma",
    },
    brief:
      "I'm raising a seed round for nuncio. Priya led Accel's investment in a video infrastructure company last year. I want to introduce what we're building and why personalised video outreach is a $10B+ market.",
    script: `Hey Priya — I noticed you led Accel's investment in Descript last year, and your thesis on video becoming a developer primitive really aligns with what we're building.

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
        "This works because it connects the sender's company to the investor's existing thesis. Priya doesn't need to be convinced that video matters — she already believes it. The pitch just shows a new application of her existing conviction.",
      skipped: [
        "Accel's AUM or fund size — she knows where she works",
        "Other companies in her portfolio — could feel like name-dropping",
        "Technical architecture details — save for the call, not the intro",
      ],
    },
  },
  {
    id: "recruiting",
    category: "Recruiting",
    categoryColor: "bg-accent-soft text-accent",
    intent: "hiring",
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
    id: "conference_followup",
    category: "Conference follow-up",
    categoryColor: "bg-success-soft text-success",
    intent: "conference_followup",
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
