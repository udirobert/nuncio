import { fetchWithRetry } from "./retry";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * Generate a cinematic soundscape or foley effect using ElevenLabs Sound Effects API.
 */
export async function generateSoundEffect(
  text: string,
  durationSeconds?: number,
  promptInfluence: number = 0.3
): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const response = await fetchWithRetry(`${ELEVENLABS_BASE_URL}/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      duration_seconds: durationSeconds,
      prompt_influence: promptInfluence,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs Sound Effects error: ${response.status} — ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const VIBE_PRESETS = [
  {
    id: "tech-office",
    label: "Modern Tech",
    description: "Sleek, productive, minimalist office ambience",
    prompt: "Minimalist modern tech office ambience, distant mechanical keyboard clicks, subtle low-frequency server hum, high-end professional atmosphere",
    icon: "💻",
  },
  {
    id: "quiet-cafe",
    label: "Quiet Cafe",
    description: "Warm, conversational, acoustic morning vibe",
    prompt: "Quiet boutique coffee shop ambience, soft clinking of ceramic cups, distant espresso machine hiss, muffled conversational murmur, warm morning light atmosphere",
    icon: "☕",
  },
  {
    id: "startup-hustle",
    label: "Startup Hustle",
    description: "High-energy, collaborative, fast-paced environment",
    prompt: "Busy high-energy startup office, collaborative murmurs, whiteboard markers scratching, intense but positive productivity atmosphere",
    icon: "🚀",
  },
  {
    id: "zen-studio",
    label: "Zen Studio",
    description: "Calm, focused, creative sanctuary",
    prompt: "Quiet creative studio ambience, soft paper rustling, distant birdsong, airy and peaceful atmosphere, high-end residential creative space",
    icon: "🧘",
  },
  {
    id: "city-pulse",
    label: "City Pulse",
    description: "Urban, dynamic, global business vibe",
    prompt: "Distal city traffic hum, muffled pedestrian sounds, skyscraper wind whistle, dynamic global urban business atmosphere",
    icon: "🏙️",
  },
];

/**
 * Generate a background "vibe" based on a preset ID or custom context.
 */
export async function generateAmbientVibe(context: string): Promise<Buffer> {
  const preset = VIBE_PRESETS.find((p) => p.id === context);
  const prompt = preset ? preset.prompt : `Ambient background soundscape for: ${context}. Subtle, non-distracting, high quality foley.`;
  
  // We use a high prompt influence for ambience to ensure it stays in the background
  return generateSoundEffect(prompt, 20, 0.8);
}

const ENTRANCE_PROMPTS: Record<string, string> = {
  "tech-office": "Futuristic UI whoosh with digital chime, modern tech startup reveal, clean brand intro transition, premium app launch sound",
  "quiet-cafe": "Warm acoustic guitar swell, gentle cinematic reveal, soft orchestral intro, warm brand opening with ambient texture",
  "startup-hustle": "Dynamic energetic whoosh with sub-bass hit, fast startup brand intro, modern power reveal, high-energy launch sound",
  "zen-studio": "Peaceful meditation chime with gentle wind, zen bell resonance, calm mindful opening, soft ambient lift",
  "city-pulse": "Urban cinematic swell with distant city texture, dynamic urban energy reveal, modern skyline intro, metropolitan brand sound",
};

/**
 * Generate a short cinematic entrance SFX for video start.
 * Returns a 2-3 second sound effect that matches the vibe.
 */
export async function generateCinematicEntrance(vibeId: string): Promise<Buffer> {
  const prompt = ENTRANCE_PROMPTS[vibeId] || ENTRANCE_PROMPTS["tech-office"];
  return generateSoundEffect(prompt, 3, 0.9);
}

/**
 * Convert text to speech using ElevenLabs TTS API.
 * Returns MP3 audio buffer.
 */
export async function textToSpeech(
  text: string,
  options?: { voiceId?: string; modelId?: string }
): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  // Default: "Roger" — laid-back, casual, resonant (available on free tier)
  const voiceId = options?.voiceId || "CwhRBWXzGAHq8TQ4Fs17";
  const modelId = options?.modelId || "eleven_flash_v2_5";

  const response = await fetchWithRetry(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
        },
      }),
    },
    { timeoutMs: 30000, maxAttempts: 1 }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.status} — ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Available TTS voices for the UI */
export const TTS_VOICES = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Laid-back, casual" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Mature, confident" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Deep, energetic" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", description: "Smooth, trustworthy" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Professional, knowledgeable" },
];
