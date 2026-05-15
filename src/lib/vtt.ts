/**
 * Convert caption segments to WebVTT format.
 * Creates a blob URL that can be used as a <track> src.
 */

export interface CaptionSegment {
  text: string;
  startTime: number;
  endTime: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export function captionsToVtt(captions: CaptionSegment[]): string {
  const lines = ["WEBVTT", ""];

  captions.forEach((cap, i) => {
    lines.push(String(i + 1));
    lines.push(`${formatTime(cap.startTime)} --> ${formatTime(cap.endTime)}`);
    lines.push(cap.text);
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Create a blob URL for a VTT track from caption segments.
 * Returns null if no captions or not in browser.
 */
export function createVttBlobUrl(captions: CaptionSegment[]): string | null {
  if (typeof window === "undefined" || !captions.length) return null;

  const vtt = captionsToVtt(captions);
  const blob = new Blob([vtt], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}
