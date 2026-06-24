import type { Segment, SubtitleStyle, Word } from "./types";

// Convert "#RRGGBB" -> ASS "&HAABBGGRR" (alpha 00 = opaque, FF = transparent)
function hexToAss(hex: string, alpha = 0): string {
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0").toUpperCase();
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

// seconds -> H:MM:SS.cs (centiseconds)
function secToAss(t: number): string {
  if (t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100);
  const csFixed = cs === 100 ? 99 : cs;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(
    csFixed
  ).padStart(2, "0")}`;
}

function alignment(pos: SubtitleStyle["position"]): number {
  if (pos === "top") return 8;
  if (pos === "center") return 5;
  return 2; // bottom
}

function escapeText(text: string): string {
  return text.replace(/\n/g, "\\N").replace(/\{/g, "(").replace(/\}/g, ")");
}

function applyCase(text: string, upper: boolean): string {
  return upper ? text.toUpperCase() : text;
}

function chunkWords(words: Word[], max: number): Word[][] {
  if (max <= 0) max = 1;
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += max) out.push(words.slice(i, i + max));
  return out;
}

/**
 * Generate a full .ass subtitle file.
 * `emphasize` colours keywords; `emojiOf` appends an emoji; `lumaAt(t)` (0-255)
 * enables auto-contrast: each cue's base text + outline colour is chosen from the
 * scene brightness behind it (bright scene -> dark text/white outline, dark scene
 * -> white text/black outline). Highlight/emphasis colours are kept as-is.
 */
export function generateAss(
  segments: Segment[],
  style: SubtitleStyle,
  playW: number,
  playH: number,
  watermark?: string,
  emphasize?: (texts: string[]) => boolean[],
  emojiOf?: (texts: string[]) => string | null,
  lumaAt?: (t: number) => number
): string {
  const borderStyle = style.boxOpacity > 0 ? 3 : 1;
  const backColour = hexToAss("#000000", 1 - style.boxOpacity);
  const primary = hexToAss(style.color);
  const outline = hexToAss(style.outlineColor);
  const highlight = hexToAss(style.highlightColor);
  const emphasis = hexToAss(style.emphasisColor ?? style.highlightColor);
  const bold = style.bold ? -1 : 0;
  const marginV = Math.round(playH * 0.08);

  // fontSize authored on a 1000px-tall reference -> scale with the video height.
  const sizeScale = playH / 1000;
  const fontSize = Math.max(8, Math.round(style.fontSize * sizeScale));
  const outlineW = Math.max(0, +(style.outlineWidth * sizeScale).toFixed(2));

  // auto-contrast colours (when lumaAt provided)
  const AC_DARK = hexToAss("#0B0B0B");
  const AC_LIGHT = hexToAss("#FFFFFF");

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${playW}`,
    `PlayResY: ${playH}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${style.font},${fontSize},${primary},${primary},${outline},${backColour},${bold},0,0,0,100,100,0,0,${borderStyle},${outlineW},1,${alignment(
      style.position
    )},40,40,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, Effect, Text",
  ].join("\n");

  const lines: string[] = [];

  for (const seg of segments) {
    const words =
      seg.words && seg.words.length > 0
        ? seg.words
        : [{ start: seg.start, end: seg.end, text: seg.text }];
    const cues = chunkWords(words, style.maxWordsPerCue);

    for (const cue of cues) {
      const cueStart = cue[0].start;
      const cueEnd = cue[cue.length - 1].end;

      // per-cue base + outline colour (auto-contrast or the style default)
      let base = primary;
      let cueOutline = outline;
      let pre = "";
      if (lumaAt) {
        const y = lumaAt(cueStart);
        if (y >= 140) {
          base = AC_DARK;
          cueOutline = AC_LIGHT;
        } else {
          base = AC_LIGHT;
          cueOutline = AC_DARK;
        }
        pre = `{\\c${base}\\3c${cueOutline}}`;
      }
      const wrap = (t: string, color: string) =>
        color === base ? t : `{\\c${color}}${t}{\\c${base}}`;

      const emph =
        style.autoEmphasis && emphasize
          ? emphasize(cue.map((w) => w.text))
          : cue.map(() => false);
      const perWord = style.wordHighlight || emph.some(Boolean);
      const emoji = style.autoEmoji && emojiOf ? emojiOf(cue.map((w) => w.text)) : null;
      const tail = emoji ? ` ${emoji}` : "";

      if (!perWord) {
        const text = applyCase(cue.map((w) => w.text).join(" ").trim(), style.uppercase);
        lines.push(
          `Dialogue: 0,${secToAss(cueStart)},${secToAss(cueEnd)},Default,,0,0,,${pre}${escapeText(text)}${tail}`
        );
        continue;
      }

      if (!style.wordHighlight) {
        const rendered = cue
          .map((w, j) => wrap(escapeText(applyCase(w.text, style.uppercase)), emph[j] ? emphasis : base))
          .join(" ");
        lines.push(
          `Dialogue: 0,${secToAss(cueStart)},${secToAss(cueEnd)},Default,,0,0,,${pre}${rendered}${tail}`
        );
        continue;
      }

      // karaoke: one event per word; active=highlight, keyword=emphasis, else base
      for (let i = 0; i < cue.length; i++) {
        const w = cue[i];
        const start = w.start;
        const end = i < cue.length - 1 ? cue[i + 1].start : cueEnd;
        const rendered = cue
          .map((cw, j) => {
            const t = escapeText(applyCase(cw.text, style.uppercase));
            if (j === i && style.wordPop) {
              return `{\\fscx70\\fscy70\\t(0,90,\\fscx118\\fscy118)\\t(90,170,\\fscx100\\fscy100)\\c${highlight}}${t}{\\c${base}}`;
            }
            const color = j === i ? highlight : emph[j] ? emphasis : base;
            return wrap(t, color);
          })
          .join(" ");
        lines.push(
          `Dialogue: 0,${secToAss(start)},${secToAss(end)},Default,,0,0,,${pre}${rendered}${tail}`
        );
      }
    }
  }

  if (watermark) {
    const wm = escapeText(watermark);
    lines.push(
      `Dialogue: 0,0:00:00.00,9:59:59.99,Default,,0,0,,{\\an9\\alpha&H90&\\fs28\\bord1}${wm}`
    );
  }

  return header + "\n" + lines.join("\n") + "\n";
}
