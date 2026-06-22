import type { Segment } from "./types";

// ---------------------------------------------------------------------------
// Pure subtitle-editing operations. Each returns a NEW Segment[] (never
// mutates) and keeps the list sorted + re-numbered. Used by the Studio editor.
// ---------------------------------------------------------------------------

export function renumber(segs: Segment[]): Segment[] {
  return [...segs]
    .sort((a, b) => a.start - b.start)
    .map((s, i) => ({ ...s, id: i }));
}

function idx(segs: Segment[], id: number): number {
  return segs.findIndex((s) => s.id === id);
}

/** Edit a segment's text. Clears word timings so the new text is rendered. */
export function setText(segs: Segment[], id: number, text: string): Segment[] {
  return segs.map((s) => (s.id === id ? { ...s, text, words: [] } : s));
}

/** Edit a segment's start/end (seconds). Clamps to start >= 0 and end > start. */
export function setTiming(
  segs: Segment[],
  id: number,
  start: number,
  end: number
): Segment[] {
  const ns = Math.max(0, start);
  const ne = Math.max(ns + 0.1, end);
  return renumber(segs.map((s) => (s.id === id ? { ...s, start: ns, end: ne } : s)));
}

export function deleteSeg(segs: Segment[], id: number): Segment[] {
  return renumber(segs.filter((s) => s.id !== id));
}

/** Merge a segment with the next one (by current order). */
export function mergeNext(segs: Segment[], id: number): Segment[] {
  const i = idx(segs, id);
  if (i === -1 || i >= segs.length - 1) return segs;
  const a = segs[i];
  const b = segs[i + 1];
  const merged: Segment = {
    id: a.id,
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
    text: `${a.text} ${b.text}`.trim(),
    words: [...(a.words || []), ...(b.words || [])],
  };
  const out = [...segs.slice(0, i), merged, ...segs.slice(i + 2)];
  return renumber(out);
}

/** Split a segment into two — by word boundary when available, else by time. */
export function splitSeg(segs: Segment[], id: number): Segment[] {
  const i = idx(segs, id);
  if (i === -1) return segs;
  const s = segs[i];

  let first: Segment;
  let second: Segment;

  if (s.words && s.words.length >= 2) {
    const half = Math.floor(s.words.length / 2);
    const w1 = s.words.slice(0, half);
    const w2 = s.words.slice(half);
    first = {
      id: s.id, start: s.start, end: w1[w1.length - 1].end,
      text: w1.map((w) => w.text).join(" "), words: w1,
    };
    second = {
      id: s.id + 1, start: w2[0].start, end: s.end,
      text: w2.map((w) => w.text).join(" "), words: w2,
    };
  } else {
    const mid = +(s.start + (s.end - s.start) / 2).toFixed(3);
    const cut = Math.floor(s.text.length / 2);
    first = { id: s.id, start: s.start, end: mid, text: s.text.slice(0, cut).trim(), words: [] };
    second = { id: s.id + 1, start: mid, end: s.end, text: s.text.slice(cut).trim(), words: [] };
  }

  return renumber([...segs.slice(0, i), first, second, ...segs.slice(i + 1)]);
}
