import type { Profile } from "@/lib/claude";

export type HookArchetypeId =
  | "mirror"
  | "origin"
  | "future_cast"
  | "inside_joke"
  | "day_in_the_life";

export interface HookArchetype {
  id: HookArchetypeId;
  label: string;
  oneLine: string;
  bestFit: string;
  promptInstruction: string;
}

export interface HookChoice {
  archetype: HookArchetype;
  reasoning: string;
  concept: string;
  prompt: string;
}

export const HOOK_ARCHETYPES: Record<HookArchetypeId, HookArchetype> = {
  mirror: {
    id: "mirror",
    label: "Mirror",
    oneLine: "Reimagine the recipient's own work as a cinematic opener.",
    bestFit: "Founders and operators with a visible product or company surface.",
    promptInstruction:
      "Create a cinematic visual metaphor for the recipient's product or company becoming alive on screen.",
  },
  origin: {
    id: "origin",
    label: "Origin",
    oneLine: "Turn the recipient's origin story into an archival-feeling opening shot.",
    bestFit: "Executives and builders with a clear public origin or long arc.",
    promptInstruction:
      "Create a warm archival scene that suggests the early environment where this person's work began.",
  },
  future_cast: {
    id: "future_cast",
    label: "Future-cast",
    oneLine: "Show where the recipient's work could lead in the near future.",
    bestFit: "Researchers, AI founders, climate, hardware, and frontier builders.",
    promptInstruction:
      "Create a near-future cinematic shot showing the downstream world their work is helping create.",
  },
  inside_joke: {
    id: "inside_joke",
    label: "Inside joke",
    oneLine: "Visualize a specific recent phrase, post, or public signal.",
    bestFit: "People with recent quotable posts, talks, articles, or memes.",
    promptInstruction:
      "Create a clever visual riff on a specific recent public phrase or signal, polished rather than slapstick.",
  },
  day_in_the_life: {
    id: "day_in_the_life",
    label: "Day-in-the-life",
    oneLine: "Cut quickly through the recipient's interests and working rhythm.",
    bestFit: "People with rich interest signals but no single dominant product.",
    promptInstruction:
      "Create four fast, elegant micro-scenes tied to the recipient's interests and professional rhythm.",
  },
};

export function buildHookPrompt(profile: Profile, archetype: HookArchetype, senderBrief?: string): string {
  const role = [profile.current_role, profile.company && `at ${profile.company}`]
    .filter(Boolean)
    .join(" ");
  const notable = profile.notable_work.filter(Boolean).slice(0, 3).join("; ");
  const interests = profile.interests.filter(Boolean).slice(0, 3).join("; ");
  const hooks = profile.personalization_hooks.filter(Boolean).slice(0, 3).join("; ");

  return [
    "Generate a 3-second cinematic outreach video hook.",
    archetype.promptInstruction,
    `Recipient: ${profile.name}${role ? `, ${role}` : ""}.`,
    notable ? `Notable work: ${notable}.` : "",
    interests ? `Interests: ${interests}.` : "",
    hooks ? `Recent/public signals: ${hooks}.` : "",
    senderBrief ? `Sender objective: ${senderBrief}.` : "",
    "No readable text. No logos. No celebrity likeness. Tasteful, specific, premium, fast first-second impact.",
    "Camera: subtle push-in, clean composition, 16:9, realistic lighting, cinematic grain.",
  ].filter(Boolean).join(" ");
}
