import type { Word } from "./types";

// Thai is written without spaces, so Whisper's word_timestamps returns one
// token per character (incl. bare combining marks). Used as-is, the karaoke
// effect flashes single characters and orphans tone/vowel marks. We merge those
// character tokens into readable groups (~6 chars), keeping timing, and never
// letting a group START with a combining mark or trailing vowel. Shared by the
// live HTML preview (lib/cues.ts) and the burned .ass output (lib/ass.ts).

// Any Thai codepoint.
const THAI_RANGE = /[฀-๿]/;
// Chars that must NOT begin a group (they attach to the preceding base char):
// trailing vowels (ะ ั า ำ), above/below vowels & tone
// marks (ิ-ฺ), ๅ, and ็-๎.
const THAI_NO_LEAD = /[ะ-ฺๅ-๎]/;

export function isThai(text: string): boolean {
  return THAI_RANGE.test(text);
}

export function mergeThaiTokens(words: Word[], targetChars = 6): Word[] {
  if (!words.length) return words;
  const groups: Word[] = [];
  let cur: Word | null = null;
  for (const w of words) {
    const t = w.text || "";
    if (!t) continue;
    if (cur === null) {
      cur = { start: w.start, end: w.end, text: t };
      continue;
    }
    const canStartNew = !THAI_NO_LEAD.test(t.charAt(0));
    if (cur.text.length >= targetChars && canStartNew) {
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
