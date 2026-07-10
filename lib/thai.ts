import type { Word } from "./types";

// Thai is written without spaces, so Whisper's word_timestamps returns one
// token per character (incl. bare combining marks). Used as-is, the karaoke
// effect flashes single characters and orphans tone/vowel marks. We merge those
// character tokens into readable groups, keeping timing, and never letting a
// group START with a combining mark or trailing vowel. Shared by the live HTML
// preview (lib/cues.ts) and the burned .ass output (lib/ass.ts).
//
// Primary path: Intl.Segmenter('th') — dictionary-based Thai WORD segmentation,
// so highlight groups land on real word boundaries (no more cutting mid-word
// like "cut ข​า|ว"). Falls back to the older char-count heuristic when the
// ICU Thai dictionary isn't available in the runtime.

// Any Thai codepoint.
const THAI_RANGE = /[฀-๿]/;
// Chars that must NOT begin a group (they attach to the preceding base char):
// trailing vowels, above/below vowels & tone marks, etc.
const THAI_NO_LEAD = /[ะ-ฺๅ-๎]/;
// Pre-posed (leading) vowels เ แ โ ใ ไ are written BEFORE their base consonant,
// so they always mark the START of a new syllable — a safe place to break.
const THAI_LEAD_VOWEL = /[เ-ไ]/;

export function isThai(text: string): boolean {
  return THAI_RANGE.test(text);
}

// Lazily create one segmenter (constructing it is not free). null = unavailable.
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
 * Merge per-character Whisper tokens into readable, mark-safe groups.
 * Uses real Thai word boundaries when available, else a char-count fallback.
 * Signature unchanged so lib/cues.ts and lib/ass.ts need no edits.
 */
export function mergeThaiTokens(words: Word[], targetChars = 6, minChars = 3): Word[] {
  if (!words.length) return words;

  const seg = thaiSegmenter();
  if (seg) {
    const grouped = mergeBySegmenter(words, seg, targetChars);
    // If segmentation produced nothing useful (e.g. no Thai dict data so the
    // whole string came back as one segment), fall back to char-count.
    if (grouped.length > 1 || words.length <= 1) return refineGroups(grouped);
  }
  return refineGroups(mergeByCharCount(words, targetChars, minChars));
}

// Comma-separated words that must never be split across highlight groups, e.g.
//   THAI_GLUE="นิวตันเมตร,แรงบิด,แรงม้า,วิลด์แทรก,แพลตตินัม"
// The ICU 'th' dictionary over-splits some compounds/loanwords; gluing them
// keeps the karaoke highlight on the whole word instead of jumping mid-word.
function glueList(): string[] {
  const base = [
    "นิวตันเมตร", "แรงบิด", "แรงม้า", "กิโลเมตร", "กิโลกรัม",
    "เครื่องยนต์", "ดีเซล", "เกียร์ออโต้", "ระบบขับเคลื่อน",
  ];
  const extra = (process.env.THAI_GLUE || process.env.STT_GLOSSARY || "")
    .split(",")
    .map((w) => w.split("=")[0].trim())
    .filter(Boolean);
  return [...new Set([...base, ...extra])].sort((a, b) => b.length - a.length);
}

/**
 * Post-process merged groups so the VISIBLE text never breaks badly:
 *   1) No group may START with a Thai combining mark / trailing vowel — those
 *      attach to the previous base char, so a leading mark renders as an orphan
 *      "◌่ ◌ู" (the "ภาษาเพี้ยน" the user reported). Merge such a group back.
 *   2) Lone single-character Thai groups are merged into a neighbour so the
 *      karaoke highlight never flashes on one floating character.
 *   3) Words in the glue list are kept intact (groups re-merged to contain them).
 * Timing is preserved (start of first, end of last merged group).
 */
function refineGroups(groups: Word[]): Word[] {
  if (groups.length <= 1) return groups;

  const isBadLead = (t: string) =>
    THAI_NO_LEAD.test((t || "").charAt(0)) ||
    (Array.from(t || "").length === 1 && THAI_RANGE.test(t));

  // (1)+(2) merge combining-mark / lone-char groups into the PREVIOUS group.
  const merged: Word[] = [];
  for (const g of groups) {
    if (merged.length && isBadLead(g.text)) {
      const prev = merged[merged.length - 1];
      prev.text += g.text;
      prev.end = g.end;
    } else {
      merged.push({ start: g.start, end: g.end, text: g.text });
    }
  }
  // The FIRST group can't merge backward. A leading combining mark there is an
  // orphan (no base char) that can never render — strip it. A lone BASE char is
  // folded FORWARD into the next group so it never flashes alone.
  if (merged.length) {
    let f0 = merged[0].text;
    while (f0.length && THAI_NO_LEAD.test(f0.charAt(0))) f0 = f0.slice(1);
    merged[0].text = f0;
    if (!f0) merged.shift();
  }
  if (
    merged.length > 1 &&
    Array.from(merged[0].text).length === 1 &&
    THAI_RANGE.test(merged[0].text)
  ) {
    merged[1].text = merged[0].text + merged[1].text;
    merged[1].start = merged[0].start;
    merged.shift();
  }

  // (3) re-glue known words that got split across group boundaries — works for
  // splits into ANY number of chunks (not just two). We locate each glue word in
  // the concatenated text and union together every group its characters touch,
  // so the whole word ends up in one group (karaoke highlights it as a unit).
  const glue = glueList();
  if (!glue.length) return merged;

  const full = merged.map((g) => g.text).join("");
  const charGroup: number[] = [];
  merged.forEach((g, gi) => {
    for (let k = 0; k < g.text.length; k++) charGroup.push(gi);
  });
  // union-find over adjacent group indices
  const parent = merged.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (const w of glue) {
    let idx = full.indexOf(w);
    while (idx >= 0) {
      const gStart = charGroup[idx];
      const gEnd = charGroup[idx + w.length - 1];
      for (let gi = gStart; gi < gEnd; gi++) {
        const a = find(gi), b = find(gi + 1);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
      idx = full.indexOf(w, idx + 1);
    }
  }
  // rebuild: unions are only between adjacent indices, so components are runs.
  const out: Word[] = [];
  for (let i = 0; i < merged.length; ) {
    const root = find(i);
    let j = i, text = merged[i].text, end = merged[i].end;
    while (j + 1 < merged.length && find(j + 1) === root) {
      j++;
      text += merged[j].text;
      end = merged[j].end;
    }
    out.push({ start: merged[i].start, end, text });
    i = j + 1;
  }
  return out;
}

// --- word-boundary segmentation -------------------------------------------
function mergeBySegmenter(words: Word[], seg: Intl.Segmenter, targetChars: number): Word[] {
  // Concatenate token texts and remember which token each character came from,
  // so we can recover timing for any character range.
  let full = "";
  const charToken: number[] = [];
  words.forEach((w, ti) => {
    const t = w.text || "";
    for (let i = 0; i < t.length; i++) charToken.push(ti);
    full += t;
  });
  if (!full) return [];

  const groups: Word[] = [];
  let startChar = -1;
  let text = "";
  const flush = (endExclusive: number) => {
    if (!text || startChar < 0) return;
    const startTok = charToken[startChar];
    const endTok = charToken[endExclusive - 1];
    groups.push({ start: words[startTok].start, end: words[endTok].end, text });
    text = "";
    startChar = -1;
  };

  for (const s of seg.segment(full)) {
    if (startChar < 0) startChar = s.index;
    text += s.segment;
    // s.index + length is a real word boundary; break once long enough.
    if (text.length >= targetChars) flush(s.index + s.segment.length);
  }
  flush(full.length);
  return groups;
}

// --- char-count fallback (previous behaviour) ------------------------------
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
      (cur.text.length >= targetChars ||
        (atSyllableStart && cur.text.length >= minChars));
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
