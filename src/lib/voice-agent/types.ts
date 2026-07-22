export interface VoiceExtractedProfile {
  name?: string;
  company?: string;
  role?: string;
  url?: string;
  senderBrief?: string;
  senderName?: string;
  archetype?: string;
  tone?: string;
  /** Sender playbook for live / agentic conversations. */
  offer?: string;
  wants?: string;
  wiggleRoom?: string;
  constraints?: string[];
  isComplete: boolean;
  missingFields: string[];
  lastAgentMessage: string;
}

export interface ConversationTurn {
  role: "user" | "agent";
  text: string;
}
