// AI correction pass: fix obvious Thai STT errors using sentence context.
// Self-contained Gemini caller (no external SDK). Graceful: if no key or the
// call/parse fails, returns the input unchanged so transcription never breaks.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
function geminiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

const PROMPT_HEAD =
  'นี่คือซับไตเติ้ลภาษาไทยจากการถอดเสียงอัตโนมัติ (AI) ซึ่งอาจมีคำผิด คำเพี้ยน หรือเว้นวรรคผิดบางส่วน\n' +
  'งานของคุณ: แก้คำผิด/คำเพี้ยนให้เป็นภาษาไทยที่ถูกต้องและอ่านลื่นตามบริบท โดย:\n' +
  '- รักษาความหมายและลำดับเดิม ห้ามเพิ่มเนื้อหาใหม่ที่ไม่ได้พูด ห้ามแปล\n' +
  '- คงคำทับศัพท์ ชื่อรุ่น ตัวเลข และภาษาอังกฤษไว้\n' +
  '- ถ้าบรรทัดไหนถูกต้องอยู่แล้ว ให้คืนค่าเดิม\n' +
  '- ตอบกลับเป็น JSON array ของสตริงเท่านั้น จำนวนสมาชิกเท่ากับอินพุตและเรียงลำดับเดิม\n' +
  'อินพุต (JSON array):\n';

export async function correctThai(lines: string[]): Promise<string[]> {
  const key = geminiKey();
  if (!key || !lines.length) return lines;
  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT_HEAD + JSON.stringify(lines) }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return lines;
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const arr = JSON.parse(text);
    if (Array.isArray(arr) && arr.length === lines.length) {
      return arr.map((x, i) =>
        typeof x === "string" && x.trim() ? x.trim() : lines[i]
      );
    }
    return lines;
  } catch {
    return lines;
  }
}

// Rebuild per-character word tokens with linear timing across [start,end].
// Used after correction changes a line's text (the original per-word timing no
// longer matches); mergeThaiTokens later regroups these into real Thai words.
export function redistributeWords(
  text: string,
  start: number,
  end: number
): { start: number; end: number; text: string }[] {
  const chars = Array.from(text);
  const n = chars.length || 1;
  const dur = Math.max(0.2, end - start);
  return chars.map((ch, i) => ({
    start: start + (i / n) * dur,
    end: start + ((i + 1) / n) * dur,
    text: ch,
  }));
}
