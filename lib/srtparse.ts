import type { Segment } from "./types";

// Pure SRT parser -> Segment[]. Handles CRLF, comma or dot milliseconds,
// optional index lines, and multi-line cue text.

function toSec(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

const TIME =
  /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

export function parseSrt(content: string): Segment[] {
  const blocks = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n\s*\n/);
  const out: Segment[] = [];
  let id = 0;
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const timeIdx = lines.findIndex((l) => TIME.test(l));
    if (timeIdx === -1) continue;
    const m = lines[timeIdx].match(TIME)!;
    const start = toSec(m[1], m[2], m[3], m[4]);
    const end = toSec(m[5], m[6], m[7], m[8]);
    const text = lines.slice(timeIdx + 1).join(" ").trim();
    if (!text || end <= start) continue;
    out.push({ id: id++, start, end, text, words: [] });
  }
  return out;
}
