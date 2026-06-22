import type { SubtitleStyle, SubtitlePosition } from "./types";

// ---------------------------------------------------------------------------
// Custom subtitle templates: let creators save their own styles and reuse them.
// All functions here are pure (no runtime cross-module deps) so they can be
// unit-tested directly. Persistence (localStorage) lives in
// components/useCustomTemplates.ts.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "klipr.customTemplates";

// Self-contained fallback used when sanitising partial/garbage input.
export const DEFAULT_STYLE: SubtitleStyle = {
  id: "viral-yellow",
  name: "ไวรัลเหลือง",
  font: "Sarabun",
  fontSize: 54,
  color: "#FFFFFF",
  highlightColor: "#FFE100",
  outlineColor: "#000000",
  outlineWidth: 4,
  boxOpacity: 0,
  bold: true,
  uppercase: false,
  position: "bottom",
  wordHighlight: true,
  maxWordsPerCue: 4,
};

const POSITIONS: SubtitlePosition[] = ["bottom", "center", "top"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

function clamp(n: number, lo: number, hi: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9฀-๿-]/g, "");
  return base || "style";
}

/**
 * Coerce arbitrary/partial input into a valid SubtitleStyle, filling missing
 * fields from a base and clamping numbers / validating colours.
 */
export function sanitizeStyle(
  input: Partial<SubtitleStyle>,
  base: SubtitleStyle = DEFAULT_STYLE
): SubtitleStyle {
  return {
    id: typeof input.id === "string" && input.id ? input.id : base.id,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : base.name,
    font: typeof input.font === "string" && input.font.trim() ? input.font.trim() : base.font,
    fontSize: Math.round(clamp(input.fontSize ?? base.fontSize, 20, 100)),
    color: hex(input.color, base.color),
    highlightColor: hex(input.highlightColor, base.highlightColor),
    outlineColor: hex(input.outlineColor, base.outlineColor),
    outlineWidth: Math.round(clamp(input.outlineWidth ?? base.outlineWidth, 0, 12)),
    boxOpacity: clamp(input.boxOpacity ?? base.boxOpacity, 0, 1),
    bold: typeof input.bold === "boolean" ? input.bold : base.bold,
    uppercase: typeof input.uppercase === "boolean" ? input.uppercase : base.uppercase,
    position: POSITIONS.includes(input.position as SubtitlePosition)
      ? (input.position as SubtitlePosition)
      : base.position,
    wordHighlight:
      typeof input.wordHighlight === "boolean" ? input.wordHighlight : base.wordHighlight,
    maxWordsPerCue: Math.round(clamp(input.maxWordsPerCue ?? base.maxWordsPerCue, 1, 20)),
    custom: input.custom === true,
  };
}

/** Build a new custom template from the current style + a user-chosen name. */
export function createCustomTemplate(
  name: string,
  style: SubtitleStyle
): SubtitleStyle {
  const id = `custom-${slugify(name)}-${Date.now().toString(36)}`;
  return sanitizeStyle({ ...style, id, name, custom: true });
}

/** Serialise the custom templates list for storage / export. */
export function serializeTemplates(list: SubtitleStyle[]): string {
  return JSON.stringify(list.filter((t) => t.custom).map((t) => sanitizeStyle(t)));
}

/** Parse a stored/exported templates blob, dropping anything invalid. */
export function parseTemplates(json: string): SubtitleStyle[] {
  let arr: unknown;
  try {
    arr = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === "object")
    .map((x) => sanitizeStyle({ ...(x as object), custom: true } as Partial<SubtitleStyle>))
    .filter((t) => t.id.startsWith("custom-"));
}

/** Built-in presets first, then custom templates; de-duplicated by id. */
export function mergeTemplates(
  presets: SubtitleStyle[],
  custom: SubtitleStyle[]
): SubtitleStyle[] {
  const seen = new Set<string>();
  const out: SubtitleStyle[] = [];
  for (const s of [...presets, ...custom]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}
