const MASKY_API_BASE = "https://masky.ai/api";
const MASKY_TURN_OUTPUTS = ["text", "audio", "video"] as const;

export type MaskyTurnOutput = (typeof MASKY_TURN_OUTPUTS)[number];

export interface MaskyAvatar {
  avatarId: string;
  avatarOwnerUserId: string;
  displayName?: string;
  voiceId?: string | null;
}

export interface MaskyConversation {
  conversationId: string;
  shareSlug: string;
  liveUrl: string;
}

export function maskyConfigured(): boolean {
  return Boolean(process.env.MASKY_API_KEY);
}

function maskyTurnOutput(): MaskyTurnOutput {
  const raw = (process.env.MASKY_TURN_OUTPUT || "video").trim().toLowerCase();
  return (MASKY_TURN_OUTPUTS as readonly string[]).includes(raw)
    ? (raw as MaskyTurnOutput)
    : "video";
}

async function maskyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.MASKY_API_KEY;
  if (!apiKey) throw new Error("MASKY_API_KEY is not configured");
  const res = await fetch(`${MASKY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Masky ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Look up one of our own avatars — needed for its owner id when creating conversations. */
export async function getMaskyAvatar(avatarId: string): Promise<MaskyAvatar | null> {
  const { avatars } = await maskyFetch<{ avatars: MaskyAvatar[] }>("/avatars");
  return avatars.find((a) => a.avatarId === avatarId) ?? null;
}

export async function createMaskyConversation(avatar: MaskyAvatar): Promise<MaskyConversation> {
  const data = await maskyFetch<{
    conversationId: string;
    shareSlug: string;
    liveUrl: string;
  }>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      avatarOwnerUserId: avatar.avatarOwnerUserId,
      avatarId: avatar.avatarId,
    }),
  });
  return data;
}

/** Idle "waiting" clips for the live view; opt-in via MASKY_SILENT_RENDERS=true. */
export async function enableMaskySilentRenders(conversationId: string): Promise<void> {
  await maskyFetch(`/conversations/${conversationId}/silent-renders`, {
    method: "POST",
    body: JSON.stringify({ enabled: true }),
  });
}

/**
 * Inject a verbatim ("speak") turn: nuncio's LLM writes the line, the Masky
 * avatar delivers it in its own face/voice. Replies must stay within Masky's
 * 500-char userText limit — callers truncate before sending.
 */
export async function injectMaskySpeakTurn(input: {
  conversationId: string;
  text: string;
  output?: MaskyTurnOutput;
}): Promise<{ turnId: string }> {
  const data = await maskyFetch<{ turn: { id: string } }>(
    `/conversations/${input.conversationId}/turn`,
    {
      method: "POST",
      body: JSON.stringify({
        userText: input.text,
        mode: "speak",
        output: input.output ?? maskyTurnOutput(),
      }),
    },
  );
  return { turnId: data.turn.id };
}

/** Hard cap for one speak turn — keeps it under Masky's 500-char limit and the ≤3-sentence chunking rule. */
export function truncateForMaskyTurn(text: string, limit = 480): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const sliced = clean.slice(0, limit);
  const boundary = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  return (boundary > 120 ? sliced.slice(0, boundary + 1) : sliced).trim();
}
