import type { Segment, SubtitleStyle, Word } from "./types";
import { safeFontName } from "./fonts";
import { isThai, mergeThaiTokens } from "./thai";
import { activeUntil } from "./cues";
import { pickEmphasis } from "./keywords";
import { emojiForCue } from "./emoji";

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
  // Neutralize backslashes FIRST (a lone "\\x" would become an ASS override
  // tag and corrupt/hide the line), strip CR, THEN emit ASS line breaks.
  return text
    .replace(/\\/g, "/")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\N")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")");
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
 * `emphasize` / `emojiOf` default to the shared lib (keywords/emoji) so the
 * burned output matches the live preview; pass your own to override.
 */
export function generateAss(
  segments: Segment[],
  style: SubtitleStyle,
  playW: number,
  playH: number,
  watermark?: string,
  emphasize: (texts: string[]) => boolean[] = pickEmphasis,
  emojiOf: (texts: string[]) => string | null = emojiForCue
): string {
  const borderStyle = style.boxOpacity > 0 ? 3 : 1;
  const backColour = hexToAss("#000000", 1 - style.boxOpacity);
  const primary = hexToAss(style.color);
  const outline = hexToAss(style.outlineColor);
  const highlight = hexToAss(style.highlightColor);
  const emphasis = hexToAss(style.emphasisColor ?? style.highlightColor);
  const bold = style.bold ? -1 : 0;
  const marginV = Math.round(playH * 0.08);

  // --- Resolution-independent sizing (matches the live preview) -------------
  // `style.fontSize` is authored as a per-mille of the FRAME HEIGHT (e.g. 54 =>
  // 5.4% of height), NOT an absolute pixel count. Both the burned .ass and the
  // HTML preview (components/VideoPreview.tsx) multiply it by the frame height
  // so the text occupies the SAME proportion of the frame regardless of the
  // clip's real resolution — so "the burn looks like the preview".
  //   ass px = fontSize/1000 * PlayResY(=playH)
  const scale = playH / 1000;
  const fontPx = Math.max(8, Math.round(style.fontSize * scale));
  const outlinePx = +(style.outlineWidth * scale).toFixed(1);
  const shadowPx = +(0.8 * scale).toFixed(1);

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
    `Style: Default,${safeFontName(style.font)},${fontPx},${primary},${primary},${outline},${backColour},${bold},0,0,0,100,100,0,0,${borderStyle},${outlinePx},${shadowPx},${alignment(
      style.position
    )},40,40,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, Effect, Text",
  ].join("\n");

  const lines: string[] = [];
  const wrap = (t: string, color: string) =>
    color === primary ? t : `{\\c${color}}${t}{\\c${primary}}`;

  for (const seg of segments) {
    const thai = isThai(seg.text);
    // Thai is written with no inter-word spaces; spaced languages keep " ".
    const sep = thai ? "" : " ";

    let words: Word[] =
      seg.words && seg.words.length > 0
        ? seg.words
        : [{ start: seg.start, end: seg.end, text: seg.text }];
    // Merge per-character Thai tokens into readable, mark-safe groups.
    if (thai) words = mergeThaiTokens(words);

    const cues = chunkWords(words, style.maxWordsPerCue);

    for (const cue of cues) {
      const cueStart = cue[0].start;
      const cueEnd = cue[cue.length - 1].end;
      const emph =
        style.autoEmphasis && emphasize
          ? emphasize(cue.map((w) => w.text))
          : cue.map(() => false);
      const perWord = style.wordHighlight || emph.some(Boolean);
      const emoji = style.autoEmoji && emojiOf ? emojiOf(cue.map((w) => w.text)) : null;
      const tail = emoji ? ` ${emoji}` : "";

      if (!perWord) {
        const text = applyCase(cue.map((w) => w.text).join(sep).trim(), style.uppercase);
        lines.push(
          `Dialogue: 0,${secToAss(cueStart)},${secToAss(cueEnd)},Default,,0,0,,${escapeText(text)}${tail}`
        );
        continue;
      }

      if (!style.wordHighlight) {
        // static cue, keywords coloured permanently
        const rendered = cue
          .map((w, j) => wrap(escapeText(applyCase(w.text, style.uppercase)), emph[j] ? emphasis : primary))
          .join(sep);
        lines.push(
          `Dialogue: 0,${secToAss(cueStart)},${secToAss(cueEnd)},Default,,0,0,,${rendered}${tail}`
        );
        continue;
      }

      // karaoke: one event per word; active=highlight, keyword=emphasis, else primary
      for (let i = 0; i < cue.length; i++) {
        const w = cue[i];
        const start = w.start;
        const end = activeUntil(cue, i, cueEnd);
        const rendered = cue
          .map((cw, j) => {
            const t = escapeText(applyCase(cw.text, style.uppercase));
            if (j === i && style.wordPop) {
              // scale pop: shrink -> overshoot -> settle, timed to event start
              return `{\\fscx70\\fscy70\\t(0,90,\\fscx118\\fscy118)\\t(90,170,\\fscx100\\fscy100)\\c${highlight}}${t}{\\c${primary}}`;
            }
            const color = j === i ? highlight : emph[j] ? emphasis : primary;
            return wrap(t, color);
          })
          .join(sep);
        lines.push(
          `Dialogue: 0,${secToAss(start)},${secToAss(end)},Default,,0,0,,${rendered}${tail}`
        );
      }
    }
  }

  if (watermark) {
    const wm = escapeText(watermark);
    lines.push(
      `Dialogue: 0,0:00:00.00,9:59:59.99,Default,,0,0,,{\\an9\\alpha&H90&\\fs${Math.round(
        28 * scale
      )}\\bord1}${wm}`
    );
  }

  return header + "\n" + lines.join("\n") + "\n";
}
