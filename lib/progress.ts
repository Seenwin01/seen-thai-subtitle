// ---------------------------------------------------------------------------
// Pure helpers for turning tool output into a 0..100 progress percentage.
// No imports so they can be unit-tested directly.
// ---------------------------------------------------------------------------

export function clampPct(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Map a value in [0,total] onto the [lo,hi] percentage band. */
export function bandPct(value: number, total: number, lo: number, hi: number): number {
  if (total <= 0) return lo;
  const frac = Math.max(0, Math.min(1, value / total));
  return clampPct(lo + frac * (hi - lo));
}

/**
 * Parse an ffmpeg progress/stderr line into elapsed seconds.
 * Handles both `-progress pipe` (out_time_ms=) and stderr (time=HH:MM:SS.cs).
 */
export function parseFfmpegTimeSec(line: string): number | null {
  const ms = line.match(/out_time_ms=(\d+)/);
  if (ms) return Number(ms[1]) / 1_000_000;
  const us = line.match(/out_time_us=(\d+)/);
  if (us) return Number(us[1]) / 1_000_000;
  const t = line.match(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (t) return Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
  return null;
}

/** Parse a "PROGRESS <pct>" line emitted by scripts/transcribe.py. */
export function parseWhisperPct(line: string): number | null {
  const m = line.match(/PROGRESS\s+(\d+(?:\.\d+)?)/);
  return m ? clampPct(Number(m[1])) : null;
}

// Coarse stage → base percentage for jobs.
export const STAGE_PCT: Record<string, number> = {
  queued: 0,
  extracting: 5,
  transcribing: 10, // grows to ~90 via whisper progress
  finalizing: 95,
  rendering: 10, // grows to ~95 via ffmpeg progress
  cutting: 10,
  done: 100,
  error: 0,
};

export function stagePct(stage: string): number {
  return STAGE_PCT[stage] ?? 0;
}
