import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dir = path.dirname(new URL(import.meta.url).pathname);
const ffprobe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f]).toString().trim());

// Frame schedule: [frameId, narrationFile(s), preSilence, postSilence]
// The timeline is built from real durations.
const frames = [
  { id: "01", narr: ["line-01.mp3"], pre: 0.5, post: 1.0 },
  { id: "02", narr: ["line-02.mp3"], pre: 1.0, post: 0.5 },
  { id: "03", narr: ["line-03.mp3"], pre: 1.0, post: 1.0 },
  { id: "04", narr: ["line-04.mp3"], pre: 1.0, post: 3.5 },
  { id: "05", narr: ["line-05a.mp3", "avatar-snip.mp3", "line-05b.mp3"], pre: 1.0, post: 0.7, gaps: [1.0, 0.8] },
  { id: "06", narr: ["line-06.mp3"], pre: 0.5, post: 1.0 },
  { id: "07", narr: ["line-07.mp3"], pre: 1.0, post: 1.5 },
  { id: "08", narr: ["line-08.mp3"], pre: 1.0, post: 0.2 },
  { id: "09", narr: ["line-09.mp3"], pre: 1.0, post: 0.0 },
  { id: "10", narr: ["line-10.mp3"], pre: 0.5, post: 7.0 },
];

let cursor = 0;
const schedule = [];
for (const f of frames) {
  const start = cursor;
  cursor += f.pre;
  const narrStarts = [];
  for (let i = 0; i < f.narr.length; i++) {
    narrStarts.push(cursor);
    cursor += ffprobe(path.join(dir, f.narr[i]));
    if (i < f.narr.length - 1) cursor += (f.gaps?.[i] ?? 0.5);
  }
  cursor += f.post;
  schedule.push({ ...f, start, end: cursor, narrStarts, duration: cursor - start });
}

const totalDuration = cursor;
fs.writeFileSync(path.join(dir, "schedule.json"), JSON.stringify({ totalDuration, frames: schedule }, null, 2));
console.log(`Total: ${totalDuration.toFixed(2)}s`);
for (const f of schedule) {
  console.log(`  F${f.id}: ${f.start.toFixed(2)} – ${f.end.toFixed(2)} (${f.duration.toFixed(2)}s) narr@[${f.narrStarts.map(n => n.toFixed(2)).join(", ")}]`);
}
