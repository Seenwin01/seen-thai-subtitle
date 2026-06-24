import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import { correctThai } from "./correct";
import { mergeThaiTokens } from "./thai";
import type { Segment, Transcript, Word } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

const MAX_DUR = 4; // seconds per cue
const MAX_WORDS = 12; // words per cue
const MAX_CHARS = 42; // chars per cue

// Cloud Whisper returns per-character tokens and sometimes breaks a SEGMENT in
// the middle of a word (e.g. "เครื่องยนต" | "์ดีเซล"), which leaves orphan vowel
// marks at the start of a cue and makes ass.ts (which chunks seg.words straight
// into cues) cut mid-word. Fix: flatten every token into one timed stream, merge
// it into real Thai WORDS (lib/thai.ts, dictionary-glued), then re-chunk into
// cues at WORD boundaries only. job.json now holds word-level tokens, so the
// burned .ass is always word-aligned.
function rechunk(words: Word[]): Segment[] {
  const out: Segment[] = [];
  let buf: Word[] = [];
  let id = 0;
  const flush = () => {
    const text = buf.map((w) => w.text).join("").trim();
    if (text) {
      out.push({ id: id++, start: buf[0].start, end: buf[buf.length - 1].end, text, words: buf.slice() });
    }
    buf = [];
  };
  for (const w of words) {
    buf.push(w);
    const dur = w.end - buf[0].start;
    const chars = buf.reduce((n, x) => n + Array.from(x.text).length, 0);
    if (dur >= MAX_DUR || buf.length >= MAX_WORDS || chars >= MAX_CHARS) flush();
  }
  flush();
  return out;
}

function resegment(segments: Segment[]): Segment[] {
  const all: Word[] = [];
  for (const s of segments) {
    const ws = s.words && s.words.length ? s.words : [{ start: s.start, end: s.end, text: s.text }];
    for (const w of ws) all.push(w);
  }
  if (!all.length) return segments;
  return rechunk(mergeThaiTokens(all));
}

// Rebuild word tokens for a rewritten line: spread chars over its time span,
// then merge back into Thai words so the cue stays word-aligned.
function wordsFor(text: string, start: number, end: number): Word[] {
  const chars = Array.from(text);
  const n = chars.length || 1;
  const dur = Math.max(end - start, 0.01);
  const spread: Word[] = chars.map((ch, i) => ({
    start: start + (dur * i) / n,
    end: start + (dur * (i + 1)) / n,
    text: ch,
  }));
  return mergeThaiTokens(spread);
}

// Force canonical spelling for brand / model names that STT + the LLM mishear.
// Extend via env STT_GLOSSARY, a comma list of `wrong=correct` pairs, e.g.
//   STT_GLOSSARY="wictor=VICTOR,วิคเตอร์=VICTOR,everless=Everest"
function buildGlossary(): Array<[RegExp, string]> {
  const g: Array<[RegExp, string]> = [
    [/\bw[i1]ctor\b/gi, "VICTOR"],
    [/วิ[คกแ]เตอร์/g, "VICTOR"],
    [/\bever(?:less|est)?\b/gi, "Everest"],
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
    return t !== s.text ? { ...s, text: t, words: wordsFor(t, s.start, s.end) } : s;
  });
}

/**
 * Transcription pipeline:
 *   1) extract 16kHz mono audio
 *   2) transcribe with cloud Whisper large-v3 (Groq)
 *   3) re-segment into word-aligned cues (no mid-word cuts)
 *   4) Gemini double-check (correctThai) + glossary
 * Steps 4 never fail the job; on any error the transcript is kept as-is.
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

  // merge per-character tokens into word-aligned cues
  segments = resegment(segments);

  // Gemini double-check + glossary. Rewritten lines get fresh word tokens so the
  // cue stays word-aligned. Any failure keeps the transcript as-is.
  if (segments.length) {
    onProgress?.(80, "Gemini checking words");
    try {
      const corrected = await correctThai(segments.map((s) => s.text));
      if (Array.isArray(corrected) && corrected.length === segments.length) {
        segments = segments.map((s, i) => {
          const nt = (corrected[i] ?? s.text).trim();
          return nt && nt !== s.text.trim()
            ? { ...s, text: nt, words: wordsFor(nt, s.start, s.end) }
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
