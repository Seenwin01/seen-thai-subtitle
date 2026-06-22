"use client";

export interface JobStatus {
  state: "queued" | "processing" | "done" | "error";
  progress: number;
  step: string;
  error?: string;
  result?: Record<string, any>;
}

/**
 * Poll /api/status/<jobId> until the job is done or errors.
 * Calls onTick with each status update. Resolves with the final status.
 */
export async function pollJob(
  jobId: string,
  onTick: (s: JobStatus) => void,
  intervalMs = 1000,
  timeoutMs = 30 * 60 * 1000
): Promise<JobStatus> {
  const start = Date.now();
  // small delay so the status file exists
  await new Promise((r) => setTimeout(r, 300));
  while (true) {
    let s: JobStatus | null = null;
    try {
      const res = await fetch(`/api/status/${jobId}`, { cache: "no-store" });
      if (res.ok) s = await res.json();
    } catch {
      /* transient — keep polling */
    }
    if (s) {
      onTick(s);
      if (s.state === "done" || s.state === "error") return s;
    }
    if (Date.now() - start > timeoutMs) {
      return { state: "error", progress: 0, step: "หมดเวลา", error: "timeout" };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// build refresh
