import type { Profile } from "@/lib/claude";
import {
  buildHookPrompt,
  HOOK_ARCHETYPES,
  type HookArchetypeId,
  type HookChoice,
} from "./archetypes";

const FORWARD_BET_TERMS = [
  "ai",
  "ml",
  "research",
  "climate",
  "robot",
  "hardware",
  "infrastructure",
  "frontier",
  "model",
];

const PRODUCT_TERMS = [
  "founder",
  "ceo",
  "cto",
  "product",
  "company",
  "startup",
  "platform",
  "app",
  "tool",
];

export function chooseArchetype(
  profile: Profile,
  senderBrief?: string,
  override?: HookArchetypeId
): HookChoice {
  const text = [
    profile.current_role,
    profile.company,
    ...profile.notable_work,
    ...profile.interests,
    ...profile.personalization_hooks,
  ].join(" ").toLowerCase();

  const recentSignal = profile.personalization_hooks.find((hook) => hook.length > 24 && hook.length < 180);

  let archetypeId: HookArchetypeId = "day_in_the_life";
  let reasoning = "The profile has broad interest signals, so a fast day-in-the-life hook gives the agent useful visual range.";

  if (override && HOOK_ARCHETYPES[override]) {
    archetypeId = override;
    reasoning = `The sender explicitly selected ${HOOK_ARCHETYPES[override].label}, so the agent honored that creative direction.`;
  } else if (recentSignal && /["“”']|posted|wrote|said|thread|article|talk|podcast/.test(recentSignal.toLowerCase())) {
    archetypeId = "inside_joke";
    reasoning = "A recent public signal is specific enough to turn into a visual riff, so the agent chose Inside joke.";
  } else if (PRODUCT_TERMS.some((term) => text.includes(term)) || Boolean(profile.company)) {
    archetypeId = "mirror";
    reasoning = "The recipient has a visible company or product surface, so mirroring their work creates the most specific opening shot.";
  } else if (profile.notable_work.length >= 3 || /\b(20|19)\d{2}\b/.test(text)) {
    archetypeId = "origin";
    reasoning = "The profile suggests a longer public arc, so an origin-style opener can make the outreach feel researched.";
  } else if (FORWARD_BET_TERMS.some((term) => text.includes(term))) {
    archetypeId = "future_cast";
    reasoning = "The recipient's work points toward a future-state bet, so the agent chose a speculative cinematic hook.";
  }

  const archetype = HOOK_ARCHETYPES[archetypeId];
  const concept = buildConcept(profile, archetype.label);

  return {
    archetype,
    reasoning,
    concept,
    prompt: buildHookPrompt(profile, archetype, senderBrief),
  };
}

function buildConcept(profile: Profile, archetypeLabel: string): string {
  const target = profile.company || profile.current_role || profile.name;
  const signal = profile.notable_work[0] || profile.personalization_hooks[0] || profile.interests[0];
  return `${archetypeLabel} hook for ${profile.name}: ${signal ? `turn "${signal}" into` : `turn ${target} into`} a 3-second cinematic opener.`;
}
