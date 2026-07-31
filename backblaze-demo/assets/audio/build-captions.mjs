import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dir = path.dirname(new URL(import.meta.url).pathname);
const sched = JSON.parse(fs.readFileSync(path.join(dir, "schedule.json"), "utf8"));

const ffprobe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", f]).toString().trim());

const captions = [];
for (const f of sched.frames) {
  f.narr.forEach((n, i) => {
    if (n.includes("avatar")) return; // no caption over the avatar's own voice
    const lineId = n.replace("line-", "").replace(".mp3", "");
    const start = f.narrStarts[i];
    const dur = ffprobe(path.join(dir, n));
    captions.push({
      frame: f.id,
      lineId,
      start: +start.toFixed(3),
      end: +(start + dur).toFixed(3),
      duration: +dur.toFixed(3),
    });
  });
}
fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify(captions, null, 2));
console.log(JSON.stringify(captions, null, 2));
