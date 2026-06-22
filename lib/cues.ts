import type { Segment, Word } from "./types";

export interface Cue {
  start: number;
  end: number;
  words: Word[];
}

// Mirror of the chunking logic in ass.ts, for the live HTML preview.
export function buildCues(segments: Segment[], maxWords: number): Cue[] {
  const max = maxWords > 0 ? maxWords : 1;
  const cues: Cue[] = [];
  for (const seg of segments) {
    const words =
      seg.words && seg.words.length > 0
        ? seg.words
        : [{ start: seg.start, end: seg.end, text: seg.text }];
    for (let i = 0; i < words.length; i += max) {
      const chunk = words.slice(i, i + max);
      cues.push({
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        words: chunk,
      });
    }
  }
  return cues;
}

export function activeCue(cues: Cue[], t: number): Cue | null {
  for (const c of cues) {
    if (t >= c.start && t <= c.end) return c;
  }
  return null;
}
