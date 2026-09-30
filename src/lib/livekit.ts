import { AccessToken, AgentDispatchClient, RoomServiceClient, ServerError, TrackSource, TrackType } from "livekit-server-sdk";
import {
  CALL_ROOM_EMPTY_TIMEOUT_S,
  CALL_ROOM_MAX_DURATION_S,
  CALL_ROOM_MAX_PARTICIPANTS,
  SYNTHESIA_AGENT_NAME,
  SYNTHESIA_AVATAR_PARTICIPANT_IDENTITY,
  SYNTHESIA_AVATAR_WAIT_MS,
} from "@/lib/call-request";

interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export function getLiveKitConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export function isLiveKitConfigured(): boolean {
  return getLiveKitConfig() !== null;
}

export function isCallRequestInfraConfigured(): boolean {
  return isLiveKitConfigured();
}

/** LiveKit's REST API expects an https/wss host; keep the scheme LiveKit gave us. */
function httpHost(url: string): string {
  return url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

function roomService(config: LiveKitConfig): RoomServiceClient {
  return new RoomServiceClient(httpHost(config.url), config.apiKey, config.apiSecret);
}

function dispatchService(config: LiveKitConfig): AgentDispatchClient {
  return new AgentDispatchClient(httpHost(config.url), config.apiKey, config.apiSecret);
}

function isRoomMissingError(error: unknown): boolean {
  return error instanceof ServerError && (error.status === 404 || error.code === "not_found");
}

function requireConfig(): LiveKitConfig {
  const config = getLiveKitConfig();
  if (!config) throw new Error("LiveKit is not configured");
  return config;
}

export async function createCallRoom(name: string): Promise<{ name: string }> {
  const config = getLiveKitConfig();
  if (!config) throw new Error("LiveKit is not configured");
  const room = await roomService(config).createRoom({
    name,
    emptyTimeout: CALL_ROOM_EMPTY_TIMEOUT_S,
    departureTimeout: 30,
    maxParticipants: CALL_ROOM_MAX_PARTICIPANTS,
  });
  return { name: room.name };
}

export async function deleteRoom(name: string): Promise<void> {
  const rooms = roomService(requireConfig());
  try {
    await rooms.deleteRoom(name);
  } catch (error) {
    if (!isRoomMissingError(error)) throw error;
  }
  const remaining = await rooms.listRooms([name]);
  if (remaining.some((room) => room.name === name)) {
    throw new Error(`LiveKit room ${name} still present after delete`);
  }
}

export interface RoomPresenceSnapshot {
  roomExists: boolean;
  participantIdentities: string[];
}

/**
 * Current room membership via the LiveKit REST API. Throws when the room
 * listing itself cannot be verified — callers must not treat that as "empty".
 */
export async function listRoomParticipants(roomName: string): Promise<RoomPresenceSnapshot> {
  const config = getLiveKitConfig();
  if (!config) throw new Error("LiveKit is not configured");
  const rooms = roomService(config);
  const matching = await rooms.listRooms([roomName]);
  if (!matching.some((room) => room.name === roomName)) {
    return { roomExists: false, participantIdentities: [] };
  }
  const participants = await rooms.listParticipants(roomName);
  return { roomExists: true, participantIdentities: participants.map((participant) => participant.identity) };
}

export async function removeRoomParticipant(roomName: string, identity: string): Promise<void> {
  try {
    await roomService(requireConfig()).removeParticipant(roomName, identity, {
      revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
    });
  } catch (error) {
    if (!isRoomMissingError(error)) throw error;
  }
}

/**
 * Mint a participant token scoped to exactly what a human call needs:
 * join one room, subscribe, publish microphone audio only. No camera,
 * no data publish, no admin/list powers.
 */
export async function mintCallParticipantToken(input: {
  identity: string;
  roomName: string;
  ttlSeconds: number;
}): Promise<string> {
  const config = getLiveKitConfig();
  if (!config) throw new Error("LiveKit is not configured");
  const ttl = Math.max(1, Math.min(Math.floor(input.ttlSeconds), CALL_ROOM_MAX_DURATION_S));
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: input.identity,
    ttl,
  });
  token.addGrant({
    roomJoin: true,
    room: input.roomName,
    canSubscribe: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: false,
  });
  return token.toJwt();
}

export interface SynthesiaSessionStart {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  dispatchId?: string;
}

/**
 * Start a Synthesia-backed twin session: dedicated room, explicit agent
 * dispatch carrying only {sessionId, avatarId, voiceId} (never prompts or
 * credentials), then wait for the avatar's video track before returning a
 * recipient participant token.
 */
export async function createSynthesiaSession(input: {
  sessionId: string;
  avatarId: string;
  voiceId: string;
  recipientIdentity: string;
  recipientTtlSeconds: number;
  waitForAvatarMs?: number;
}): Promise<SynthesiaSessionStart> {
  const config = getLiveKitConfig();
  if (!config) throw new Error("LiveKit is not configured");

  const roomName = `nuncio-live-${input.sessionId}`;
  await roomService(config).createRoom({
    name: roomName,
    emptyTimeout: CALL_ROOM_EMPTY_TIMEOUT_S,
    maxParticipants: CALL_ROOM_MAX_PARTICIPANTS,
  });

  const dispatch = await dispatchService(config).createDispatch(roomName, SYNTHESIA_AGENT_NAME, {
    metadata: JSON.stringify({
      sessionId: input.sessionId,
      avatarId: input.avatarId,
      voiceId: input.voiceId,
    }),
  });

  await waitForAvatarParticipant(config, roomName, input.waitForAvatarMs ?? SYNTHESIA_AVATAR_WAIT_MS);

  const participantToken = await mintCallParticipantToken({
    identity: input.recipientIdentity,
    roomName,
    ttlSeconds: input.recipientTtlSeconds,
  });

  return {
    serverUrl: config.url,
    participantToken,
    roomName,
    dispatchId: dispatch.id,
  };
}

/**
 * Best-effort teardown of a Synthesia twin session: remove dispatches, delete
 * the room. Returns true only when the room is confirmed gone, so callers can
 * refuse to double-start a paid fallback when cleanup is ambiguous.
 */
export async function cleanupSynthesiaSession(input: {
  roomName: string;
  dispatchId?: string;
}): Promise<boolean> {
  const config = getLiveKitConfig();
  if (!config) return false;
  const rooms = roomService(config);
  const dispatches = dispatchService(config);
  try {
    if (input.dispatchId) {
      await dispatches.deleteDispatch(input.dispatchId, input.roomName).catch(() => {});
    } else {
      const existing = await dispatches.listDispatch(input.roomName).catch(() => []);
      for (const dispatch of existing) {
        await dispatches.deleteDispatch(dispatch.id, input.roomName).catch(() => {});
      }
    }
    try {
      await rooms.deleteRoom(input.roomName);
    } catch (error) {
      if (!isRoomMissingError(error)) throw error;
    }
    const remaining = await rooms.listRooms([input.roomName]);
    return remaining.length === 0;
  } catch {
    return false;
  }
}

async function waitForAvatarParticipant(
  config: LiveKitConfig,
  roomName: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const participants = await roomService(config).listParticipants(roomName);
    const avatar = participants.find((participant) =>
      participant.identity === SYNTHESIA_AVATAR_PARTICIPANT_IDENTITY
      && participant.tracks.some((track) => track.type === TrackType.VIDEO),
    );
    if (avatar) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Synthesia avatar did not join the room in time");
}

export const cleanupLiveKitRoom = cleanupSynthesiaSession;
