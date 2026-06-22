// Shared types for the transcription + subtitle pipeline

export interface Word {
  /** start time in seconds */
  start: number;
  /** end time in seconds */
  end: number;
  text: string;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface Transcript {
  jobId: string;
  language: string;
  duration: number;
  videoFile: string;
  segments: Segment[];
}

export type SubtitlePosition = "bottom" | "center" | "top";

export interface SubtitleStyle {
  id: string;
  name: string;
  /** Thai-capable font family name available on the system */
  font: string;
  fontSize: number;
  /** primary fill colour, hex #RRGGBB */
  color: string;
  /** colour used to highlight the currently spoken word */
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  /** 0 = no shadow box, >0 = semi-transparent background box */
  boxOpacity: number;
  bold: boolean;
  uppercase: boolean;
  position: SubtitlePosition;
  /** highlight the active word as audio plays (karaoke effect) */
  wordHighlight: boolean;
  /** make the active word "pop" (scale up briefly) — needs wordHighlight */
  wordPop?: boolean;
  /** max words shown on screen at once */
  maxWordsPerCue: number;
  /** auto-highlight important keywords permanently ("AI เน้นคำ") */
  autoEmphasis?: boolean;
  /** colour for auto-emphasised keywords (defaults to highlightColor) */
  emphasisColor?: string;
  /** append a relevant emoji to each cue automatically */
  autoEmoji?: boolean;
  /** true for user-saved templates (vs built-in presets) */
  custom?: boolean;
}

export interface RenderRequest {
  jobId: string;
  segments: Segment[];
  style: SubtitleStyle;
  /** optional output aspect ratio id (e.g. "9:16"); omit for original */
  aspect?: string;
  /** optional output resolution id (e.g. "4k"); omit for source */
  scale?: string;
  /** export subtitles only on a transparent background (.mov) */
  transparent?: boolean;
}
