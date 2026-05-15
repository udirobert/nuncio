/**
 * Curated showcase recipients shown on the home page.
 *
 * These represent the kind of nuncios that have been (or could be) sent —
 * a recipient + the angle the agent surfaced. The wall demonstrates *what
 * good looks like* before a visitor has typed anything. When real share
 * records become diverse and public-facing, this file can be replaced by
 * a `list()` query against the share storage provider.
 */

export type ShowcasePlatform =
  | "linkedin"
  | "twitter"
  | "github"
  | "farcaster"
  | "facebook";

export interface ShowcaseRecipient {
  /** Stable identifier; if it matches a real share record id, the card deep-links to /v/[id]. */
  id: string;
  name: string;
  role: string;
  platform: ShowcasePlatform;
  /** A single-sentence "angle" the agent chose — italicised on the card. */
  angle: string;
  /** Hex tint for the avatar tile. */
  hue: string;
  /** Optional preview clip (muted, autoplay on hover). */
  videoUrl?: string;
  /**
   * If this recipient has a matching teardown in the playbook, link to it
   * (e.g. "product-feedback" for the Onee Yekeh entry). Without it, the card
   * falls back to the demo flow on the home page.
   */
  playbookId?: string;
}

export const SHOWCASE_RECIPIENTS: ShowcaseRecipient[] = [
  {
    id: "demo-sarah-chen",
    name: "Sarah Chen",
    role: "Head of Payments · Stripe",
    platform: "linkedin",
    angle: "Pulled the Atlas international expansion as the hook — not her current title.",
    hue: "#E8E5FF",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    id: "showcase-onee-yekeh",
    name: "Onee Yekeh",
    role: "Product · HeyGen",
    platform: "linkedin",
    angle: "Opened on her recent post about developer-facing video agents, skipped the company pitch.",
    hue: "#FDF0EB",
    playbookId: "product-feedback",
  },
  {
    id: "showcase-tim-glaser",
    name: "Tim Glaser",
    role: "Co-founder · PostHog",
    platform: "twitter",
    angle: "Referenced his thread on session-replay sampling rather than the obvious 'congrats on the round'.",
    hue: "#E6F4EC",
    playbookId: "founder-growth",
  },
  {
    id: "showcase-gorkem",
    name: "Gorkem Yurtseven",
    role: "Co-founder · Fal",
    platform: "twitter",
    angle: "Led with the FLUX latency benchmark he shared last week, framed the ask as a swap of notes.",
    hue: "#FFF4E0",
    playbookId: "creative-infra",
  },
  {
    id: "showcase-anjney",
    name: "Anjney Midha",
    role: "General Partner · a16z",
    platform: "twitter",
    angle: "Anchored on his open-source AI thesis, not the firm — and named one specific portfolio overlap.",
    hue: "#E8E5FF",
  },
  {
    id: "showcase-guillermo",
    name: "Guillermo Rauch",
    role: "CEO · Vercel",
    platform: "twitter",
    angle: "Picked up his recent take on agentic UIs and reframed our pitch as one concrete answer to it.",
    hue: "#F0EDE8",
  },
  {
    id: "showcase-dax",
    name: "Dax Raad",
    role: "Co-founder · Terminal",
    platform: "github",
    angle: "Skipped the company entirely — referenced a single SST commit that solved our exact problem.",
    hue: "#E6F4EC",
  },
  {
    id: "showcase-amjad",
    name: "Amjad Masad",
    role: "CEO · Replit",
    platform: "twitter",
    angle: "Opened on his Replit Agent demo from Devcon, then made the ask a 10-minute reaction video.",
    hue: "#FDE8EB",
  },
  {
    id: "showcase-linnea",
    name: "Linnea Gandhi",
    role: "Behavioral scientist",
    platform: "linkedin",
    angle: "Referenced her paper on noise audits — and admitted upfront we'd applied the framework imperfectly.",
    hue: "#FFF4E0",
  },
  {
    id: "showcase-kelsey",
    name: "Kelsey Hightower",
    role: "Distinguished Engineer (ret.)",
    platform: "twitter",
    angle: "Quoted his 'no code is the best code' tweet back at him, then asked one specific question.",
    hue: "#E8E5FF",
  },
  {
    id: "showcase-cassidy",
    name: "Cassidy Williams",
    role: "CTO · Contenda",
    platform: "github",
    angle: "Pointed at her `react-hooks-snippets` repo and asked for a 30-second sanity check on our hook design.",
    hue: "#FDF0EB",
  },
  {
    id: "showcase-paul",
    name: "Paul Copplestone",
    role: "CEO · Supabase",
    platform: "twitter",
    angle: "Anchored on the Postgres-as-everything thesis from his recent essay, not the YC association.",
    hue: "#E6F4EC",
  },
];

/** Split the wall into two visually balanced columns for the desktop hero. */
export function splitShowcase(items: ShowcaseRecipient[]) {
  const left: ShowcaseRecipient[] = [];
  const right: ShowcaseRecipient[] = [];
  items.forEach((item, i) => {
    if (i % 2 === 0) left.push(item);
    else right.push(item);
  });
  return { left, right };
}
