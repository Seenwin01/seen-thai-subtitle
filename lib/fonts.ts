// ---------------------------------------------------------------------------
// Single source of truth for the subtitle fonts the user can pick.
//
// `name` MUST equal the font family's real name so BOTH layers agree:
//   • burn  — lib/ass.ts writes `name` into the .ass Style; libass matches it
//             against the .ttf files in ./fonts (passed via fontsdir=).
//   • preview — the browser renders `name` as `font-family`; the faces are
//             loaded from Google Fonts in app/globals.css (@import).
// Keeping one list means the dropdown, preview and burn never drift apart.
//
// To ADD a font: (1) add a row here, (2) add its family to the @import in
// app/globals.css, (3) drop its .ttf into ./fonts (see fonts/README).
// ---------------------------------------------------------------------------

export type FontCategory = "viral" | "clean" | "display";

export interface FontOption {
  /** Real family name — used verbatim by both libass and CSS. */
  name: string;
  /** Thai label shown in the dropdown. */
  label: string;
  category: FontCategory;
  /** The .ttf file expected in ./fonts (for the burn). */
  file: string;
}

export const FONT_OPTIONS: FontOption[] = [
  // — สายไวรัล/แคปชัน (หนา ปัง) —
  { name: "Kanit", label: "Kanit — ไวรัลหนา", category: "viral", file: "Kanit-Bold.ttf" },
  { name: "Prompt", label: "Prompt — โมเดิร์น", category: "viral", file: "Prompt-Bold.ttf" },
  { name: "Mitr", label: "Mitr — โค้งมนเป็นมิตร", category: "viral", file: "Mitr-SemiBold.ttf" },
  { name: "Bai Jamjuree", label: "Bai Jamjuree — เทค", category: "viral", file: "BaiJamjuree-Bold.ttf" },
  // — สายอ่านง่าย/ทางการ —
  { name: "Sarabun", label: "Sarabun — อ่านง่าย", category: "clean", file: "Sarabun-Bold.ttf" },
  { name: "Noto Sans Thai", label: "Noto Sans Thai — คลีน", category: "clean", file: "NotoSansThai-Bold.ttf" },
  { name: "IBM Plex Sans Thai", label: "IBM Plex Sans Thai", category: "clean", file: "IBMPlexSansThai-SemiBold.ttf" },
  // Krub ships STATIC weights (Anuphan is variable-only → libass would burn the
  // wrong weight), so it stays consistent between preview and burn.
  { name: "Krub", label: "Krub — คลีนโมเดิร์น", category: "clean", file: "Krub-SemiBold.ttf" },
  // — สายดิสเพลย์/ลายมือ —
  { name: "Chonburi", label: "Chonburi — ดิสเพลย์หนา", category: "display", file: "Chonburi-Regular.ttf" },
  { name: "Sriracha", label: "Sriracha — ลายมือ", category: "display", file: "Sriracha-Regular.ttf" },
];

/** Always fall back to an installed Thai face so text never boxes-out. */
export const FONT_FALLBACK = `'Noto Sans Thai', sans-serif`;

/** CSS font-family string for the preview (chosen font + safe fallback). */
export function fontStack(name: string): string {
  const safe = name.includes("'") ? name : `'${name}'`;
  return `${safe}, ${FONT_FALLBACK}`;
}

export function isKnownFont(name: string): boolean {
  return FONT_OPTIONS.some((f) => f.name === name);
}

// The .ass Style line is comma-delimited and brace-tagged, so a font name is
// written verbatim into it. Neutralise any character that could break the line
// (comma / braces / newlines) and fall back to an installed Thai face if empty.
// Used by lib/ass.ts so a stale template or bad value can't corrupt the subtitle.
export function safeFontName(name: string): string {
  const n = (name || "").replace(/[,{}\r\n]/g, " ").trim();
  return n || "Noto Sans Thai";
}
