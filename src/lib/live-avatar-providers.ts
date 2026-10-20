import { createAnamSessionToken } from "@/lib/anam";
import {
  createMaskyConversation,
  enableMaskySilentRenders,
  getMaskyAvatar,
} from "@/lib/masky";
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

export type LiveAvatarProviderId = "synthesia" | "anam" | "masky";
export type LiveAvatarTransport = "livekit" | "anam-sdk" | "masky-embed";

export interface LiveAvatarCapabilities {
  transcripts: boolean;
  reuseHumanRoom: boolean;
}

export interface ProviderReadinessContext {
  workspace: WorkspaceAccount | null;
  share: { anamAvatarId?: string; anamVoiceId?: string; maskyAvatarId?: string };
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
  /** Masky conversation backing a masky-embed session. */
  masky?: { conversationId: string; shareSlug: string };
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

const MASKY_AVATAR_ID = /^[A-Za-z0-9_-]{1,128}$/;

const maskyAdapter: LiveAvatarAdapter = {
  id: "masky",
  transport: "masky-embed",
  // Text-in / rendered-out transport: the page embeds Masky's live view and
  // recipient turns go through /api/live/turn, so mic + human-room reuse do
  // not apply.
  capabilities: { transcripts: true, reuseHumanRoom: false },
  readiness(context) {
    if (!process.env.MASKY_API_KEY) return null;
    const avatarId =
      context.workspace?.maskyAvatarId ||
      context.share.maskyAvatarId ||
      process.env.MASKY_AVATAR_ID;
    if (!avatarId || !MASKY_AVATAR_ID.test(avatarId)) return null;
    // Masky avatars carry their own voice — no separate voice id to resolve.
    return { avatarId, voiceId: "masky" };
  },
  async start(context) {
    const avatar = await getMaskyAvatar(context.avatarId);
    if (!avatar) throw new Error("Masky avatar not found");
    const conversation = await createMaskyConversation(avatar);
    if (process.env.MASKY_SILENT_RENDERS === "true") {
      enableMaskySilentRenders(conversation.conversationId).catch(() => {});
    }
    return {
      provider: "masky",
      transport: "masky-embed",
      capabilities: { transcripts: true, reuseHumanRoom: false },
      masky: {
        conversationId: conversation.conversationId,
        shareSlug: conversation.shareSlug,
      },
      response: {
        provider: "masky",
        transport: "masky-embed",
        capabilities: { transcripts: true, reuseHumanRoom: false },
        liveUrl: conversation.liveUrl,
        conversationSlug: conversation.shareSlug,
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
  masky: maskyAdapter,
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
  // Fallback order: primary → anam → masky. Masky goes last because it swaps
  // the live voice call for a text-in/embed experience — only configured
  // deployments should ever reach it.
  const attempts: { adapter: LiveAvatarAdapter; ids: { avatarId: string; voiceId: string } }[] = [];
  if (primaryIds) attempts.push({ adapter: primary, ids: primaryIds });
  const anamIds = anamAdapter.readiness(context);
  if (anamIds) attempts.push({ adapter: anamAdapter, ids: anamIds });
  if (primary.id !== "masky") {
    const maskyIds = maskyAdapter.readiness(context);
    if (maskyIds) attempts.push({ adapter: maskyAdapter, ids: maskyIds });
  }
  return attempts;
}

export function isLiveTwinReady(context: ProviderReadinessContext): boolean {
  const primary = resolvePrimaryProvider();
  if (!primary) return false;
  return resolveStartAttempts(primary, context).length > 0;
}
