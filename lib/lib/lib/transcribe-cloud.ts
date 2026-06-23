import { readFile } from "node:fs/promises";
import { basename } from "node:path";

// ---------------------------------------------------------------------------
// Cloud transcription (Whisper large-v3) — accurate Thai STT without OOM.
// Self-contained types (no dependency on lib/types) so it slots into any repo.
// Default provider is Groq (OpenAI-compatible, cheap, fast, large-v3).
// Env: GROQ_API_KEY (default) or OPENAI_API_KEY + STT_PROVIDER=openai.
// ---------------------------------------------------------------------------

export type SttProvider = "groq" | "openai";

export interface CloudWord {
  start: number;
  end: number;
  text: string;
}
export interface CloudSegment {
  start: number;
  end: number;
  text: string;
  words?: CloudWord[];
}

export interface TranscribeOptions {
  provider?: SttProvider;
  language?: string;
  prompt?: string;
  model?: string;
}

interface ProviderConfig {
  url: string;
  key: string;
  model: string;
}

function resolveProvider(opts: TranscribeOptions): ProviderConfig {
  const provider = opts.provider || (process.env.STT_PROVIDER as SttProvider) || "groq";
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    return { url: "https://api.openai.com/v1/audio/transcriptions", key, model: opts.model || "whisper-1" };
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return { url: "https://api.groq.com/openai/v1/audio/transcriptions", key, model: opts.model || "whisper-large-v3" };
}

interface ApiWord { word: string; start: number; end: number }
interface ApiSegment { start: number; end: number; text: string }
interface ApiResponse { text?: string; language?: string; segments?: ApiSegment[]; words?: ApiWord[] }

function mimeFor(file: string): string {
  const ext = file.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "video/mp4", wav: "audio/wav",
    flac: "audio/flac", ogg: "audio/ogg", webm: "audio/webm",
    mov: "video/quicktime", mkv: "video/x-matroska",
  };
  return map[ext] || "application/octet-stream";
}

function attachWords(segments: ApiSegment[], words: ApiWord[]): CloudSegment[] {
  let wi = 0;
  return segments.map((seg) => {
    const segWords: CloudWord[] = [];
    while (wi < words.length && words[wi].start < seg.end - 1e-6) {
      const w = words[wi];
      if (w.end <= seg.start + 1e-6) { wi++; continue; }
      segWords.push({ start: w.start, end: w.end, text: w.word });
      wi++;
    }
    return { start: seg.start, end: seg.end, text: seg.text.trim(), words: segWords.length ? segWords : undefined };
  });
}

function dropArtifacts(segments: CloudSegment[]): CloudSegment[] {
  const out: CloudSegment[] = [];
  for (const seg of segments) {
    const text = (seg.text || "").trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.text.trim() === text && seg.end - seg.start < 1.2) continue;
    out.push(seg);
  }
  return out;
}

/** Transcribe an audio/video file with a cloud Whisper large-v3 endpoint. */
export async function transcribeCloud(filePath: string, opts: TranscribeOptions = {}): Promise<CloudSegment[]> {
  const cfg = resolveProvider(opts);
  const buf = await readFile(filePath);
  const name = basename(filePath);

  const form = new FormData();
  form.append("file", new Blob([buf], { type: mimeFor(name) }), name);
  form.append("model", cfg.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("language", opts.language || "th");
  if (opts.prompt) form.append("prompt", opts.prompt);

  const res = await fetch(cfg.url, { method: "POST", headers: { Authorization: `Bearer ${cfg.key}` }, body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${cfg.model}): ${res.status} ${res.statusText} ${detail}`);
  }
  const data = (await res.json()) as ApiResponse;

  const segments = data.segments ?? [];
  if (!segments.length) {
    const text = (data.text || "").trim();
    if (!text) return [];
    return [{ start: 0, end: Math.max(text.length / 12, 2), text }];
  }
  if (data.words && data.words.length) return dropArtifacts(attachWords(segments, data.words));
  return dropArtifacts(segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })));
}
