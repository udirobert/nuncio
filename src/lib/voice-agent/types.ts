export interface VoiceExtractedProfile {
  name?: string;
  company?: string;
  role?: string;
  url?: string;
  senderBrief?: string;
  senderName?: string;
  archetype?: string;
  tone?: string;
  /** Sender identity — what the sender sells/builds. */
  senderBusiness?: string;
  senderBrand?: string;
  senderPersonality?: string;
  senderAudience?: string;
  senderOffer?: string;
  senderProofPoints?: string[];
  /** Sender playbook for live / agentic conversations. */
  offer?: string;
  wants?: string;
  wiggleRoom?: string;
  constraints?: string[];
  bookingUrl?: string;
  isComplete: boolean;
  missingFields: string[];
  lastAgentMessage: string;
}

export interface ConversationTurn {
  role: "user" | "agent";
  text: string;
}

/**
 * The editable subset of the extracted profile — what the voice overlay hands
 * back to a form. Lives here (not in the component) so the studio, the setup
 * panel and the shared mapper can all speak the same type.
 */
export type VoiceProfileResult = Omit<
  VoiceExtractedProfile,
  "isComplete" | "missingFields" | "lastAgentMessage"
>;
