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

export interface HookFormatChoice {
  aspectRatio: "16:9" | "9:16" | "1:1";
  orientation: "landscape" | "vertical" | "square";
  durationSeconds: number;
  captions: boolean;
  label: string;
  reasoning: string;
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
  const format = pickFormat(profile);
  const archetypePrompt = buildArchetypePrompt(profile, archetype, senderBrief, format);

  return [
    archetypePrompt,
    `Format: ${format.aspectRatio}, ${format.orientation}, ${format.durationSeconds} seconds, captions ${format.captions ? "on" : "off"}.`,
    "No readable text. No logos. No celebrity likeness. Tasteful, specific, premium, fast first-second impact.",
    "Camera: subtle push-in, clean composition, realistic lighting, cinematic grain.",
  ].filter(Boolean).join(" ");
}

export function pickFormat(profile: Profile): HookFormatChoice {
  const text = [
    profile.current_role,
    profile.company,
    ...profile.notable_work,
    ...profile.interests,
    ...profile.personalization_hooks,
  ].join(" ").toLowerCase();

  if (/\b(x|twitter|thread|tweet|posted|post|founder|builder|startup)\b/.test(text)) {
    return {
      aspectRatio: "9:16",
      orientation: "vertical",
      durationSeconds: 22,
      captions: true,
      label: "9:16 · 22s · vertical · captions on",
      reasoning: "The profile reads like a social-first founder or builder audience, so a short vertical format is most likely to stop the scroll.",
    };
  }

  if (/\b(slack|community|async|dm|discord|remote)\b/.test(text)) {
    return {
      aspectRatio: "1:1",
      orientation: "square",
      durationSeconds: 25,
      captions: false,
      label: "1:1 · 25s · square · captions off",
      reasoning: "The recipient context suggests async message surfaces, so a square format keeps the hook compact without feeling like a feed ad.",
    };
  }

  if (/\b(ceo|exec|executive|vp|director|enterprise|linkedin|alphabet|google)\b/.test(text)) {
    return {
      aspectRatio: "16:9",
      orientation: "landscape",
      durationSeconds: 45,
      captions: false,
      label: "16:9 · 45s · landscape · captions off",
      reasoning: "The profile reads as executive or LinkedIn-facing, so a polished landscape format fits the recipient and the demo context.",
    };
  }

  return {
    aspectRatio: "9:16",
    orientation: "vertical",
    durationSeconds: 30,
    captions: true,
    label: "9:16 · 30s · vertical · captions on",
    reasoning: "With no single channel dominating the profile, the agent defaults to a concise vertical hook because it is the most reusable social format.",
  };
}

function buildArchetypePrompt(
  profile: Profile,
  archetype: HookArchetype,
  senderBrief: string | undefined,
  format: HookFormatChoice
): string {
  const role = [profile.current_role, profile.company && `at ${profile.company}`]
    .filter(Boolean)
    .join(" ");
  const notable = profile.notable_work.filter(Boolean).slice(0, 3).join("; ");
  const interests = profile.interests.filter(Boolean).slice(0, 3).join("; ");
  const hooks = profile.personalization_hooks.filter(Boolean).slice(0, 3).join("; ");
  const target = `${profile.name}${role ? `, ${role}` : ""}`;
  const signal = notable || hooks || interests || profile.company || profile.current_role || profile.name;

  const shared = [
    `Generate a ${format.durationSeconds > 5 ? "3-5" : format.durationSeconds}-second cinematic outreach video hook.`,
    `Recipient: ${target}.`,
    notable ? `Notable work: ${notable}.` : "",
    interests ? `Interests: ${interests}.` : "",
    hooks ? `Recent/public signals: ${hooks}.` : "",
    senderBrief ? `Sender objective: ${senderBrief}.` : "",
  ];

  const archetypeLine: Record<HookArchetypeId, string> = {
    mirror:
      `Mirror archetype: reimagine "${signal}" as a premium product surface coming alive on screen, with the recipient's world reflected back as motion and light.`,
    origin:
      `Origin archetype: create a warm archival-feeling shot that hints at the early environment behind "${signal}", using texture, place, and restrained nostalgia instead of literal biography.`,
    future_cast:
      `Future-cast archetype: show a near-future scene where "${signal}" has already changed how people work, with one concrete object or interface carrying the idea.`,
    inside_joke:
      `Inside joke archetype: turn the strongest recent signal, "${hooks || signal}", into a clever visual riff that feels like the sender truly noticed the recipient's public context.`,
    day_in_the_life:
      `Day-in-the-life archetype: create four elegant micro-beats from "${signal}", cutting through the recipient's work rhythm without feeling like a generic lifestyle montage.`,
  };

  return [
    ...shared,
    archetypeLine[archetype.id],
    archetype.promptInstruction,
  ].filter(Boolean).join(" ");
}
