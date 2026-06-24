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

// ---------------------------------------------------------------------------
// Compound / loanword dictionary. Intl.Segmenter('th') uses the ICU dictionary
// which over-splits compounds and transliterations it doesn't know, e.g.
//   แรงบิด -> แรง|บิด,  นิวตัน -> นิ|ว|ตัน,  สเกิร์ต -> ส|เกิร์ต,  ล้อแม็ก -> ล้อ|แม็ก
// After segmenting we glue adjacent groups back together when they form a word
// in this dictionary (longest match first). Extend at runtime with env
// THAI_DICT (a comma-separated list), e.g. THAI_DICT="แรงบิด,วิ่งวน�เทอร์โบ".
const BUILTIN_DICT = [
  "นิวตันเมตร", "นิวตัน", "แรงบิด", "แรงม้า", "เครื่องยนต์", "ดีเซล", "เบนซิน",
  "ไทม์มิ่ง", "เทอร์โบ", "ล้อแม็ก", "แม็ก", "สเกิร์ต", "สปอยเลอร์", "กระจังหน้า",
  "กันชน", "ช่วงล่าง", "หน้ากว้าง", "แก้มยาง", "สีขาวมุก", "ไฟหน้า", "ไฟท้าย",
  "เกียร์ออโต้", "เกียร์", "ระบบเบรก", "ดิสก์เบรก", "พวงมาลัย", "แดชบอร์ด",
  "เบาะหนัง", "ซันรูฟ", "กล้องถอยหลัง", "เซ็นเซอร์", "ครูซคอนโทรล",
];

function buildDict(): string[] {
  const extra = (process.env.THAI_DICT || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // longest first so multi-word compounds win over their parts
  return Array.from(new Set([...BUILTIN_DICT, ...extra])).sort(
    (a, b) => Array.from(b).length - Array.from(a).length
  );
}

let _dict: string[] | null = null;
function dict(): string[] {
  if (!_dict) _dict = buildDict();
  return _dict;
}

/** Glue adjacent word groups whose concatenation is a dictionary word. */
function glueCompounds(words: Word[]): Word[] {
  if (words.length < 2) return words;
  const d = dict();
  if (!d.length) return words;
  const out = words.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const maxLen = Math.min(6, out.length - i);
      for (let len = maxLen; len >= 2; len--) {
        const joined = out
          .slice(i, i + len)
          .map((w) => w.text)
          .join("");
        // ICU groups carry trailing whitespace (e.g. "บิด "); compare on the
        // whitespace-stripped form so "แรง"+"บิด " still matches "แรงบิด".
        const key = joined.replace(/\s+/g, "");
        if (d.includes(key)) {
          out.splice(i, len, {
            start: out[i].start,
            end: out[i + len - 1].end,
            text: joined,
          });
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return out;
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
    if (grouped.length) return glueCompounds(grouped);
  }
  return glueCompounds(mergeByCharCount(words, targetChars, minChars));
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
