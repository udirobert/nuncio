import { fetchWithRetry } from "@/lib/retry";

const ANAM_API_KEY = process.env.ANAM_API_KEY;
const ANAM_BASE_URL = process.env.ANAM_BASE_URL || "https://api.anam.ai";

interface AnamAvatar {
  id: string;
  displayName?: string;
  imageUrl?: string;
  videoUrl?: string;
  idleVideoUrl?: string;
  availableVersions?: string[];
  activeVersion?: string | null;
  status?: string;
}

interface AnamVoice {
  id: string;
  displayName?: string;
  sampleUrl?: string;
  provider?: string;
  status?: string;
}

function anamHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${ANAM_API_KEY || ""}`,
  };
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:([A-Za-z0-9+/\-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function urlToBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const parsed = parseDataUrl(url);
  if (parsed) return parsed;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Failed to fetch media from URL: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

function blobFromBuffer(buffer: Buffer, contentType: string): Blob {
  return new Blob([new Uint8Array(buffer)], { type: contentType });
}

/**
 * Create a one-shot avatar in Anam from an image file or public image URL.
 * Returns the Anam avatar ID, which can be used in a persona config or session token.
 */
export async function createAnamAvatar(
  input: { imageUrl: string; displayName?: string } | { imageFile: Buffer; contentType: string; displayName?: string }
): Promise<{ avatarId: string; imageUrl?: string }> {
  if (!ANAM_API_KEY) {
    throw new Error("ANAM_API_KEY is not configured");
  }

  let displayName = "My Avatar";
  let body: BodyInit;

  if ("imageUrl" in input) {
    displayName = input.displayName || displayName;
    const parsed = parseDataUrl(input.imageUrl);
    if (parsed) {
      const form = new FormData();
      form.append("displayName", displayName);
      form.append("imageFile", blobFromBuffer(parsed.buffer, parsed.contentType), "avatar.png");
      body = form;
    } else {
      body = JSON.stringify({ displayName, imageUrl: input.imageUrl });
    }
  } else {
    displayName = input.displayName || displayName;
    const form = new FormData();
    form.append("displayName", displayName);
    form.append("imageFile", blobFromBuffer(input.imageFile, input.contentType), "avatar.png");
    body = form;
  }

  const isJson = typeof body === "string";
  const res = await fetchWithRetry(`${ANAM_BASE_URL}/v1/avatars`, {
    method: "POST",
    headers: isJson ? { ...anamHeaders(), "Content-Type": "application/json" } : anamHeaders(),
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Anam avatar creation failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as AnamAvatar;
  return { avatarId: data.id, imageUrl: data.imageUrl };
}

/**
 * Get the current status of an Anam avatar.
 */
export async function getAnamAvatar(avatarId: string): Promise<{
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  availableVersions?: string[];
  activeVersion?: string | null;
}> {
  if (!ANAM_API_KEY) {
    throw new Error("ANAM_API_KEY is not configured");
  }

  const res = await fetchWithRetry(`${ANAM_BASE_URL}/v1/avatars/${encodeURIComponent(avatarId)}`, {
    headers: anamHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Anam avatar status failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as AnamAvatar;
  return {
    id: data.id,
    imageUrl: data.imageUrl,
    videoUrl: data.videoUrl,
    availableVersions: data.availableVersions,
    activeVersion: data.activeVersion,
  };
}

/**
 * Create a cloned voice in Anam from an audio file or public audio URL.
 * Returns the Anam voice ID, which can be used in a persona config or session token.
 */
export async function createAnamVoice(
  input: { audioUrl: string; name?: string; language?: string } | { audioFile: Buffer; contentType: string; name?: string; language?: string }
): Promise<{ voiceId: string; sampleUrl?: string }> {
  if (!ANAM_API_KEY) {
    throw new Error("ANAM_API_KEY is not configured");
  }

  const name = ("name" in input ? input.name : undefined) || "My Voice";
  const language = input.language || "en";

  let buffer: Buffer;
  let contentType: string;

  if ("audioUrl" in input) {
    const resolved = await urlToBuffer(input.audioUrl);
    buffer = resolved.buffer;
    contentType = resolved.contentType;
  } else {
    buffer = input.audioFile;
    contentType = input.contentType;
  }

  const form = new FormData();
  form.append("name", name);
  form.append("audioFile", blobFromBuffer(buffer, contentType), "voice.wav");
  form.append("language", language);

  const res = await fetchWithRetry(`${ANAM_BASE_URL}/v1/voices`, {
    method: "POST",
    headers: anamHeaders(),
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Anam voice creation failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as AnamVoice;
  return { voiceId: data.id, sampleUrl: data.sampleUrl };
}

/**
 * Get the current status of an Anam voice.
 */
export async function getAnamVoice(voiceId: string): Promise<{
  id: string;
  sampleUrl?: string;
  provider?: string;
}> {
  if (!ANAM_API_KEY) {
    throw new Error("ANAM_API_KEY is not configured");
  }

  const res = await fetchWithRetry(`${ANAM_BASE_URL}/v1/voices/${encodeURIComponent(voiceId)}`, {
    headers: anamHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Anam voice status failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as AnamVoice;
  return { id: data.id, sampleUrl: data.sampleUrl, provider: data.provider };
}

/**
 * Create a session token for an ephemeral Anam persona.
 */
export async function createAnamSessionToken(personaConfig: {
  avatarId: string;
  voiceId: string;
  systemPrompt: string;
  avatarModel?: string;
  llmId?: string;
}): Promise<{ sessionToken: string }> {
  if (!ANAM_API_KEY) {
    throw new Error("ANAM_API_KEY is not configured");
  }

  const res = await fetchWithRetry(`${ANAM_BASE_URL}/v1/auth/session-token`, {
    method: "POST",
    headers: {
      ...anamHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ personaConfig }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Anam session token failed: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as { sessionToken?: string; token?: string };
  const sessionToken = data.sessionToken || data.token;
  if (!sessionToken) {
    throw new Error("Anam did not return a session token");
  }
  return { sessionToken };
}
