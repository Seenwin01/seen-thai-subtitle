import type { Segment, Word } from "./types";

// Remove verbal filler words ("เอ่อ", "อืม", "uh"…) from subtitles. Pure.

const FILLERS = new Set([
  "เอ่อ", "เอิ่ม", "อืม", "อืมม", "อ่า", "อ้า", "เออ", "เอ้อ", "อ่ะ", "เอ๊ะ",
  "นะ", "อะ", "um", "umm", "uh", "uhh", "erm", "ah", "eh", "hmm", "like",
]);

function isFiller(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.,!?]/g, "");
  return FILLERS.has(t);
}

function tokenize(seg: Segment): { text: string; words: Word[] } {
  if (seg.words && seg.words.length) {
    const words = seg.words.filter((w) => !isFiller(w.text));
    return { text: words.map((w) => w.text).join(" ").trim(), words };
  }
  const kept = seg.text.split(/\s+/).filter((t) => t && !isFiller(t));
  return { text: kept.join(" ").trim(), words: [] };
}

/**
 * Remove filler words from every segment. Segments left empty are dropped,
 * and ids are renumbered. Returns a new array.
 */
export function removeFillers(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  let id = 0;
  for (const seg of segments) {
    const { text, words } = tokenize(seg);
    if (!text) continue;
    out.push({ ...seg, id: id++, text, words });
  }
  return out;
}

/** How many filler words would be removed (for UI feedback). */
export function countFillers(segments: Segment[]): number {
  let n = 0;
  for (const seg of segments) {
    const toks = seg.words && seg.words.length ? seg.words.map((w) => w.text) : seg.text.split(/\s+/);
    n += toks.filter(isFiller).length;
  }
  return n;
}
