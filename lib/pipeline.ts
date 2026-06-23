import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import type { Segment, Transcript } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

// Split long audio into short chunks so one garbled stretch (noise/music) can't
// cascade and ruin the rest. Each chunk is transcribed independently; its
// timestamps (relative to the chunk) are shifted by the running offset.
const CHUNK_SECONDS = 25;

async function wavDuration(file: string): Promise<number> {
  try {
    const out = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", file,
    ]);
    const d = parseFloat(out.trim());
    return Number.isFinite(d) && d > 0 ? d : CHUNK_SECONDS;
  } catch {
    return CHUNK_SECONDS;
  }
}

export async function transcribeJob(
  jobId: string,
  videoFile: string,
  onProgress?: (pct: number, step: string) => void
): Promise<Transcript> {
  onProgress?.(5, "กำลังแยกเสียง");
  const audioFile = jobPath(jobId, "audio.wav");
  // 16kHz mono + light speech-band cleanup (helps engine/music/wind noise).
  await run("ffmpeg", [
    "-y", "-i", videoFile, "-vn",
    "-af", "highpass=f=80,lowpass=f=8000,afftdn=nf=-20",
    "-ac", "1", "-ar", "16000", audioFile,
  ]);

  // Cut into ~25s chunks; reset_timestamps so each chunk starts at 0.
  const chunkDir = jobPath(jobId, "chunks");
  fs.mkdirSync(chunkDir, { recursive: true });
  for (const f of fs.readdirSync(chunkDir)) {
    try { fs.unlinkSync(path.join(chunkDir, f)); } catch { /* ignore */ }
  }
  await run("ffmpeg", [
    "-y", "-i", audioFile,
    "-f", "segment", "-segment_time", String(CHUNK_SECONDS),
    "-reset_timestamps", "1", "-ac", "1", "-ar", "16000",
    path.join(chunkDir, "chunk_%03d.wav"),
  ]);
  const chunks = fs.readdirSync(chunkDir).filter((f) => f.endsWith(".wav")).sort();

  onProgress?.(20, "AI กำลังถอดเสียงภาษาไทย (cloud large-v3)");
  const segments: Segment[] = [];
  let offset = 0;
  let id = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunkPath = path.join(chunkDir, chunks[ci]);
    let cloud: Awaited<ReturnType<typeof transcribeCloud>> = [];
    try {
      cloud = await transcribeCloud(chunkPath, {
        language: "th",
        prompt: process.env.STT_PROMPT || undefined,
      });
    } catch {
      cloud = []; // a single failed chunk must not kill the whole job
    }
    for (const s of cloud) {
      segments.push({
        id: id++,
        start: s.start + offset,
        end: s.end + offset,
        text: s.text,
        words: (s.words ?? []).map((w) => ({
          start: w.start + offset,
          end: w.end + offset,
          text: w.text,
        })),
      });
    }
    offset += await wavDuration(chunkPath);
    onProgress?.(20 + Math.round(((ci + 1) / chunks.length) * 70), "AI กำลังถอดเสียงภาษาไทย");
  }

  // free the temporary chunk files (volume is small)
  try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch { /* ignore */ }

  onProgress?.(95, "กำลังจัดรูปแบบซับ");
  const duration = segments.length ? segments[segments.length - 1].end : offset;
  const transcript: Transcript = {
    jobId,
    language: "th",
    duration,
    videoFile: path.basename(videoFile),
    segments,
  };
  fs.writeFileSync(jobPath(jobId, "job.json"), JSON.stringify(transcript));
  return transcript;
}
