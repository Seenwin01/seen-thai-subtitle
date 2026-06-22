import type { Segment } from "./types";

// Pure transcript search. Case-insensitive substring match over segment text.

export interface Match {
  id: number;
  start: number;
  end: number;
  text: string;
}

export function searchSegments(segments: Segment[], query: string): Match[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return segments
    .filter((s) => s.text.toLowerCase().includes(q))
    .map((s) => ({ id: s.id, start: s.start, end: s.end, text: s.text }));
}

export function countMatches(segments: Segment[], query: string): number {
  return searchSegments(segments, query).length;
}
