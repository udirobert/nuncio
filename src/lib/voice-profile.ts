import type { VoiceProfileResult } from "@/lib/voice-agent/types";

/**
 * Maps a spoken brief onto the flat form fields the studio and the setup
 * panel use.
 *
 * Two surfaces collect the same information (a one-off campaign brief and the
 * sender's reusable playbook), so the mapping lives here once — the studio
 * and Setup can never disagree about what a voice answer filled in.
 */
export interface MappedVoiceFields {
  url?: string;
  name?: string;
  company?: string;
  role?: string;
  senderName?: string;
  senderBrief?: string;
  senderBusiness?: string;
  senderBrand?: string;
  senderPersonality?: string;
  senderAudience?: string;
  senderOffer?: string;
  senderProofPoints?: string;
  archetype?: string;
  tone?: string;
  offer?: string;
  wants?: string;
  wiggleRoom?: string;
  constraints?: string;
  bookingUrl?: string;
}

/** The fields the voice capture filled in — used to flash "Set by voice". */
export type PopulatedVoiceFields = Set<string>;

export function mapVoiceProfile(profile: VoiceProfileResult): {
  fields: MappedVoiceFields;
  populated: PopulatedVoiceFields;
} {
  const fields: MappedVoiceFields = {};
  const populated: PopulatedVoiceFields = new Set<string>();

  const assign = (key: keyof MappedVoiceFields, value: string | undefined | null) => {
    if (!value) return;
    fields[key] = value;
    populated.add(key);
  };

  assign("url", profile.url);
  // `name`/`company`/`role` describe the recipient in campaign mode.
  if (profile.name) populated.add("name");
  if (profile.company) populated.add("company");
  if (profile.role) populated.add("role");
  assign("senderName", profile.senderName);
  assign("senderBrief", profile.senderBrief);
  assign("senderBusiness", profile.senderBusiness);
  assign("senderBrand", profile.senderBrand);
  assign("senderPersonality", profile.senderPersonality);
  assign("senderAudience", profile.senderAudience);
  assign("senderOffer", profile.senderOffer);
  assign("senderProofPoints", profile.senderProofPoints?.join("\n"));
  if (profile.archetype) fields.archetype = profile.archetype;
  if (profile.tone) fields.tone = profile.tone;
  assign("offer", profile.offer);
  assign("wants", profile.wants);
  assign("wiggleRoom", profile.wiggleRoom);
  assign("constraints", profile.constraints?.join("\n"));
  assign("bookingUrl", profile.bookingUrl);

  return { fields, populated };
}
