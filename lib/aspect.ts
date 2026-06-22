// ---------------------------------------------------------------------------
// Output aspect-ratio presets for social platforms. Pure + testable.
// ---------------------------------------------------------------------------

export interface Aspect {
  id: string;
  label: string;
  w: number;
  h: number;
}

export const ASPECTS: Aspect[] = [
  { id: "9:16", label: "แนวตั้ง 9:16 (TikTok/Reels/Shorts)", w: 1080, h: 1920 },
  { id: "1:1", label: "จัตุรัส 1:1 (Feed)", w: 1080, h: 1080 },
  { id: "4:5", label: "แนวตั้ง 4:5 (IG Feed)", w: 1080, h: 1350 },
  { id: "16:9", label: "แนวนอน 16:9 (YouTube)", w: 1920, h: 1080 },
];

export function getAspect(id?: string): Aspect | undefined {
  return ASPECTS.find((a) => a.id === id);
}
