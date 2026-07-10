import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Segment, Word } from "./types";

// ---------------------------------------------------------------------------
// Cloud transcription (Whisper large-v3) — accurate Thai STT without OOM.
//
// The old pipeline ran faster-whisper "base" inside the 953 MB Railway box,
// which (a) was inaccurate and (b) got OOM-killed on real clips. This module
// offloads transcription to a cloud Whisper large-v3 endpoint. It returns the
// SAME Segment[] shape the rest of the app already consumes (lib/ass.ts,
// lib/cues.ts), so it is a drop-in replacement for the python step.
//
// Default provider is Groq (OpenAI-compatible, cheap, fast, large-v3). OpenAI's
// /audio/transcriptions works too — same payload, just a different base URL/key.
// ---------------------------------------------------------------------------

export type SttProvider = "groq" | "openai";

export interface TranscribeOptions {
  /** Override provider. Defaults to STT_PROVIDER env or "groq". */
  provider?: SttProvider;
  /** ISO-639-1 hint, e.g. "th". Improves accuracy and speed. Omit to auto-detect. */
  language?: string;
  /** Optional domain hint / vocabulary (names, brands) to bias the model. */
  prompt?: string;
  /** Model id. Defaults per provider (groq: whisper-large-v3, openai: whisper-1). */
  model?: string;
}

interface ProviderConfig {
  url: string;
  key: string;
  model: string;
}

function resolveProvider(opts: TranscribeOptions): ProviderConfig {
  const provider =
    opts.provider || (process.env.STT_PROVIDER as SttProvider) || "groq";

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    return {
      url: "https://api.openai.com/v1/audio/transcriptions",
      key,
      model: opts.model || "whisper-1",
    };
  }

  // default: groq
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    key,
    model: opts.model || "whisper-large-v3",
  };
}

// Shape of the verbose_json response we rely on (provider-compatible subset).
interface ApiWord {
  word: string;
  start: number;
  end: number;
}
interface ApiSegment {
  start: number;
  end: number;
  text: string;
}
interface ApiResponse {
  text?: string;
  language?: string;
  segments?: ApiSegment[];
  words?: ApiWord[];
}

function mimeFor(file: string): string {
  const ext = file.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    wav: "audio/wav",
    flac: "audio/flac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    m4v: "video/x-m4v",
  };
  return map[ext] || "application/octet-stream";
}

// Assign the flat word list returned by the API into their parent segments by
// time overlap, producing the Word[] that the karaoke renderer expects.
function attachWords(segments: ApiSegment[], words: ApiWord[]): Segment[] {
  let wi = 0;
  return segments.map((seg) => {
    const segWords: Word[] = [];
    while (wi < words.length && words[wi].start < seg.end - 1e-6) {
      const w = words[wi];
      // skip words that end before this segment starts (shouldn't happen, safety)
      if (w.end <= seg.start + 1e-6) {
        wi++;
        continue;
      }
      segWords.push({ start: w.start, end: w.end, text: w.word });
      wi++;
    }
    return {
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      words: segWords.length ? segWords : undefined,
    };
  });
}

// Drop common Whisper artifacts while being CONSERVATIVE about real speech (the
// user reported subtitles missing words they actually said). We only drop a
// segment when it is an EXACT repeat of the previous kept line AND very short
// (< 0.9s) AND it sits right after that line (gap < 0.4s) — the tight signature
// of a hallucinated echo over silence/music. Genuine short lines that repeat
// with a real pause (e.g. "ใช่ ... ใช่") are kept.
function dropArtifacts(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  let prevRaw: Segment | null = null; // the immediately preceding segment (kept OR dropped)
  let runLen = 0; // length of the current run of identical, short, tight repeats
  for (const seg of segments) {
    const text = (seg.text || "").trim();
    if (!text) {
      prevRaw = null;
      runLen = 0;
      continue;
    }
    // Compare to the IMMEDIATE previous segment, not the last KEPT one, so a
    // 3-in-a-row hallucination echo is measured consecutively (the old code
    // anchored on the last kept segment and leaked the 3rd repeat).
    const tight =
      !!prevRaw &&
      prevRaw.text.trim() === text &&
      seg.end - seg.start < 0.9 &&
      seg.start - prevRaw.end < 0.4;
    runLen = tight ? runLen + 1 : 0;
    prevRaw = seg;
    // Keep the first TWO of an identical run (genuine emphasis like "ไม่ ไม่");
    // drop the 3rd+ tight identical repeat — the signature of a Whisper loop.
    if (tight && runLen >= 2) continue;
    out.push(seg);
  }
  return out;
}

/**
 * Transcribe an audio/video file with a cloud Whisper large-v3 endpoint.
 * Returns Segment[] (with word timestamps when the provider supplies them).
 *
 * @param filePath absolute path to an audio or video file on disk
 */
export async function transcribeCloud(
  filePath: string,
  opts: TranscribeOptions = {}
): Promise<Segment[]> {
  const cfg = resolveProvider(opts);
  const buf = await readFile(filePath);
  const name = basename(filePath);

  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeFor(name) }), name);
  form.append("model", cfg.model);
  form.append("response_format", "verbose_json");
  // request both granularities; providers that ignore "word" still return segments
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  // Thai-first app: default to "th" so short / code-switched clips are not
  // mis-detected as another language. Pass an explicit language to override.
  form.append("language", opts.language || "th");
  if (opts.prompt) form.append("prompt", opts.prompt);

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Transcription failed (${cfg.model}): ${res.status} ${res.statusText} ${detail}`
    );
  }

  const data = (await res.json()) as ApiResponse;

  const segments = data.segments ?? [];
  if (!segments.length) {
    // No segment breakdown: fall back to a single segment from the flat text.
    const text = (data.text || "").trim();
    if (!text) return [];
    // No timing from the provider: estimate a duration from text length so the
    // single cue actually displays (a 0–0 cue would render for 0s = invisible).
    const estEnd = Math.max(text.length / 12, 2);
    return [{ start: 0, end: estEnd, text }];
  }

  if (data.words && data.words.length) {
    return dropArtifacts(attachWords(segments, data.words));
  }

  // segment-level only: text is still accurate, karaoke falls back to per-segment
  return dropArtifacts(
    segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }))
  );
}
