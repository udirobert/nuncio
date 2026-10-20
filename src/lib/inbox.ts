/**
 * The inbox read model.
 *
 * The dashboard used to fetch first touches, live sessions and bookings
 * separately and ask the client to work out what they meant together. The
 * inbox joins them server-side into a relationship state per first touch, so
 * the Inbox can answer "where is Maya?" instead of listing links.
 *
 * Shared by the API route and the client components — one definition, one
 * place to change.
 */

export type RelationshipState =
  | "booked"
  | "requested"
  | "talking"
  | "opened"
  | "sent";

export interface InboxEntry {
  id: string;
  recipientName: string | null;
  senderName: string | null;
  createdAt: string;
  deliveryMode: string | null;
  hasRecordedVideo: boolean;
  invitationProtected: boolean;
  state: RelationshipState;
  /** When the relationship last moved — opened, talked or booked. */
  lastActivityAt: string | null;
  /** How many live conversations happened on this link. */
  conversationCount: number;
  /** When the recipient first opened the link. */
  firstViewedAt: string | null;
}

export interface InboxSession {
  id: string;
  shareId: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  terminalReason?: string;
  metrics?: {
    userTurns?: number;
    agentTurns?: number;
    questionTopics?: string[];
    bookingClicked?: boolean;
    bookingUrlPresent?: boolean;
    lastEvent?: string;
    firstUserTurnAt?: string;
    durationMs?: number;
  };
}

export interface InboxBooking {
  id: string;
  shareId: string;
  status: "started" | "requested" | "confirmed" | "cancelled";
  createdAt: string;
  startsAt: string | null;
  endsAt: string | null;
  recipient: string | null;
  reviewedBrief: {
    goal: string;
    discussed: string;
    openQuestions: string;
    reason: string;
    source: "recipient_reviewed";
    sharedAt: string;
  } | null;
}

export interface InboxPayload {
  entries: InboxEntry[];
  sessions: InboxSession[];
  bookings: InboxBooking[];
  /** Shares with a rendered video — the usage card's count. */
  videoCount: number;
}

/**
 * Where a relationship stands, in order of progress.
 *
 * A call request outranks a booking: a prospect asking for the human is the
 * most urgent thing on the list, even if they also booked.
 */
export function deriveRelationshipState(input: {
  hasCallRequest?: boolean;
  hasBooking?: boolean;
  conversationCount?: number;
  firstViewedAt?: string | null;
}): RelationshipState {
  if (input.hasCallRequest) return "requested";
  if (input.hasBooking) return "booked";
  if ((input.conversationCount ?? 0) > 0) return "talking";
  if (input.firstViewedAt) return "opened";
  return "sent";
}
