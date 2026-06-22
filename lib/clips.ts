import type { Segment } from "./types";

export interface Clip {
  id: string;
  start: number;
  end: number;
  duration: number;
  title: string;
  score: number; // 0..100
  reasons: string[];
  segmentIds: number[];
  /** 1-based position after ranking (set by lib/rank.ts) */
  rank?: number;
  /** full spoken text of the clip, attached transiently for the ranker */
  text?: string;
}

export interface DetectOptions {
  minDur?: number; // shortest acceptable clip (s)
  maxDur?: number; // longest acceptable clip (s)
  target?: number; // ideal length (s)
  max?: number; // max clips to return
}

// Thai "hook" words that often signal engaging/viral moments.
const HOOK_WORDS = [
  "เคล็ดลับ", "วิธี", "ห้ามพลาด", "สำคัญ", "ลับ", "เทคนิค", "ทำไม",
  "อย่า", "ต้อง", "ที่สุด", "ฟรี", "ง่าย", "เปลี่ยน", "เงิน", "รวย",
  "ผิดพลาด", "อันดับ", "รีวิว", "เปรียบเทียบ", "แนะนำ", "ลองดู",
];

const QUESTION_WORDS = ["ไหม", "อะไร", "ทำไม", "ยังไง", "อย่างไร", "เมื่อไหร่", "ที่ไหน", "ใคร"];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function countWords(seg: Segment): number {
  if (seg.words && seg.words.length) return seg.words.length;
  return seg.text.split(/\s+/).filter(Boolean).length;
}

interface Window {
  i: number;
  j: number; // inclusive segment range
  start: number;
  end: number;
  segs: Segment[];
}

function scoreWindow(
  segs: Segment[],
  target: number
): { score: number; reasons: string[] } {
  const text = segs.map((s) => s.text).join(" ");
  const dur = segs[segs.length - 1].end - segs[0].start;
  const words = segs.reduce((a, s) => a + countWords(s), 0);

  const reasons: string[] = [];

  const hookHits = HOOK_WORDS.filter((w) => text.includes(w)).length;
  const hookScore = clamp(hookHits * 12, 0, 36);
  if (hookHits > 0) reasons.push(`มีคำดึงดูด ${hookHits} คำ`);

  const qHits =
    QUESTION_WORDS.filter((w) => text.includes(w)).length +
    (text.includes("?") ? 1 : 0);
  const qScore = clamp(qHits * 8, 0, 20);
  if (qHits > 0) reasons.push("มีประโยคคำถาม/ชวนคิด");

  const hasNumber = /\d/.test(text);
  const numScore = hasNumber ? 12 : 0;
  if (hasNumber) reasons.push("มีตัวเลข/ลิสต์");

  const density = dur > 0 ? words / dur : 0; // words per second
  const densityScore = clamp((density / 3) * 20, 0, 20); // ~3 w/s = full
  if (density >= 2.2) reasons.push("พูดต่อเนื่อง กระชับ");

  // closeness to target duration
  const durScore = clamp(12 - Math.abs(dur - target) * 0.4, 0, 12);

  const total = clamp(
    Math.round(hookScore + qScore + numScore + densityScore + durScore),
    0,
    100
  );
  return { score: total, reasons };
}

function makeTitle(segs: Segment[]): string {
  const text = segs.map((s) => s.text).join(" ").trim();
  const words = text.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  return words.length ? words : "คลิปไฮไลท์";
}

/**
 * Detect candidate viral clips from a transcript.
 * Builds duration-bounded windows, scores them, then greedily selects
 * the highest-scoring non-overlapping clips.
 */
export function detectClips(
  segments: Segment[],
  opts: DetectOptions = {}
): Clip[] {
  const minDur = opts.minDur ?? 15;
  const maxDur = opts.maxDur ?? 60;
  const target = opts.target ?? 35;
  const max = opts.max ?? 6;

  if (!segments.length) return [];

  const windows: Window[] = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i; j < segments.length; j++) {
      const start = segments[i].start;
      const end = segments[j].end;
      const dur = end - start;
      if (dur < minDur) continue;
      if (dur > maxDur) break;
      windows.push({ i, j, start, end, segs: segments.slice(i, j + 1) });
    }
  }

  // Short videos: no window long enough — fall back to the whole thing.
  if (!windows.length) {
    const start = segments[0].start;
    const end = segments[segments.length - 1].end;
    const { score, reasons } = scoreWindow(segments, target);
    return [
      {
        id: "clip-0",
        start,
        end,
        duration: end - start,
        title: makeTitle(segments),
        score,
        reasons: reasons.length ? reasons : ["คลิปทั้งหมด"],
        segmentIds: segments.map((s) => s.id),
      },
    ];
  }

  const scored = windows
    .map((w) => ({ w, ...scoreWindow(w.segs, target) }))
    .sort((a, b) => b.score - a.score);

  const picked: Clip[] = [];
  const used: Array<[number, number]> = [];
  for (const s of scored) {
    if (picked.length >= max) break;
    const overlaps = used.some(([a, b]) => s.w.start < b && s.w.end > a);
    if (overlaps) continue;
    used.push([s.w.start, s.w.end]);
    picked.push({
      id: `clip-${picked.length}`,
      start: s.w.start,
      end: s.w.end,
      duration: +(s.w.end - s.w.start).toFixed(2),
      title: makeTitle(s.w.segs),
      score: s.score,
      reasons: s.reasons,
      segmentIds: s.w.segs.map((seg) => seg.id),
    });
  }

  // Present in chronological order.
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * Build a transcript slice for a clip, re-based so the clip starts at t=0.
 * Word/segment timings are shifted and clamped to the clip window.
 */
export function sliceTranscript(
  segments: Segment[],
  start: number,
  end: number
): Segment[] {
  const out: Segment[] = [];
  let id = 0;
  for (const seg of segments) {
    if (seg.end <= start || seg.start >= end) continue;
    const ns = Math.max(seg.start, start) - start;
    const ne = Math.min(seg.end, end) - start;
    const words = (seg.words || [])
      .filter((w) => w.end > start && w.start < end)
      .map((w) => ({
        start: +(Math.max(w.start, start) - start).toFixed(3),
        end: +(Math.min(w.end, end) - start).toFixed(3),
        text: w.text,
      }));
    out.push({
      id: id++,
      start: +ns.toFixed(3),
      end: +ne.toFixed(3),
      text: seg.text,
      words,
    });
  }
  return out;
}
