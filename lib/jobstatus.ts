import fs from "fs";
import { jobPath } from "./storage";

export type JobState = "queued" | "processing" | "done" | "error";

export interface JobStatus {
  state: JobState;
  progress: number; // 0..100
  step: string; // human-readable Thai label
  error?: string;
  result?: Record<string, unknown>; // e.g. { output: "output.mp4" }
  updatedAt: number;
}

export function getStatus(jobId: string): JobStatus | null {
  try {
    return JSON.parse(fs.readFileSync(jobPath(jobId, "status.json"), "utf-8"));
  } catch {
    return null;
  }
}

export function setStatus(jobId: string, patch: Partial<JobStatus>): JobStatus {
  const prev: JobStatus =
    getStatus(jobId) ?? { state: "queued", progress: 0, step: "", updatedAt: 0 };
  const next: JobStatus = { ...prev, ...patch, updatedAt: Date.now() };
  fs.writeFileSync(jobPath(jobId, "status.json"), JSON.stringify(next));
  return next;
}
