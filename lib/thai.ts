import type { Word } from "./types";

// Thai is written without spaces; cloud Whisper returns one token per character
// (incl. bare combining marks). For readable, correctly-timed karaoke we merge
// those tokens into real WORD groups using the dictionary-based Thai segmenter
// built into the JS runtime (Intl.Segmenter('th')), carrying each word's real
// start/end time from its source tokens. Falls back to mark-safe char grouping.
// Shared by the live HTML preview (lib/cues.ts) and burned .ass (lib/ass.ts).

const THAI_RANGE = /[฀-๿]/;
const THAI_NO_LEAD = /[ะ-ฺ็-๎]/;
const THAI_LEAD_VOWEL = /[เ-ไ]/;

export function isThai(text: string): boolean {
  return THAI_RANGE.test(text);
}

let _segmenter: Intl.Segmenter | null | undefined;
function thaiSegmenter(): Intl.Segmenter | null {
  if (_segmenter !== undefined) return _segmenter;
  try {
    _segmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter("th", { granularity: "word" })
        : null;
  } catch {
    _segmenter = null;
  }
  return _segmenter;
}

/**
 * Merge per-character Whisper tokens into real Thai word groups with real timing.
 * Signature kept compatible (targetChars/minChars used only by the fallback).
 */
export function mergeThaiTokens(words: Word[], targetChars = 6, minChars = 3): Word[] {
  if (!words.length) return words;
  const seg = thaiSegmenter();
  if (seg) {
    const grouped = mergeBySegmenter(words, seg);
    if (grouped.length) return grouped;
  }
  return mergeByCharCount(words, targetChars, minChars);
}

function mergeBySegmenter(words: Word[], seg: Intl.Segmenter): Word[] {
  let full = "";
  const charToken: number[] = [];
  words.forEach((w, ti) => {
    const t = w.text || "";
    for (const ch of t) {
      charToken.push(ti);
      full += ch;
    }
  });
  if (!full) return [];

  const groups: Word[] = [];
  for (const s of seg.segment(full)) {
    const text = s.segment;
    if (!text) continue;
    const startTok = charToken[s.index];
    const endTok = charToken[s.index + text.length - 1];
    const g: Word = { start: words[startTok].start, end: words[endTok].end, text };
    if (!text.trim() && groups.length) {
      const prev = groups[groups.length - 1];
      prev.text += text;
      prev.end = g.end;
    } else {
      groups.push(g);
    }
  }
  return groups;
}

function mergeByCharCount(words: Word[], targetChars: number, minChars: number): Word[] {
  const groups: Word[] = [];
  let cur: Word | null = null;
  for (const w of words) {
    const t = w.text || "";
    if (!t) continue;
    if (cur === null) {
      cur = { start: w.start, end: w.end, text: t };
      continue;
    }
    const c0 = t.charAt(0);
    const canStartNew = !THAI_NO_LEAD.test(c0);
    const atSyllableStart = THAI_LEAD_VOWEL.test(c0);
    const shouldBreak =
      canStartNew &&
      (cur.text.length >= targetChars || (atSyllableStart && cur.text.length >= minChars));
    if (shouldBreak) {
      groups.push(cur);
      cur = { start: w.start, end: w.end, text: t };
    } else {
      cur.text += t;
      cur.end = w.end;
    }
  }
  if (cur) groups.push(cur);
  return groups;
}
