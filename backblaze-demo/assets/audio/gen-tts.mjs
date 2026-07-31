import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const KEY = process.env.ELEVENLABS_API_KEY;
const dir = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(dir, "lines.json"), "utf8"));
const VOICE = cfg.voice_id;
const TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps`;

if (!KEY) {
  console.error("ELEVENLABS_API_KEY not set");
  process.exit(1);
}

const timings = {};
for (const line of cfg.lines) {
  const outMp3 = path.join(dir, `line-${line.id}.mp3`);
  if (fs.existsSync(outMp3)) {
    console.log(`skip ${line.id} (exists)`);
    continue;
  }
  process.stdout.write(`generating ${line.id} ... `);
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": KEY },
    body: JSON.stringify({
      text: line.text,
      model_id: cfg.model_id,
      voice_settings: cfg.voice_settings,
    }),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  fs.writeFileSync(outMp3, Buffer.from(data.audio_base64, "base64"));
  fs.writeFileSync(
    path.join(dir, `line-${line.id}.align.json`),
    JSON.stringify(data.normalized_alignment ?? data.alignment ?? {}, null, 2)
  );
  // probe duration
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", outMp3]).toString().trim();
  timings[line.id] = parseFloat(dur);
  console.log(`${dur}s`);
}

// report existing durations for skipped ones
for (const line of cfg.lines) {
  const outMp3 = path.join(dir, `line-${line.id}.mp3`);
  if (timings[line.id] === undefined && fs.existsSync(outMp3)) {
    const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", outMp3]).toString().trim();
    timings[line.id] = parseFloat(dur);
  }
}
fs.writeFileSync(path.join(dir, "line-durations.json"), JSON.stringify(timings, null, 2));
console.log("\nDURATIONS:", JSON.stringify(timings, null, 2));
