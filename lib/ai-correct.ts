import type { Segment } from "./types";
import { llmComplete, parseStringArray, type LlmOptions } from "./llm";

// ---------------------------------------------------------------------------
// AI text-correction pass.
//
// Whisper gets most words right but fumbles Thai homophones, proper nouns,
// brand names, numbers and punctuation. This sends the transcript to an LLM to
// clean up the WORDING only — it must NOT change the number of segments, the
// order, or the timing. Output maps 1:1 back onto the input segments.
//
// Because corrected text no longer aligns with the original per-character word
// timestamps, we drop `words` on any segment whose text actually changed; the
// renderer (lib/ass.ts / lib/cues.ts) falls back to per-segment timing for
// those. Unchanged segments keep their karaoke word timing.
// ---------------------------------------------------------------------------

export interface CorrectOptions extends LlmOptions {
  /** Language of the transcript, e.g. "ไทย" / "Thai". Helps the model. */
  language?: string;
  /** Names/terms that must be spelled a specific way. */
  glossary?: string[];
  /** Segments per LLM call. Default 40. */
  batchSize?: number;
}

// Accept a correction only when it is a genuine spelling/word fix — similar
// length and sharing most character-bigrams with the original — so the LLM can't
// paraphrase a line into something the speaker never said. Bigrams (adjacent
// char pairs) beat a plain char-set overlap here: Thai's small alphabet lets
// unrelated same-length sentences reuse most single chars, but not most pairs.
function bigrams(s: string): Set<string> {
  const c = Array.from(s);
  const set = new Set<string>();
  if (c.length === 1) set.add(c[0]);
  for (let i = 0; i < c.length - 1; i++) set.add(c[i] + c[i + 1]);
  return set;
}
function acceptCorrection(orig: string, next: string): boolean {
  const a = orig.trim();
  const b = next.trim();
  if (!b || b === a) return false;
  const la = Array.from(a).length;
  if (la === 0) return false;
  if (Math.abs(Array.from(b).length - la) / la > 0.4) return false;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const g of B) if (A.has(g)) inter++;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union >= 0.6;
}

const SYSTEM = `You are a subtitle proofreader. You receive a JSON array of subtitle lines from an automatic speech-to-text system. Fix transcription errors ONLY: misheard words, wrong homophones, proper nouns, brand names, numbers, and obvious punctuation. Do NOT translate. Do NOT merge, split, reorder, add, or delete lines. Do NOT paraphrase or "improve" style. Keep each line's meaning and length close to the original. Return ONLY a JSON array of the corrected strings, exactly the same length and order as the input.`;

async function correctBatch(
  texts: string[],
  opts: CorrectOptions
): Promise<string[]> {
  const ctx: string[] = [];
  if (opts.language) ctx.push(`Language: ${opts.language}.`);
  if (opts.glossary?.length)
    ctx.push(`Spell these exactly: ${opts.glossary.join(", ")}.`);
  ctx.push(
    `Return a JSON array of exactly ${texts.length} corrected strings.`
  );
  const user = `${ctx.join(" ")}\n\nInput:\n${JSON.stringify(texts, null, 0)}`;

  const raw = await llmComplete(SYSTEM, user, { temperature: 0, ...opts });
  const arr = parseStringArray(raw);
  // length must match or we can't safely realign — keep originals on mismatch
  if (!arr || arr.length !== texts.length) return texts;
  return arr;
}

/**
 * Correct the wording of every segment in place-safe fashion (returns a new
 * array). Timing is preserved; per-word timestamps are dropped where text
 * changed.
 */
export async function aiCorrect(
  segments: Segment[],
  opts: CorrectOptions = {}
): Promise<Segment[]> {
  if (!segments.length) return segments;
  const batchSize = opts.batchSize ?? 40;
  const out: Segment[] = [];

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const texts = batch.map((s) => s.text);
    let corrected: string[];
    try {
      corrected = await correctBatch(texts, opts);
    } catch {
      corrected = texts; // never fail the whole job on one batch
    }
    batch.forEach((seg, j) => {
      const proposed = corrected[j] ?? seg.text;
      const accept = acceptCorrection(seg.text, proposed);
      const newText = accept ? proposed.trim() : seg.text.trim();
      out.push({
        start: seg.start,
        end: seg.end,
        text: newText,
        words: accept ? undefined : seg.words,
      });
    });
  }

  return out;
}
