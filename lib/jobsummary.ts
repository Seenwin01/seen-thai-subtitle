// ---------------------------------------------------------------------------
// Pure helpers for the Jobs dashboard. No imports so they're unit-testable.
// ---------------------------------------------------------------------------

export type JobState = "queued" | "processing" | "done" | "error" | "unknown";

export interface JobRaw {
  id: string;
  state?: JobState;
  progress?: number;
  step?: string;
  error?: string;
  hasJob: boolean; // job.json exists -> editable in Studio
  hasOutput: boolean; // output.mp4 exists -> downloadable
  segments?: number;
  updatedAt?: number;
}

export interface JobSummary {
  id: string;
  state: JobState;
  progress: number;
  label: string;
  step: string;
  canOpen: boolean;
  canDownload: boolean;
  segments: number;
  updatedAt: number;
}

const LABELS: Record<JobState, string> = {
  queued: "เข้าคิว",
  processing: "กำลังประมวลผล",
  done: "เสร็จแล้ว",
  error: "ผิดพลาด",
  unknown: "ไม่ทราบสถานะ",
};

export function stateLabel(state: JobState): string {
  return LABELS[state] ?? LABELS.unknown;
}

export function summarize(raw: JobRaw): JobSummary {
  const state: JobState = raw.state ?? (raw.hasJob ? "done" : "unknown");
  const progress = state === "done" ? 100 : Math.max(0, Math.min(100, raw.progress ?? 0));
  return {
    id: raw.id,
    state,
    progress,
    label: stateLabel(state),
    step: raw.step ?? "",
    canOpen: raw.hasJob,
    canDownload: raw.hasOutput,
    segments: raw.segments ?? 0,
    updatedAt: raw.updatedAt ?? 0,
  };
}

/** Newest first. */
export function sortSummaries(list: JobSummary[]): JobSummary[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}
