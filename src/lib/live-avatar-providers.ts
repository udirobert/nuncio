import { createAnamSessionToken } from "@/lib/anam";
import {
  createSynthesiaSession,
  cleanupSynthesiaSession,
  isLiveKitConfigured,
} from "@/lib/livekit";
import {
  SYNTHESIA_AGENT_NAME,
  SYNTHESIA_AVATAR_PARTICIPANT_IDENTITY,
} from "@/lib/call-request";
import type { WorkspaceAccount } from "@/lib/storage/types";

export type LiveAvatarProviderId = "synthesia" | "anam";
export type LiveAvatarTransport = "livekit" | "anam-sdk";

export interface LiveAvatarCapabilities {
  transcripts: boolean;
  reuseHumanRoom: boolean;
}

export interface ProviderReadinessContext {
  workspace: WorkspaceAccount | null;
  share: { anamAvatarId?: string; anamVoiceId?: string };
}

export interface ProviderStartContext {
  sessionId: string;
  systemPrompt: string;
  recipientIdentity: string;
  recipientTtlSeconds: number;
}

export interface ProviderStartHandle {
  provider: LiveAvatarProviderId;
  transport: LiveAvatarTransport;
  capabilities: LiveAvatarCapabilities;
  avatarParticipantIdentity?: string;
  agentName?: string;
  roomName?: string;
  dispatchId?: string;
  response: Record<string, unknown>;
}

export interface LiveAvatarAdapter {
  readonly id: LiveAvatarProviderId;
  readonly transport: LiveAvatarTransport;
  readonly capabilities: LiveAvatarCapabilities;
  readiness(context: ProviderReadinessContext): { avatarId: string; voiceId: string } | null;
  start(context: ProviderStartContext & { avatarId: string; voiceId: string }): Promise<ProviderStartHandle>;
  cleanup(started: ProviderStartHandle | null, partial: { roomName: string; dispatchId?: string }): Promise<boolean>;
}

const SYNTHESIA_AVATAR_ID = /^av_[A-Za-z0-9_-]{1,64}$/;
const PROVIDER_ASSET_ID = /^[A-Za-z0-9_-]{1,64}$/;

const synthesiaAdapter: LiveAvatarAdapter = {
  id: "synthesia",
  transport: "livekit",
  capabilities: { transcripts: true, reuseHumanRoom: true },
  readiness(context) {
    if (!isLiveKitConfigured()) return null;
    if (process.env.NUNCIO_SYNTHESIA_WORKER_ENABLED !== "true") return null;
    if (!process.env.NUNCIO_LIVE_WORKER_TOKEN) return null;
    const avatarId = context.workspace?.synthesiaAvatarId || process.env.SYNTHESIA_AVATAR_ID;
    const voiceId = context.workspace?.liveVoiceId || process.env.ELEVENLABS_VOICE_ID;
    if (!avatarId || !SYNTHESIA_AVATAR_ID.test(avatarId)) return null;
    if (!voiceId || !PROVIDER_ASSET_ID.test(voiceId)) return null;
    return { avatarId, voiceId };
  },
  async start(context) {
    const started = await createSynthesiaSession({
      sessionId: context.sessionId,
      avatarId: context.avatarId,
      voiceId: context.voiceId,
      recipientIdentity: context.recipientIdentity,
      recipientTtlSeconds: context.recipientTtlSeconds,
    });
    return {
      provider: "synthesia",
      transport: "livekit",
      capabilities: { transcripts: true, reuseHumanRoom: true },
      avatarParticipantIdentity: SYNTHESIA_AVATAR_PARTICIPANT_IDENTITY,
      agentName: SYNTHESIA_AGENT_NAME,
      roomName: started.roomName,
      dispatchId: started.dispatchId,
      response: {
        provider: "synthesia",
        transport: "livekit",
        capabilities: { transcripts: true, reuseHumanRoom: true },
        avatarParticipantIdentity: SYNTHESIA_AVATAR_PARTICIPANT_IDENTITY,
        serverUrl: started.serverUrl,
        participantToken: started.participantToken,
        roomName: started.roomName,
        agentName: SYNTHESIA_AGENT_NAME,
      },
    };
  },
  cleanup(_started, partial) {
    return cleanupSynthesiaSession(partial);
  },
};

const anamAdapter: LiveAvatarAdapter = {
  id: "anam",
  transport: "anam-sdk",
  capabilities: { transcripts: true, reuseHumanRoom: false },
  readiness(context) {
    if (!process.env.ANAM_API_KEY) return null;
    const avatarId =
      context.workspace?.anamAvatarId || context.share.anamAvatarId || process.env.ANAM_AVATAR_ID;
    const voiceId =
      context.workspace?.anamVoiceId || context.share.anamVoiceId || process.env.ANAM_VOICE_ID;
    if (!avatarId || !voiceId) return null;
    return { avatarId, voiceId };
  },
  async start(context) {
    const { sessionToken } = await createAnamSessionToken({
      avatarId: context.avatarId,
      voiceId: context.voiceId,
      systemPrompt: context.systemPrompt,
      avatarModel: "cara-4",
    });
    return {
      provider: "anam",
      transport: "anam-sdk",
      capabilities: { transcripts: true, reuseHumanRoom: false },
      response: {
        provider: "anam",
        transport: "anam-sdk",
        capabilities: { transcripts: true, reuseHumanRoom: false },
        sessionToken,
      },
    };
  },
  async cleanup() {
    return true;
  },
};

const ADAPTERS: Record<LiveAvatarProviderId, LiveAvatarAdapter> = {
  synthesia: synthesiaAdapter,
  anam: anamAdapter,
};

export function getLiveAvatarAdapter(id: string): LiveAvatarAdapter | null {
  return Object.hasOwn(ADAPTERS, id) ? ADAPTERS[id as LiveAvatarProviderId] : null;
}

export function resolvePrimaryProvider(): LiveAvatarAdapter | null {
  const raw = process.env.NUNCIO_LIVE_PRIMARY_PROVIDER;
  if (!raw) return synthesiaAdapter;
  return getLiveAvatarAdapter(raw.trim().toLowerCase());
}

export function resolveStartAttempts(
  primary: LiveAvatarAdapter,
  context: ProviderReadinessContext,
): { adapter: LiveAvatarAdapter; ids: { avatarId: string; voiceId: string } }[] {
  const primaryIds = primary.readiness(context);
  if (primary.id === "anam") {
    return primaryIds ? [{ adapter: primary, ids: primaryIds }] : [];
  }
  const anamIds = anamAdapter.readiness(context);
  if (primaryIds) {
    return anamIds
      ? [{ adapter: primary, ids: primaryIds }, { adapter: anamAdapter, ids: anamIds }]
      : [{ adapter: primary, ids: primaryIds }];
  }
  return anamIds ? [{ adapter: anamAdapter, ids: anamIds }] : [];
}

export function isLiveTwinReady(context: ProviderReadinessContext): boolean {
  const primary = resolvePrimaryProvider();
  if (!primary) return false;
  return resolveStartAttempts(primary, context).length > 0;
}
