/**
 * Demo mode — pre-cached pipeline data for live presentations.
 * Activated by adding ?demo=true to the URL or setting NEXT_PUBLIC_DEMO_MODE=true.
 *
 * This skips all API calls and returns cached data instantly,
 * with artificial delays to simulate the pipeline stages.
 */

import type { Profile } from "@/lib/claude";

export const DEMO_PROFILE: Profile = {
  name: "Sarah Chen",
  current_role: "Head of Payments",
  company: "Stripe",
  notable_work: [
    "Led the Atlas international expansion",
    "Published research on cross-border payment routing",
    "Speaker at Money20/20 2025",
  ],
  interests: [
    "Fintech infrastructure",
    "Developer experience",
    "Global payments",
  ],
  tone: "conversational",
  personalization_hooks: [
    "Atlas international expansion",
    "cross-border payment routing",
    "Money20/20",
  ],
};

export const DEMO_SCRIPT = `Hey Sarah — I came across your work leading the Atlas international expansion at Stripe, and your research on cross-border payment routing really resonated with me.

I'm building something in the payments infrastructure space — specifically around making multi-currency settlement faster for platforms. Your talk at Money20/20 about reducing friction in international payouts is exactly the problem we're solving from a different angle.

I'd love to get 15 minutes of your time to share what we're working on and get your perspective. I think you'd have a sharp take on our approach to routing optimisation.

No pressure either way — but if you're curious, I'll send over a one-pager. Would next week work?`;

export const DEMO_SOURCES = [
  "https://linkedin.com/in/sarahchen",
  "https://x.com/sarahchen_pay",
];

export const DEMO_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const DEMO_ENRICHMENT = [
  {
    url: "https://linkedin.com/in/sarahchen",
    markdown:
      "# Sarah Chen\n\nHead of Payments at Stripe\n\nLed the Atlas international expansion, enabling startups in 40+ countries to incorporate and accept payments. Previously at Square (Block) working on Cash App international.\n\nPublished research on cross-border payment routing optimisation.\n\nSpeaker: Money20/20 2025, Fintech Devcon 2024.",
    success: true,
  },
  {
    url: "https://x.com/sarahchen_pay",
    markdown:
      "# @sarahchen_pay\n\nRecent posts:\n- Thread on reducing settlement times for multi-currency platforms\n- Commentary on EU PSD3 implications for payment orchestration\n- Shared article on real-time cross-border rails in Southeast Asia",
    success: true,
  },
];

/** Artificial delay to simulate API call timing */
export function demoDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
