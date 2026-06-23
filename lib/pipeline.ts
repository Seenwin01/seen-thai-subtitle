import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import type { Segment, Transcript } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

/**
 * Transcription pipeline. Extract 16kHz mono audio then transcribe with a cloud
 * Whisper large-v3 endpoint (Groq by default) for accurate Thai — the old local
 * "small" model was inaccurate AND OOM-prone on a 1GB box.
 *
 * Required env: GROQ_API_KEY  (or OPENAI_API_KEY + STT_PROVIDER=openai)
 */
export async function transcribeJob(
  jobId: string,
  videoFile: string,
  onProgress?: (pct: number, step: string) => void
): Promise<Transcript> {
  onProgress?.(5, "กำลังแยกเสียง");
  const audioFile = jobPath(jobId, "audio.wav");
  await run("ffmpeg", ["-y", "-i", videoFile, "-vn", "-ac", "1", "-ar", "16000", audioFile]);

  onProgress?.(25, "AI กำลังถอดเสียงภาษาไทย (cloud large-v3)");
  const cloud = await transcribeCloud(audioFile, {
    language: "th",
    prompt: process.env.STT_PROMPT || undefined,
  });

  onProgress?.(95, "กำลังจัดรูปแบบซับ");
  // Map cloud result onto the repo's Segment shape (id + words are required).
  const segments: Segment[] = cloud.map((s, i) => ({
    id: i,
    start: s.start,
    end: s.end,
    text: s.text,
    words: (s.words ?? []).map((w) => ({ start: w.start, end: w.end, text: w.text })),
  }));

  const duration = segments.length ? segments[segments.length - 1].end : 0;
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
