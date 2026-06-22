import type { Segment } from "./types";

// ---------------------------------------------------------------------------
// Subtitle translation — pure helpers only (no network/imports) so they can be
// unit-tested. The LLM call + config live in app/api/translate/[id]/route.ts.
// ---------------------------------------------------------------------------

export interface Language {
  code: string;
  name: string; // Thai display name
  english: string; // name used in the LLM prompt
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "อังกฤษ", english: "English" },
  { code: "zh", name: "จีน (ตัวย่อ)", english: "Simplified Chinese" },
  { code: "ja", name: "ญี่ปุ่น", english: "Japanese" },
  { code: "ko", name: "เกาหลี", english: "Korean" },
  { code: "vi", name: "เวียดนาม", english: "Vietnamese" },
  { code: "id", name: "อินโดนีเซีย", english: "Indonesian" },
  { code: "ms", name: "มลายู", english: "Malay" },
  { code: "es", name: "สเปน", english: "Spanish" },
  { code: "fr", name: "ฝรั่งเศส", english: "French" },
  { code: "de", name: "เยอรมัน", english: "German" },
  { code: "pt", name: "โปรตุเกส", english: "Portuguese" },
  { code: "ru", name: "รัสเซีย", english: "Russian" },
  { code: "hi", name: "ฮินดี", english: "Hindi" },
  { code: "ar", name: "อาหรับ", english: "Arabic" },
  { code: "th", name: "ไทย", english: "Thai" },
];

export function getLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/** Build an LLM prompt that asks for a JSON array of translated lines. */
export function buildTranslatePrompt(segments: Segment[], targetEnglish: string): string {
  const items = segments
    .map((s) => `${s.id}\t${s.text.replace(/\s+/g, " ").trim()}`)
    .join("\n");
  return [
    `Translate each subtitle line below into ${targetEnglish}.`,
    "Keep it natural, concise, and suitable for on-screen subtitles.",
    "Return ONLY a JSON array (no other text), preserving each line's id:",
    '[{"id":0,"text":"<translation>"}]',
    "",
    "Lines (id<TAB>text):",
    items,
  ].join("\n");
}

/**
 * Parse the LLM JSON response and apply translations onto the segments,
 * preserving timing. Word timings are cleared (translation re-flows words).
 * Lines the model skipped keep their original text.
 */
export function parseTranslation(text: string, segments: Segment[]): Segment[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON array in translation response");
  }
  let parsed: any[];
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("invalid JSON in translation response");
  }

  const byId = new Map<number, string>();
  for (const item of parsed) {
    if (item && typeof item.id === "number" && typeof item.text === "string") {
      byId.set(item.id, item.text.trim());
    }
  }

  return segments.map((s) =>
    byId.has(s.id) ? { ...s, text: byId.get(s.id)!, words: [] } : s
  );
}
