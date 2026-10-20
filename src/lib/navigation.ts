/**
 * Information architecture — the single source of truth for routes, nav labels
 * and product copy.
 *
 * Why this exists: the app grew six header destinations, two of which pointed
 * at the same URL with a different query string ("Conversations" vs "Setup"),
 * and one of which ("Examples" at /playbook) collided with the product's core
 * concept of *your* playbook. Users could not tell the surfaces apart.
 *
 * Rules that follow from this file:
 *  - Every user-facing destination is a real route. No navigation that only
 *    differs by a query string.
 *  - "Your playbook" is always the representative's playbook (Setup).
 *    Public worked examples live at /examples and are never called "playbook".
 *  - Product copy says what the app does in one sentence, everywhere.
 */

export const APP_ROUTES = {
  home: "/",
  inbox: "/dashboard",
  representative: "/setup",
  create: "/studio",
  batch: "/batch",
  examples: "/examples",
  pricing: "/pricing",
} as const;

/** What this app is, in one sentence. Shown in the app shell, not just marketing. */
export const PRODUCT_ONELINER =
  "Nuncio runs an AI representative that talks to your prospects using the playbook you set.";

/** What the representative actually does once a prospect arrives. */
export const PRODUCT_EXPLAINER =
  "You approve every first touch. Your representative answers live questions on your playbook, and hands you the conversation when it matters.";

export interface NavItem {
  /** Short label for the nav. */
  label: string;
  /** Real route. */
  href: string;
  /** One-line explanation — used in menus and as the link's accessible title. */
  description: string;
  /** Whether the surface only makes sense for a signed-in member. */
  memberOnly?: boolean;
  /** Where the item sits: the three primary spaces, or the secondary set. */
  group: "primary" | "secondary";
}

/**
 * Every destination in one list, so the header, the account menu and the
 * mobile menu can never disagree about what exists.
 */
const ALL_NAV: NavItem[] = [
  // The three spaces of the product, in the order a member works in them.
  {
    label: "Inbox",
    href: APP_ROUTES.inbox,
    description: "Requests, live sessions and bookings",
    group: "primary",
    memberOnly: true,
  },
  {
    label: "Your representative",
    href: APP_ROUTES.representative,
    description: "Who it speaks for, and what it may promise",
    group: "primary",
    memberOnly: true,
  },
  {
    label: "Create",
    href: APP_ROUTES.create,
    description: "Make a first touch from a prospect's profile",
    group: "primary",
    memberOnly: true,
  },
  // Secondary surfaces — reachable, but never competing with the three spaces.
  {
    label: "Batch outreach",
    href: APP_ROUTES.batch,
    description: "Run one brief across a list of profiles",
    group: "secondary",
    memberOnly: true,
  },
  {
    label: "Worked examples",
    href: APP_ROUTES.examples,
    description: "Read how good first touches are written",
    group: "secondary",
  },
  {
    label: "Plan & credits",
    href: APP_ROUTES.pricing,
    description: "Buy credits or change your plan",
    group: "secondary",
  },
];

/** The three spaces of the product. Create is rendered as the primary action. */
export const MEMBER_NAV: NavItem[] = ALL_NAV.filter((i) => i.group === "primary");

/** Secondary surfaces — reachable, but never competing with the three spaces. */
export const SECONDARY_NAV: NavItem[] = ALL_NAV.filter((i) => i.group === "secondary");

/** What an anonymous visitor can open. */
export const PUBLIC_NAV: NavItem[] = ALL_NAV.filter((i) => !i.memberOnly);

/**
 * The three moments of the product, in plain language. Shared by the teaching
 * ladder and the onboarding tour so the two never drift apart.
 */
export const GETTING_STARTED_STEPS = [
  {
    label: "Send a link",
    desc: "Create a first touch from a prospect's profile",
  },
  {
    label: "They talk",
    desc: "Your AI representative answers them, on your playbook",
  },
  {
    label: "They book",
    desc: "They pick a time, or ask for you live",
  },
] as const;

/** Old label kept for the compact variant of the ladder. */
export const FIRST_TOUCH_LABEL = "first touch";
