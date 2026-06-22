import type { Segment, Word } from "./types";
import { isThai, mergeThaiTokens } from "./thai";

export interface Cue {
  start: number;
  end: number;
  words: Word[];
}

// Mirror of the chunking logic in ass.ts, for the live HTML preview.
// Thai segments are first merged from per-character tokens into readable groups
// so the karaoke highlight (and word-pop) lands on whole chunks with real
// durations instead of flickering on single characters.
export function buildCues(segments: Segment[], maxWords: number): Cue[] {
  const max = maxWords > 0 ? maxWords : 1;
  const cues: Cue[] = [];
  for (const seg of segments) {
    let words: Word[] =
      seg.words && seg.words.length > 0
        ? seg.words
        : [{ start: seg.start, end: seg.end, text: seg.text }];
    if (isThai(seg.text)) words = mergeThaiTokens(words);
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
