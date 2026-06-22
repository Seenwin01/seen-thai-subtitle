// Pure export helpers: resolution presets for output scaling.

export interface Resolution {
  id: string;
  label: string;
  height: number | null; // null = keep source
}

export const RESOLUTIONS: Resolution[] = [
  { id: "source", label: "ความละเอียดต้นฉบับ", height: null },
  { id: "1080", label: "1080p (Full HD)", height: 1080 },
  { id: "1440", label: "1440p (2K)", height: 1440 },
  { id: "4k", label: "2160p (4K)", height: 2160 },
];

/** Target output height for a resolution id, or null to keep source. */
export function targetHeight(id?: string): number | null {
  const r = RESOLUTIONS.find((x) => x.id === id);
  return r ? r.height : null;
}
