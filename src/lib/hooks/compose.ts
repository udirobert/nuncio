import { writeFile, mkdir, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import crypto from "crypto";

const execAsync = promisify(exec);

const COMPOSED_DIR = join(process.cwd(), "public", "composed");

/**
 * Compose a hook video + body video into a single MP4 using ffmpeg concat demuxer.
 *
 * The hook is prepended to the body so the final video opens with the cinematic
 * hook and transitions into the avatar talking-head. If the two URLs are identical
 * (e.g. demo mode), composition is skipped.
 *
 * Primary: ffmpeg concat demuxer (no re-encode, instant).
 * Fallback: ffmpeg with re-encode (slower, handles codec mismatch).
 */
export async function composeFinalVideo(
  hookUrl: string,
  bodyUrl: string,
): Promise<{ composedUrl: string; skipped: boolean }> {
  // Identical URLs — nothing to compose (demo mode or same file)
  if (hookUrl === bodyUrl) {
    return { composedUrl: bodyUrl, skipped: true };
  }

  const tempDir = join(tmpdir(), "nuncio-compose");
  await mkdir(tempDir, { recursive: true });

  const sessionId = crypto.randomUUID();
  const hookPath = join(tempDir, `${sessionId}_hook.mp4`);
  const bodyPath = join(tempDir, `${sessionId}_body.mp4`);
  const fileListPath = join(tempDir, `${sessionId}_files.txt`);
  const outputFileName = `${sessionId}.mp4`;

  await mkdir(COMPOSED_DIR, { recursive: true });

  try {
    // Download both videos
    await Promise.all([
      downloadFile(hookUrl, hookPath),
      downloadFile(bodyUrl, bodyPath),
    ]);

    // Try concat with copy first (no re-encode)
    try {
      return await concatCopy(hookPath, bodyPath, fileListPath, outputFileName);
    } catch (copyError) {
      console.warn("[compose] Concat with -c copy failed, falling back to re-encode:", copyError);
      return await concatReencode(hookPath, bodyPath, fileListPath, outputFileName);
    }
  } finally {
    // Cleanup temp files — never block on cleanup
    Promise.all([
      unlink(hookPath).catch(() => {}),
      unlink(bodyPath).catch(() => {}),
      unlink(fileListPath).catch(() => {}),
    ]);
  }
}

async function concatCopy(
  hookPath: string,
  bodyPath: string,
  fileListPath: string,
  outputFileName: string,
): Promise<{ composedUrl: string; skipped: boolean }> {
  const fileList = `file '${hookPath}'\nfile '${bodyPath}'\n`;
  await writeFile(fileListPath, fileList);

  const outputPath = join(COMPOSED_DIR, outputFileName);

  await execAsync(
    `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy -y "${outputPath}"`,
    { timeout: 30_000 },
  );

  return { composedUrl: `/composed/${outputFileName}`, skipped: false };
}

async function concatReencode(
  hookPath: string,
  bodyPath: string,
  fileListPath: string,
  outputFileName: string,
): Promise<{ composedUrl: string; skipped: boolean }> {
  const fileList = `file '${hookPath}'\nfile '${bodyPath}'\n`;
  await writeFile(fileListPath, fileList);

  const outputPath = join(COMPOSED_DIR, outputFileName);

  await execAsync(
    `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c:v libx264 -c:a aac -y "${outputPath}"`,
    { timeout: 60_000 },
  );

  return { composedUrl: `/composed/${outputFileName}`, skipped: false };
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await writeFile(dest, Buffer.from(arrayBuffer));
}
