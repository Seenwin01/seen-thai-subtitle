// ---------------------------------------------------------------------------
// Auto keyword emphasis ("AI เน้นคำ"): pick the important words in a cue so
// they can be coloured/bolded permanently (separate from karaoke highlight).
// Pure + dependency-free so it can be unit-tested directly.
// ---------------------------------------------------------------------------

// Common Thai function words / fillers that should NOT be emphasised.
const STOPWORDS = new Set([
  "และ", "ที่", "ของ", "ให้", "ได้", "เป็น", "คือ", "กับ", "แล้ว", "จะ",
  "ก็", "ว่า", "ไม่", "มี", "นี้", "นั้น", "อยู่", "มา", "ไป", "นะ",
  "ครับ", "ค่ะ", "คะ", "อ่ะ", "อืม", "แต่", "หรือ", "เรา", "คุณ", "ผม",
  "ฉัน", "มัน", "เขา", "ๆ", "ใน", "บน", "ด้วย", "ต้อง", "อัน", "นี่",
  "the", "a", "an", "to", "of", "and", "or", "is", "are", "in", "on",
]);

// Words that signal an important/engaging moment (worth emphasising).
const IMPORTANT = [
  "เคล็ดลับ", "วิธี", "ห้ามพลาด", "สำคัญ", "ลับ", "เทคนิค", "ที่สุด",
  "ฟรี", "เปลี่ยน", "เงิน", "รวย", "ผิดพลาด", "อันดับ", "รีวิว", "ไวรัล",
];

function isImportant(t: string): boolean {
  return IMPORTANT.some((w) => t.includes(w));
}

/** Should this single word qualify as a keyword to emphasise? */
export function isEmphasisWord(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\d/.test(t)) return true; // numbers / lists
  if (isImportant(t)) return true;
  if (STOPWORDS.has(t.toLowerCase())) return false;
  return t.length >= 4; // longer content words
}

/**
 * Pick which words in a cue to emphasise. Returns a boolean[] aligned to the
 * input. Capped to at most half the words (longest qualifying words win) so a
 * cue never becomes all-emphasis.
 */
export function pickEmphasis(words: string[]): boolean[] {
  const flags = words.map(() => false);
  const qualifying = words
    .map((w, i) => ({ i, w: w.trim(), ok: isEmphasisWord(w) }))
    .filter((x) => x.ok);

  const cap = Math.max(1, Math.ceil(words.length / 2));
  qualifying
    .sort((a, b) => b.w.length - a.w.length || a.i - b.i)
    .slice(0, cap)
    .forEach((x) => (flags[x.i] = true));

  return flags;
}
