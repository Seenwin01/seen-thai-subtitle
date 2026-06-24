import { spawn } from "child_process";

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

// จำกัดจำนวน thread ของ ffmpeg/x264 — ปกติ ffmpeg จะ auto ใช้ตามจำนวน core
// ของเครื่อง host (เช่น 60) ซึ่งกิน RAM มหาศาลจน container บน Railway โดน
// OOM kill (ffmpeg exited null) ตอน re-encode/รีเฟรม. ค่า default 2 ปลอดภัย
// และตั้งทับได้ด้วย env FFMPEG_THREADS.
const FFMPEG_THREADS = process.env.FFMPEG_THREADS || "2";

export function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

/** Like run(), but invokes onLine for each stderr line (for progress). */
export function runStream(
  cmd: string,
  args: string[],
  onLine?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let buf = "";
    let tail = "";
    const handle = (d: Buffer) => {
      buf += d.toString();
      tail = (tail + d.toString()).slice(-2000);
      // ffmpeg uses \r for progress lines; split on both
      const parts = buf.split(/[\r\n]/);
      buf = parts.pop() ?? "";
      if (onLine) for (const l of parts) if (l.trim()) onLine(l);
    };
    p.stderr.on("data", handle);
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${tail}`));
    });
  });
}

export async function probe(file: string): Promise<VideoInfo> {
  const out = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    file,
  ]);
  const json = JSON.parse(out);
  const stream = json.streams?.[0] ?? {};
  return {
    width: Number(stream.width) || 1080,
    height: Number(stream.height) || 1920,
    duration: Number(json.format?.duration) || 0,
  };
}

export async function cutClip(
  input: string,
  start: number,
  duration: number,
  output: string
): Promise<void> {
  await run("ffmpeg", [
    "-y", "-ss", String(start), "-i", input, "-t", String(duration),
    "-threads", FFMPEG_THREADS,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-pix_fmt", "yuv420p", output,
  ]);
}

export async function reframeCenter(input: string, output: string): Promise<void> {
  const vf =
    "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
  await run("ffmpeg", [
    "-y", "-i", input, "-vf", vf,
    "-threads", FFMPEG_THREADS,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "copy", "-pix_fmt", "yuv420p", output,
  ]);
}

export async function reframeAround(
  input: string,
  output: string,
  centerX: number
): Promise<void> {
  const cx = Math.max(0, Math.min(1, centerX));
  const cw = "min(iw,ih*9/16)";
  const x = `clip(iw*${cx}-(${cw})/2,0,iw-(${cw}))`;
  const vf = `crop=${cw}:'min(ih,iw*16/9)':${x}:0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`;
  await run("ffmpeg", [
    "-y", "-i", input, "-vf", vf,
    "-threads", FFMPEG_THREADS,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "copy", "-pix_fmt", "yuv420p", output,
  ]);
}

/**
 * Burn an .ass subtitle file into a video.
 * If onLine is given, ffmpeg stderr is streamed line-by-line for progress.
 */
export async function burnSubtitles(
  input: string,
  assFile: string,
  output: string,
  fontsDir?: string,
  onLine?: (line: string) => void
): Promise<void> {
  const escPath = (p: string) =>
    p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

  let filter = `ass='${escPath(assFile)}'`;
  if (fontsDir) filter = `ass='${escPath(assFile)}':fontsdir='${escPath(fontsDir)}'`;

  const args = [
    "-y", "-i", input, "-vf", filter,
    "-threads", FFMPEG_THREADS,
    "-c:a", "copy", "-c:v", "libx264", "-preset", "veryfast",
    "-crf", "20", "-pix_fmt", "yuv420p", output,
  ];
  if (onLine) await runStream("ffmpeg", args, onLine);
  else await run("ffmpeg", args);
}

/**
 * Re-fit a video into a target WxH canvas (fit + black letterbox/pillarbox),
 * so subtitles/content are never cropped. Used for social aspect variations.
 */
export async function toAspect(
  input: string,
  output: string,
  w: number,
  h: number
): Promise<void> {
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
  await run("ffmpeg", [
    "-y", "-i", input, "-vf", vf,
    "-threads", FFMPEG_THREADS,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "copy", "-pix_fmt", "yuv420p", output,
  ]);
}

/** Scale a video to a target height (keeping aspect, even width). */
export async function scaleTo(
  input: string,
  output: string,
  height: number
): Promise<void> {
  await run("ffmpeg", [
    "-y", "-i", input, "-vf", `scale=-2:${height}:flags=lanczos`,
    "-threads", FFMPEG_THREADS,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "copy", "-pix_fmt", "yuv420p", output,
  ]);
}

/**
 * Render subtitles only, on a transparent background, to a .mov with alpha
 * (QTRLE) for overlaying in an external editor.
 */
export async function renderTransparentSubs(
  assFile: string,
  output: string,
  w: number,
  h: number,
  durationSec: number,
  fontsDir?: string
): Promise<void> {
  const escPath = (p: string) =>
    p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  let ass = `ass='${escPath(assFile)}'`;
  if (fontsDir) ass = `ass='${escPath(assFile)}':fontsdir='${escPath(fontsDir)}'`;
  await run("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=black@0.0:s=${w}x${h}:r=30:d=${Math.max(1, durationSec)}`,
    "-vf", `format=rgba,${ass}`,
    "-threads", FFMPEG_THREADS,
    "-c:v", "qtrle", "-pix_fmt", "argb",
    output,
  ]);
}
