import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import { mergeThaiTokens } from "./thai";
import type { Segment, Transcript, Word } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

const MAX_DUR = 4;
const MAX_WORDS = 12;
const MAX_CHARS = 42;

// Diagnostic for the last Gemini proofread (read back via /api/job/<id>).
let lastProof: Record<string, unknown> = { status: "not-run" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// gemini-2.5-flash is often 503 ("high demand"); fall back to other models and
// retry transient errors. Override the chain with env GEMINI_MODELS.
const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

async function geminiCorrect(lines: string[]): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    lastProof = { status: "no-key" };
    return null;
  }
  if (!lines.length) {
    lastProof = { status: "no-lines" };
    return null;
  }
  const domain =
    process.env.STT_DOMAIN ||
    "a Thai-language Ford pickup/SUV review video (models: Everest, Ranger, VICTOR body kit, Platinum, Wildtrak)";
  const sys =
    `You proofread Thai subtitles produced by automatic speech-to-text from ${domain}. ` +
    `You receive a JSON array of consecutive subtitle lines. Fix ONLY transcription errors, ` +
    `using context across lines: misheard words, wrong Thai tone/vowels (e.g. มา->ม้า, ต่าม->ตาม), ` +
    `non-words (e.g. ยอดมิ->ยอดนิยม, ครัศ->ครับ, กระจาง->กระจัง), and garbled English loanwords/brands ` +
    `(e.g. วอัลเคลีกท์/Oklick->อะคริลิค, Everlight/Everless->Everest). ` +
    `Keep real brand/model names (Ford, Everest, Ranger, VICTOR, Platinum, Wildtrak). ` +
    `Do NOT translate, paraphrase, merge, split, reorder, add or delete lines, and keep each ` +
    `line's length close to the original. Return ONLY a JSON array of the corrected strings, ` +
    `exactly the same length and order as the input.`;
  const user = `Return a JSON array of exactly ${lines.length} corrected strings.\n\nInput:\n${JSON.stringify(lines)}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  });

  let last: Record<string, unknown> = { status: "failed" };
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const raw = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
          const m = raw.match(/\[[\s\S]*\]/);
          if (!m) {
            last = { status: "no-array", model, raw: raw.slice(0, 200) };
            break;
          }
          const arr = JSON.parse(m[0]);
          if (!Array.isArray(arr) || arr.length !== lines.length) {
            last = { status: "len-mismatch", model, got: Array.isArray(arr) ? arr.length : -1, want: lines.length };
            break;
          }
          lastProof = { status: "ok", model };
          return arr.map((x) => String(x));
        }
        const errBody = await res.text().catch(() => "");
        last = { status: "http-error", model, code: res.status, body: errBody.slice(0, 160) };
        if (res.status === 503 || res.status === 429 || res.status === 500) {
          await sleep(1500 * (attempt + 1)); // transient: retry same model
          continue;
        }
        break; // non-retryable: try next model
      } catch (e) {
        last = { status: "exception", model, err: String((e as Error)?.message ?? e).slice(0, 160) };
        await sleep(1000);
      }
    }
  }
  lastProof = last;
  return null;
}

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

  segments = resegment(segments);

  let changed = 0;
  if (segments.length) {
    onProgress?.(80, "AI proofreading words");
    const corrected = await geminiCorrect(segments.map((s) => s.text));
    if (corrected) {
      segments = segments.map((s, i) => {
        const nt = (corrected[i] ?? s.text).trim();
        if (nt && nt !== s.text.trim()) {
          changed++;
          return { ...s, text: nt, words: wordsFor(nt, s.start, s.end) };
        }
        return s;
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
  (transcript as unknown as Record<string, unknown>).proofread = { ...lastProof, changed };
  fs.writeFileSync(jobPath(jobId, "job.json"), JSON.stringify(transcript));
  return transcript;
}
