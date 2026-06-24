import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import { correctThai } from "./correct";
import type { Segment, Transcript, Word } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

// When Gemini / the glossary rewrites a line, its original per-character word
// tokens no longer match the new text, so we regenerate them: one token per
// character, spread evenly across the segment's [start, end]. lib/thai.ts then
// re-groups these into real Thai words (Intl.Segmenter). Without this the line
// would have no word tokens and could not be segmented ("ไม่เป็นคำ").
function spreadChars(text: string, start: number, end: number): Word[] {
  const chars = Array.from(text);
  const n = chars.length || 1;
  const dur = Math.max(end - start, 0.01);
  return chars.map((ch, i) => ({
    start: start + (dur * i) / n,
    end: start + (dur * (i + 1)) / n,
    text: ch,
  }));
}

// Force canonical spelling for brand / model names that STT + the LLM mishear
// (e.g. the wheel/body-kit brand "VICTOR" -> "WICTOR"/"วิคเตอร์"). Extend via
// env STT_GLOSSARY, a comma list of `wrong=correct` pairs, e.g.
//   STT_GLOSSARY="wictor=VICTOR,วิคเตอร์=VICTOR,เรนเจอร์=Ranger"
function buildGlossary(): Array<[RegExp, string]> {
  const g: Array<[RegExp, string]> = [
    [/\bw[i1]ctor\b/gi, "VICTOR"],
    [/วิ[คกแ]เตอร์/g, "VICTOR"],
  ];
  for (const pair of (process.env.STT_GLOSSARY || "").split(",")) {
    const [from, to] = pair.split("=").map((x) => x.trim());
    if (from && to) {
      const esc = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      g.push([new RegExp(esc, "gi"), to]);
    }
  }
  return g;
}

function applyGlossary(segments: Segment[]): Segment[] {
  const glossary = buildGlossary();
  return segments.map((s) => {
    let t = s.text;
    for (const [re, to] of glossary) t = t.replace(re, to);
    return t !== s.text ? { ...s, text: t, words: spreadChars(t, s.start, s.end) } : s;
  });
}

/**
 * Transcription pipeline:
 *   1) extract 16kHz mono audio
 *   2) transcribe with cloud Whisper large-v3 (Groq) for accurate Thai whose
 *      per-character word tokens match the merger in lib/thai.ts
 *   3) Gemini double-check (correctThai) to fix misheard words / homophones
 *   4) glossary pass to pin brand/model spellings (e.g. VICTOR)
 * Steps 3-4 never fail the job; on any error the transcript is kept as-is.
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
  // Only the wording is sent; segment count / order / timing stay put. Lines
  // whose text changed get fresh per-character tokens (spreadChars) so they can
  // still be word-segmented. Any failure keeps the uncorrected transcript.
  if (segments.length) {
    onProgress?.(80, "Gemini checking words");
    try {
      const corrected = await correctThai(segments.map((s) => s.text));
      if (Array.isArray(corrected) && corrected.length === segments.length) {
        segments = segments.map((s, i) => {
          const nt = (corrected[i] ?? s.text).trim();
          return nt && nt !== s.text.trim()
            ? { ...s, text: nt, words: spreadChars(nt, s.start, s.end) }
            : s;
        });
      }
    } catch {
      /* keep uncorrected transcript */
    }
    segments = applyGlossary(segments);
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
