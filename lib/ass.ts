import type { Segment, SubtitleStyle, Word } from "./types";
import { isThai as isThaiWord, mergeThaiTokens as mergeThaiWords } from "./thai";

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

// --- Thai handling --------------------------------------------------------
// Thai is written without spaces, so Whisper's word_timestamps returns one
// token per character (incl. bare combining marks). Rendered as-is, the
// karaoke effect flashes single characters and orphans tone/vowel marks.
// We merge those character tokens into readable groups (~6 chars) and keep
// the timing, never letting a group START with a mark/trailing vowel.

const THAI_RANGE = /[฀-๿]/;
// Chars that must NOT begin a group (they attach to the preceding base char):
// trailing vowels ะ ั า ำ, all above/below vowels & tone marks, ๅ ๆ.
const THAI_NO_LEAD = /[ะ-ฺๅ-๎]/;

function isThai(text: string): boolean {
  return THAI_RANGE.test(text);
}

function mergeThaiTokens(words: Word[], targetChars = 6): Word[] {
  if (!words.length) return words;
  const groups: Word[] = [];
  let cur: Word | null = null;
  for (const w of words) {
    const t = w.text || "";
    if (!t) continue;
    if (cur === null) {
      cur = { start: w.start, end: w.end, text: t };
      continue;
    }
    const canStartNew = !THAI_NO_LEAD.test(t.charAt(0));
    if (cur.text.length >= targetChars && canStartNew) {
      groups.push(cur);
      cur = { start: w.start, end: w.end, text: t };
    } else {
      cur.text += t;
      cur.end = w.end;
    }
  }
  if (cur) groups.push(cur);
  return groups;
}

function chunkWords(words: Word[], max: number): Word[][] {
  if (max <= 0) max = 1;
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += max) out.push(words.slice(i, i + max));
  return out;
}

/**
 * Generate a full .ass subtitle file.
 * `emphasize` (optional) is injected so this module stays dependency-free; it
 * receives a cue's word texts and returns which words to colour as keywords.
 */
export function generateAss(
  segments: Segment[],
  style: SubtitleStyle,
  playW: number,
  playH: number,
  watermark?: string,
  emphasize?: (texts: string[]) => boolean[],
  emojiOf?: (texts: string[]) => string | null
): string {
  const borderStyle = style.boxOpacity > 0 ? 3 : 1;
  const backColour = hexToAss("#000000", 1 - style.boxOpacity);
  const primary = hexToAss(style.color);
  const outline = hexToAss(style.outlineColor);
  const highlight = hexToAss(style.highlightColor);
  const emphasis = hexToAss(style.emphasisColor ?? style.highlightColor);
  const bold = style.bold ? -1 : 0;
  const marginV = Math.round(playH * 0.08);

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
    `Style: Default,${style.font},${Math.round(style.fontSize * 1.5)},${primary},${primary},${outline},${backColour},${bold},0,0,0,100,100,0,0,${borderStyle},${style.outlineWidth},1,${alignment(
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
    const thai = isThaiWord(seg.text);
    // Thai is written with no inter-word spaces; spaced languages keep " ".
    const sep = thai ? "" : " ";

    let words: Word[] =
      seg.words && seg.words.length > 0
        ? seg.words
        : [{ start: seg.start, end: seg.end, text: seg.text }];
    // Merge per-character Thai tokens into readable, mark-safe groups.
    if (thai) {
      words = explodeIfSparse(words, seg.start, seg.end);
      words = mergeThaiWords(words);
    }

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
        const end = i < cue.length - 1 ? cue[i + 1].start : cueEnd;
        const rendered = cue
          .map((cw, j) => {
            const t = escapeText(applyCase(cw.text, style.uppercase));
            if (j === i && (style.wordPop ?? true)) {
              // scale pop: shrink -> overshoot -> settle, timed to event start
              return `{\\fscx80\\fscy80\\t(0,90,\\fscx135\\fscy135)\\t(90,200,\\fscx122\\fscy122)\\c${highlight}}${t}{\\c${primary}}`;
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
      `Dialogue: 0,0:00:00.00,9:59:59.99,Default,,0,0,,{\\an9\\alpha&H90&\\fs28\\bord1}${wm}`
    );
  }

  return header + "\n" + lines.join("\n") + "\n";
}

// Cloud STT sometimes returns a whole sentence as ONE token with no per-word
// timing. The server has no Thai word segmenter, so such a line can't be split
// or karaoke'd. When timing is collapsed (1 token, or all words share a start),
// explode the text into per-character tokens with linear timing; mergeThaiTokens
// then regroups them into mark-safe chunks that the karaoke loop can advance.
function explodeIfSparse(words: Word[], segStart: number, segEnd: number): Word[] {
  if (!words.length) return words;
  const distinct = new Set(words.map((w) => Math.round((w.start || 0) * 100))).size;
  if (words.length >= 2 && distinct >= 2) return words; // already has real per-word timing
  const chars = Array.from(words.map((w) => w.text || "").join(""));
  if (chars.length < 2) return words;
  const dur = Math.max(0.2, segEnd - segStart);
  return chars.map((ch, i) => ({
    start: segStart + (i / chars.length) * dur,
    end: segStart + ((i + 1) / chars.length) * dur,
    text: ch,
  }));
}
