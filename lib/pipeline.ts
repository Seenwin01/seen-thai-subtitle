import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run, runStream } from "./ffmpeg";
import type { Segment, Transcript } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

// Split long audio into ~25s chunks so one garbled stretch (noise/music) can't
// cascade and ruin the rest. Cuts are SNAPPED to a nearby silence so a word is
// never sliced in half at a boundary. Each chunk is transcribed independently
// and its timestamps shifted by the chunk's start time.
const CHUNK_SECONDS = 25;
const SNAP_WINDOW = 8; // look +-8s around the target for a silence to cut at
const MIN_CHUNK = 5;

async function wavDuration(file: string): Promise<number> {
  try {
    const out = await run("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", file,
    ]);
    const d = parseFloat(out.trim());
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch {
    return 0;
  }
}

// Midpoints of detected silences (in seconds) — good places to cut.
async function silenceMidpoints(audioFile: string): Promise<number[]> {
  const mids: number[] = [];
  let start: number | null = null;
  await runStream(
    "ffmpeg",
    ["-i", audioFile, "-af", "silencedetect=noise=-30dB:d=0.35", "-f", "null", "-"],
    (line) => {
      const s = line.match(/silence_start:\s*([\d.]+)/);
      const e = line.match(/silence_end:\s*([\d.]+)/);
      if (s) start = parseFloat(s[1]);
      else if (e && start !== null) {
        mids.push((start + parseFloat(e[1])) / 2);
        start = null;
      }
    }
  ).catch(() => { /* silencedetect failed -> fall back to fixed cuts */ });
  return mids;
}

function buildCuts(total: number, mids: number[]): number[] {
  const cuts = [0];
  let last = 0;
  while (last + CHUNK_SECONDS < total) {
    const target = last + CHUNK_SECONDS;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const m of mids) {
      if (m <= last + MIN_CHUNK) continue;
      const d = Math.abs(m - target);
      if (d <= SNAP_WINDOW && d < bestDist) { best = m; bestDist = d; }
    }
    const cut = best ?? target;
    cuts.push(cut);
    last = cut;
  }
  cuts.push(total);
  return cuts;
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

  const total = await wavDuration(audioFile);
  const mids = await silenceMidpoints(audioFile);
  const cuts = total > 0 ? buildCuts(total, mids) : [0];

  const chunkDir = jobPath(jobId, "chunks");
  fs.mkdirSync(chunkDir, { recursive: true });
  for (const f of fs.readdirSync(chunkDir)) {
    try { fs.unlinkSync(path.join(chunkDir, f)); } catch { /* ignore */ }
  }

  onProgress?.(20, "AI กำลังถอดเสียงภาษาไทย (cloud large-v3)");
  const segments: Segment[] = [];
  let id = 0;
  const nChunks = Math.max(1, cuts.length - 1);
  for (let ci = 0; ci < nChunks; ci++) {
    const startT = cuts[ci];
    const endT = cuts[ci + 1] ?? total;
    if (endT - startT < 0.2) continue;
    const chunkPath = path.join(chunkDir, `chunk_${String(ci).padStart(3, "0")}.wav`);
    await run("ffmpeg", [
      "-y", "-i", audioFile, "-ss", String(startT), "-to", String(endT),
      "-ac", "1", "-ar", "16000", chunkPath,
    ]);
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
        start: s.start + startT,
        end: s.end + startT,
        text: s.text,
        words: (s.words ?? []).map((w) => ({
          start: w.start + startT,
          end: w.end + startT,
          text: w.text,
        })),
      });
    }
    onProgress?.(20 + Math.round(((ci + 1) / nChunks) * 70), "AI กำลังถอดเสียงภาษาไทย");
  }

  // free the temporary chunk files (volume is small)
  try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch { /* ignore */ }

  onProgress?.(95, "กำลังจัดรูปแบบซับ");
  const duration = total || (segments.length ? segments[segments.length - 1].end : 0);
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
