import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import { mergeThaiTokens } from "./thai";
import type { Segment, Transcript, Word } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

const MAX_DUR = 4; // seconds per cue
const MAX_WORDS = 12; // words per cue
const MAX_CHARS = 42; // chars per cue

// ---------------------------------------------------------------------------
// Context-aware Gemini proofreader. Sends the WHOLE transcript at once so the
// model can use surrounding lines to pick the right word (tones มา↔ม้า, non-
// words ยอดมิ→ยอดนิยม, garbled loanwords Oklick→อะคริลิค, Everlight→Everest).
// Returns corrected lines (same length/order) or null on any failure.
// Tune the domain hint with env STT_DOMAIN.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
async function geminiCorrect(lines: string[]): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || !lines.length) return null;
  const domain =
    process.env.STT_DOMAIN ||
    "a Thai-language Ford pickup/SUV review video (models: Everest, Ranger, VICTOR body kit, Platinum, Wildtrak)";
  const sys =
    `You proofread Thai subtitles produced by automatic speech-to-text from ${domain}. ` +
    `You receive a JSON array of consecutive subtitle lines. Fix ONLY transcription errors, ` +
    `using context across lines: misheard words, wrong Thai tone/vowels (e.g. มา↔ม้า), ` +
    `non-words (e.g. ยอดมิ→ยอดนิยม), and garbled English loanwords/brands ` +
    `(e.g. Oklick→อะคริลิค, Everlight/Everless→Everest, Daytim→Daytime). ` +
    `Keep real brand/model names (Ford, Everest, Ranger, VICTOR, Platinum, Wildtrak). ` +
    `Do NOT translate, paraphrase, merge, split, reorder, add or delete lines, and keep each ` +
    `line's length close to the original. Return ONLY a JSON array of the corrected strings, ` +
    `exactly the same length and order as the input.`;
  const user = `Return a JSON array of exactly ${lines.length} corrected strings.\n\nInput:\n${JSON.stringify(lines)}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8192 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length !== lines.length) return null;
    return arr.map((x) => String(x));
  } catch {
    return null;
  }
}

// Cloud Whisper returns per-character tokens and sometimes breaks a SEGMENT in
// the middle of a word, which leaves orphan vowel marks at the start of a cue.
// Flatten every token into one timed stream, merge into real Thai WORDS
// (lib/thai.ts, dictionary-glued), then re-chunk at WORD boundaries only.
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

// Rebuild word tokens for a rewritten line so the cue stays word-aligned.
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

// Pin canonical brand spellings deterministically (belt & braces after Gemini).
// Extend via env STT_GLOSSARY="wrong=correct,..." e.g. "oklick=อะคริลิค".
function buildGlossary(): Array<[RegExp, string]> {
  const g: Array<[RegExp, string]> = [
    [/\bw[i1]ctor\b/gi, "VICTOR"],
    [/วิ[คกแ]เตอร์/g, "VICTOR"],
    [/\bever(?:less|est|light)\b/gi, "Everest"],
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
 *   4) context-aware Gemini proofread + glossary
 * Step 4 never fails the job; on any error the transcript is kept as-is.
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

  // context-aware Gemini proofread; rewritten lines get fresh word tokens
  if (segments.length) {
    onProgress?.(80, "AI proofreading words");
    const corrected = await geminiCorrect(segments.map((s) => s.text));
    if (corrected) {
      segments = segments.map((s, i) => {
        const nt = (corrected[i] ?? s.text).trim();
        return nt && nt !== s.text.trim()
          ? { ...s, text: nt, words: wordsFor(nt, s.start, s.end) }
          : s;
      });
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
