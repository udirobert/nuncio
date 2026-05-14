import { BatchClient } from "@speechmatics/batch-client";
import { createSpeechmaticsJWT } from "@speechmatics/auth";

const SPEECHMATICS_API_KEY = process.env.SPEECHMATICS_API_KEY;

function getClient(): BatchClient {
  if (!SPEECHMATICS_API_KEY) {
    throw new Error("SPEECHMATICS_API_KEY is not configured");
  }
  return new BatchClient({
    apiKey: SPEECHMATICS_API_KEY,
    appId: "nuncio",
  });
}

/**
 * Generate a short-lived JWT for realtime WebSocket connections.
 * Used by the browser to connect directly to Speechmatics realtime API.
 */
export async function generateRealtimeToken(): Promise<string> {
  if (!SPEECHMATICS_API_KEY) {
    throw new Error("SPEECHMATICS_API_KEY is not configured");
  }
  const jwt = await createSpeechmaticsJWT({
    type: "rt",
    apiKey: SPEECHMATICS_API_KEY,
    ttl: 120, // 2 minutes — enough for a voice note
  });
  return jwt;
}

/**
 * Transcribe an audio file (batch mode).
 * Used for:
 * - Voice clone quality check (transcribe the sample, check confidence)
 * - Video caption generation (transcribe the rendered video)
 */
export async function transcribeFile(
  audioFile: File | Blob,
  filename: string = "audio.wav"
): Promise<TranscriptionResult> {
  const client = getClient();

  const file = audioFile instanceof File ? audioFile : new File([audioFile], filename);

  const response = await client.transcribe(
    file,
    {
      transcription_config: {
        language: "en",
        operating_point: "enhanced",
        diarization: "none",
      },
    },
    "json-v2"
  );

  if (typeof response === "string") {
    return { transcript: response, confidence: 1, words: [] };
  }

  const words = response.results
    .filter((r) => r.type === "word")
    .map((r) => ({
      content: r.alternatives?.[0]?.content || "",
      confidence: r.alternatives?.[0]?.confidence || 0,
      start: r.start_time || 0,
      end: r.end_time || 0,
    }));

  const avgConfidence =
    words.length > 0
      ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
      : 0;

  const transcript = words.map((w) => w.content).join(" ");

  return {
    transcript,
    confidence: avgConfidence,
    words,
  };
}

/**
 * Transcribe a video URL (fetch → transcribe).
 * Used for generating captions after HeyGen renders.
 */
export async function transcribeVideoUrl(
  videoUrl: string
): Promise<TranscriptionResult> {
  // Fetch the video file
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status}`);
  }

  const blob = await response.blob();
  return transcribeFile(blob, "video.mp4");
}

/**
 * Assess voice clone quality from an audio sample.
 * Returns a quality score and any issues detected.
 */
export async function assessVoiceQuality(
  audioFile: File | Blob
): Promise<VoiceQualityResult> {
  const result = await transcribeFile(audioFile, "voice-sample.wav");

  const issues: string[] = [];

  // Check confidence — low confidence suggests background noise
  if (result.confidence < 0.8) {
    issues.push("Background noise detected — this may affect voice clone quality");
  }

  // Check word count — need enough speech for a good clone
  if (result.words.length < 20) {
    issues.push("Sample is too short — aim for at least 30 seconds of clear speech");
  }

  // Check for long silences (gaps > 3s between words)
  for (let i = 1; i < result.words.length; i++) {
    const gap = result.words[i].start - result.words[i - 1].end;
    if (gap > 3) {
      issues.push("Long silences detected — try recording continuous speech");
      break;
    }
  }

  const quality: "good" | "fair" | "poor" =
    issues.length === 0 ? "good" : issues.length === 1 ? "fair" : "poor";

  return {
    quality,
    confidence: result.confidence,
    transcript: result.transcript,
    wordCount: result.words.length,
    issues,
  };
}

// Types

export interface TranscriptionWord {
  content: string;
  confidence: number;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: TranscriptionWord[];
}

export interface VoiceQualityResult {
  quality: "good" | "fair" | "poor";
  confidence: number;
  transcript: string;
  wordCount: number;
  issues: string[];
}

export interface CaptionSegment {
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Generate caption segments from a transcription result.
 * Groups words into ~5-second segments for subtitle display.
 */
export function generateCaptions(
  result: TranscriptionResult,
  segmentDuration: number = 5
): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  let currentSegment: TranscriptionWord[] = [];
  let segmentStart = 0;

  for (const word of result.words) {
    if (currentSegment.length === 0) {
      segmentStart = word.start;
    }

    currentSegment.push(word);

    // End segment if duration exceeded or natural pause
    const elapsed = word.end - segmentStart;
    if (elapsed >= segmentDuration) {
      segments.push({
        text: currentSegment.map((w) => w.content).join(" "),
        startTime: segmentStart,
        endTime: word.end,
      });
      currentSegment = [];
    }
  }

  // Flush remaining words
  if (currentSegment.length > 0) {
    segments.push({
      text: currentSegment.map((w) => w.content).join(" "),
      startTime: segmentStart,
      endTime: currentSegment[currentSegment.length - 1].end,
    });
  }

  return segments;
}
