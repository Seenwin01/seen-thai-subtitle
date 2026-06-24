import path from "path";
import fs from "fs";
import { jobPath } from "./storage";
import { run } from "./ffmpeg";
import { correctThai } from "./correct";
import type { Segment, Transcript, Word } from "./types";
import { transcribeCloud } from "./transcribe-cloud";

// Cloud Whisper sometimes merges 15-20s of speech into one segment. A subtitle
// that long sticks on screen and drifts out of sync. Split segments into short
// cues (<= ~MAX_DUR s / ~MAX_CHARS chars) at space boundaries, keeping each
// word's real timestamp. Done BEFORE the Gemini pass so corrected lines stay
// short and spreadChars introduces only a tiny timing error.
const MAX_DUR = 4;
const MAX_CHARS = 30;
function splitSegments(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  let id = 0;
  for (const s of segs) {
    const ws: Word[] =
      s.words && s.words.length ? s.words : [{ start: s.start, end: s.end, text: s.text }];
    let buf: Word[] = [];
    let chars = 0;
    const flush = () => {
      const text = buf.map((w) => w.text).join("").trim();
      if (text) {
        out.push({ id: id++, start: buf[0].start, end: buf[buf.length - 1].end, text, words: buf.slice() });
      }
      buf = [];
      chars = 0;
    };
    for (const w of ws) {
      buf.push(w);
      chars += Array.from(w.text || "").length;
      const dur = w.end - buf[0].start;
      const isSpace = !/\S/.test(w.text || "");
      const hard = chars >= MAX_CHARS * 1.6;
      if ((isSpace && (dur >= MAX_DUR || chars >= MAX_CHARS)) || hard) flush();
    }
    if (buf.length) flush();
  }
  return out;
}

// When Gemini / the glossary rewrites a line, its original per-character word
// tokens no longer match the new text, so we regenerate them: one token per
// character, spread evenly across the segment's [start, end]. lib/thai.ts then
// re-groups these into real Thai words (Intl.Segmenter). Because segments are
// already short (splitSegments), the even spread is close enough to real timing.
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
 *   2) transcribe with cloud Whisper large-v3 (Groq)
 *   3) split long segments into short, well-timed cues
 *   4) Gemini double-check (correctThai) + glossary (e.g. VICTOR)
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

  // keep cues short & well-timed before any text rewriting
  segments = splitSegments(segments);

  // Gemini double-check + glossary. Lines whose text changed get fresh
  // per-character tokens (spreadChars); any failure keeps the transcript as-is.
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
