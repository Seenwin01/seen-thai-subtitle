import type { Segment } from "./types";

// ---------------------------------------------------------------------------
// Generate a post caption + hashtags from subtitles. Pure + dependency-free
// (LLM call lives in the API route). Heuristic is the offline fallback.
// ---------------------------------------------------------------------------

const STOP = new Set([
  "และ", "ที่", "ของ", "ให้", "ได้", "เป็น", "คือ", "กับ", "แล้ว", "จะ",
  "ก็", "ว่า", "ไม่", "มี", "นี้", "นั้น", "อยู่", "มา", "ไป", "นะ",
  "ครับ", "ค่ะ", "คะ", "แต่", "หรือ", "เรา", "คุณ", "ผม", "ฉัน", "มัน",
  "เขา", "ใน", "บน", "ด้วย", "อัน", "the", "a", "to", "of", "and", "is",
]);

function tokens(segments: Segment[]): string[] {
  const out: string[] = [];
  for (const s of segments) {
    if (s.words && s.words.length) {
      for (const w of s.words) out.push(w.text);
    } else {
      for (const w of s.text.split(/\s+/)) out.push(w);
    }
  }
  return out.map((t) => t.trim()).filter(Boolean);
}

/** Up to `max` hashtags from notable words (deduped, no spaces). */
export function makeHashtags(segments: Segment[], max = 5): string[] {
  const seen = new Set<string>();
  const picks: string[] = [];
  for (const raw of tokens(segments)) {
    const t = raw.replace(/[^\p{L}\p{N}\p{M}]/gu, "");
    if (t.length < 3) continue;
    if (STOP.has(t.toLowerCase())) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    picks.push("#" + t);
    if (picks.length >= max) break;
  }
  return picks;
}

/** A short caption: first sentence-ish, trimmed to maxLen. */
export function makeCaption(segments: Segment[], maxLen = 150): string {
  const text = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}

export function generateCaptionHeuristic(segments: Segment[]): {
  caption: string;
  hashtags: string[];
} {
  return { caption: makeCaption(segments), hashtags: makeHashtags(segments) };
}

export function buildCaptionPrompt(segments: Segment[]): string {
  const text = segments.map((s) => s.text).join(" ").slice(0, 2000);
  return [
    "คุณเป็นนักการตลาดคอนเทนต์สั้นภาษาไทย",
    "จากบทพูดด้านล่าง เขียนแคปชั่นโพสต์ที่ดึงดูด (1-2 บรรทัด) และแฮชแท็ก 5 อัน",
    "ตอบเป็น JSON เท่านั้น: {\"caption\":\"...\",\"hashtags\":[\"#...\"]}",
    "",
    "บทพูด:",
    text,
  ].join("\n");
}

/** Parse LLM JSON {caption, hashtags[]}; robust to surrounding prose. */
export function parseCaption(text: string): { caption: string; hashtags: string[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON object in caption response");
  }
  let obj: any;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("invalid JSON in caption response");
  }
  const caption = typeof obj.caption === "string" ? obj.caption.trim() : "";
  const hashtags = Array.isArray(obj.hashtags)
    ? obj.hashtags
        .filter((h: any) => typeof h === "string")
        .map((h: string) => (h.startsWith("#") ? h : "#" + h).replace(/\s+/g, ""))
    : [];
  return { caption, hashtags };
}
