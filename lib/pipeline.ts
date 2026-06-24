import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import { correctThai } from "./correct";
import type { Segment, Transcript } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

/**
 * Transcription pipeline:
 *   1) extract 16kHz mono audio
 *   2) transcribe with cloud Whisper large-v3 (Groq) for accurate Thai whose
 *      per-character word tokens match the merger in lib/thai.ts
 *   3) Gemini double-check (correctThai) to fix misheard words / homophones /
 *      proper nouns. Never fails the job if the LLM key is missing or errors.
 *
 * Required env: GROQ_API_KEY (STT) and GEMINI_API_KEY (correction, optional).
 */
export async function transcribeJob(
  jobId: string,
  videoFile: string,
  onProgress?: (pct: number, step: string) => void
): Promise<Transcript> {
  onProgress?.(5, "extracting audio");
  const audioFile = jobPath(jobId, "audio.wav");
  await run("ffmpeg", ["-y", "-i", videoFile, "-vn", "-ac", "1", "-ar", "16000", audioFile]);

  onProgress?.(25, "transcribing (cloud large-v3)");
  const cloud = await transcribeCloud(audioFile, {
    language: "th",
    prompt: process.env.STT_PROMPT || undefined,
  });

  let segments: Segment[] = cloud.map((s, i) => ({
    id: i,
    start: s.start,
    end: s.end,
    text: s.text,
    words: (s.words ?? []).map((w) => ({ start: w.start, end: w.end, text: w.text })),
  }));

  // Gemini double-check: fix misheard Thai words, homophones, proper nouns.
  // Only the wording is sent to the LLM; segment count / order / timing stay
  // put. Lines whose text changed drop per-word karaoke timing (renderer falls
  // back to per-segment timing). Any failure keeps the uncorrected transcript.
  if (segments.length) {
    onProgress?.(80, "Gemini checking words");
    try {
      const corrected = await correctThai(segments.map((s) => s.text));
      if (Array.isArray(corrected) && corrected.length === segments.length) {
        segments = segments.map((s, i) => {
          const nt = (corrected[i] ?? s.text).trim();
          return nt && nt !== s.text.trim() ? { ...s, text: nt, words: [] } : s;
        });
      }
    } catch {
      /* keep uncorrected transcript */
    }
  }

  onProgress?.(95, "formatting subtitles");
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
