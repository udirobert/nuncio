export interface VoiceExtractedProfile {
  name?: string;
  company?: string;
  role?: string;
  url?: string;
  senderBrief?: string;
  senderName?: string;
  archetype?: string;
  tone?: string;
  isComplete: boolean;
  missingFields: string[];
  lastAgentMessage: string;
}

export interface ConversationTurn {
  role: "user" | "agent";
  text: string;
}
