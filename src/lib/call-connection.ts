export interface CallConnectionMetrics {
  ownerPresent: boolean;
  recipientPresent: boolean;
  observedAt: string;
  ownerJoinedAt?: string;
  recipientJoinedAt?: string;
  firstJointPresenceAt?: string;
}

export interface CallPresenceObservation {
  ownerPresent: boolean;
  recipientPresent: boolean;
  observedAt: string;
}

export function applyCallPresenceObservation(
  existing: CallConnectionMetrics | undefined,
  observation: CallPresenceObservation,
): CallConnectionMetrics {
  const observedAt = Date.parse(observation.observedAt);
  if (!Number.isFinite(observedAt)) throw new Error("Invalid call presence timestamp");
  if (existing && Date.parse(existing.observedAt) >= observedAt) return existing;
  const timestamp = new Date(observedAt).toISOString();
  return {
    ownerPresent: observation.ownerPresent,
    recipientPresent: observation.recipientPresent,
    observedAt: timestamp,
    ownerJoinedAt: existing?.ownerJoinedAt ?? (observation.ownerPresent ? timestamp : undefined),
    recipientJoinedAt: existing?.recipientJoinedAt ?? (observation.recipientPresent ? timestamp : undefined),
    firstJointPresenceAt: existing?.firstJointPresenceAt
      ?? (observation.ownerPresent && observation.recipientPresent ? timestamp : undefined),
  };
}

interface MeasuredCallRequest {
  createdAt: string;
  acceptedAt?: string;
  connection?: CallConnectionMetrics;
}

function elapsedMs(start: string, end: string | undefined): number | null {
  if (!end) return null;
  const duration = Date.parse(end) - Date.parse(start);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

export function callRequestTimings(record: MeasuredCallRequest): {
  ownerResponseLatencyMs: number | null;
  humanConnectionLatencyMs: number | null;
} {
  return {
    ownerResponseLatencyMs: elapsedMs(record.createdAt, record.acceptedAt),
    humanConnectionLatencyMs: elapsedMs(record.createdAt, record.connection?.firstJointPresenceAt),
  };
}

export function summarizeCallRequests(records: readonly MeasuredCallRequest[]): {
  createdRequests: number;
  acceptedRequests: number;
  connectedRequests: number;
  acceptanceRate: number | null;
  connectionSuccessRate: number | null;
} {
  const acceptedRequests = records.filter((record) => Boolean(record.acceptedAt)).length;
  const connectedRequests = records.filter((record) =>
    Boolean(record.acceptedAt) && Boolean(record.connection?.firstJointPresenceAt),
  ).length;
  return {
    createdRequests: records.length,
    acceptedRequests,
    connectedRequests,
    acceptanceRate: records.length ? acceptedRequests / records.length : null,
    connectionSuccessRate: acceptedRequests ? connectedRequests / acceptedRequests : null,
  };
}
