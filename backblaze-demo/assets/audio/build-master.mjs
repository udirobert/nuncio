import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dir = path.dirname(new URL(import.meta.url).pathname);
const sched = JSON.parse(fs.readFileSync(path.join(dir, "schedule.json"), "utf8"));
const TOTAL = sched.totalDuration;

// Build a flat list of [file, startTimeSeconds]
const inputs = [];
for (const f of sched.frames) {
  f.narr.forEach((n, i) => inputs.push([path.join(dir, n), f.narrStarts[i]]));
}
inputs.push([path.join(dir, "bgm-classical-raw.mp3"), 0]); // last input = music

let filter = "";
let concat = "";
for (let idx = 0; idx < inputs.length; idx++) {
  const isMusic = idx === inputs.length - 1;
  if (isMusic) {
    // duck music under the VO, fade in/out
    filter += `[${idx}:a]volume=0.12,afade=t=in:st=0:d=2.0,afade=t=out:st=${(TOTAL - 3.5).toFixed(2)}:d=3.5[music];`;
    concat += "[music]";
  } else {
    const startMs = Math.round(inputs[idx][1] * 1000);
    const [file] = inputs[idx];
    const vol = file.includes("avatar") ? 1.1 : 1.0;
    filter += `[${idx}:a]adelay=${startMs}|${startMs},volume=${vol}[v${idx}];`;
    concat += `[v${idx}]`;
  }
}
filter += `${concat}amix=inputs=${inputs.length}:duration=longest:normalize=0,atrim=0:${TOTAL.toFixed(3)},volume=1.6,alimiter=limit=0.95:level=disabled[out]`;

const args = ["-y", "-v", "error"];
inputs.forEach(([f]) => args.push("-i", f));
args.push("-filter_complex", filter, "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", path.join(dir, "master.mp3"));

execFileSync("ffmpeg", args, { stdio: "inherit" });
const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path.join(dir, "master.mp3")]).toString().trim();
console.log(`master.mp3 -> ${dur}s`);
