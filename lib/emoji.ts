// ---------------------------------------------------------------------------
// Auto-emoji: append a relevant emoji to a subtitle cue based on keywords.
// Pure + dependency-free for unit testing.
// ---------------------------------------------------------------------------

// Ordered keyword (Thai/English substring) -> emoji. First match wins.
const MAP: Array<[string, string]> = [
  ["เคล็ดลับ", "💡"],
  ["ไอเดีย", "💡"],
  ["คิด", "💡"],
  ["เงิน", "💰"],
  ["รวย", "🤑"],
  ["ฟรี", "🆓"],
  ["หัวใจ", "❤️"],
  ["ไฟ", "🔥"],
  ["เด็ด", "🔥"],
  ["ปัง", "💥"],
  ["ไวรัล", "🚀"],
  ["เร็ว", "⚡"],
  ["ระวัง", "⚠️"],
  ["ห้าม", "🚫"],
  ["เยี่ยม", "✨"],
  ["สำคัญ", "⭐"],
  ["ตกใจ", "😱"],
  ["ฮา", "😂"],
  ["ขำ", "😂"],
  ["ร้องไห้", "😭"],
  ["เศร้า", "😢"],
  ["อาหาร", "🍜"],
  ["เที่ยว", "✈️"],
  ["บ้าน", "🏠"],
  ["เวลา", "⏰"],
  ["money", "💰"],
  ["fire", "🔥"],
  ["viral", "🚀"],
  ["love", "❤️"],
  ["fast", "⚡"],
  ["tip", "💡"],
];

/** Return the first emoji whose keyword appears in the cue, or null. */
export function emojiForCue(texts: string[]): string | null {
  const joined = texts.join(" ").toLowerCase();
  for (const [kw, emoji] of MAP) {
    if (joined.includes(kw.toLowerCase())) return emoji;
  }
  return null;
}

/** Append a matched emoji to the end of a text (no-op if none / already has one). */
export function appendEmoji(text: string): string {
  const e = emojiForCue([text]);
  return e && !text.includes(e) ? `${text} ${e}` : text;
}
