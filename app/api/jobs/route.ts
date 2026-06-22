import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { STORAGE_ROOT } from "@/lib/storage";
import { summarize, sortSummaries, JobRaw } from "@/lib/jobsummary";
import { expiredIds, ttlMs } from "@/lib/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function listJobDirs(): Array<{ id: string; dir: string; mtime: number }> {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(STORAGE_ROOT);
  } catch {
    return [];
  }
  const out = [];
  for (const id of entries) {
    const dir = path.join(STORAGE_ROOT, id);
    try {
      const stat = fs.statSync(dir);
      if (stat.isDirectory()) out.push({ id, dir, mtime: stat.mtimeMs });
    } catch {
      /* skip */
    }
  }
  return out;
}

// List all jobs (newest first), sweeping expired ones first (TTL cleanup).
export async function GET() {
  let dirs = listJobDirs();

  // TTL sweep
  const expired = new Set(
    expiredIds(dirs.map((d) => ({ id: d.id, mtime: d.mtime })), Date.now(), ttlMs())
  );
  for (const d of dirs) {
    if (expired.has(d.id)) {
      try {
        fs.rmSync(d.dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  dirs = dirs.filter((d) => !expired.has(d.id));

  const jobs = dirs.map(({ id, dir, mtime }) => {
    const hasJob = fs.existsSync(path.join(dir, "job.json"));
    const hasOutput = fs.existsSync(path.join(dir, "output.mp4"));
    let status: any = null;
    try {
      status = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf-8"));
    } catch {}
    let segments = 0;
    try {
      const job = JSON.parse(fs.readFileSync(path.join(dir, "job.json"), "utf-8"));
      segments = job.segments?.length ?? 0;
    } catch {}

    const raw: JobRaw = {
      id,
      state: status?.state,
      progress: status?.progress,
      step: status?.step,
      error: status?.error,
      hasJob,
      hasOutput,
      segments,
      updatedAt: status?.updatedAt ?? mtime,
    };
    return summarize(raw);
  });

  return NextResponse.json({ jobs: sortSummaries(jobs) });
}
