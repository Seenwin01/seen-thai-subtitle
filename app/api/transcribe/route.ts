import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { jobPath, newJobId, STORAGE_ROOT } from "@/lib/storage";
import { transcribeJob } from "@/lib/pipeline";
import { setStatus } from "@/lib/jobstatus";
import { getQueue } from "@/lib/queue";
import { ttlMs } from "@/lib/cleanup";

export const runtime = "nodejs";
export const maxDuration = 600;

// Free disk before accepting a new upload. The storage volume is persistent, so
// old job artifacts (source video + audio + renders) pile up and eventually
// trigger ENOSPC ("no space left on device"). Keep the newest JOB_KEEP jobs
// (default 8) and drop anything past that or older than the TTL.
function sweepStorage(): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(STORAGE_ROOT, { withFileTypes: true });
  } catch {
    return;
  }
  const keep = Math.max(0, Number(process.env.JOB_KEEP) || 8);
  const ttl = ttlMs();
  const now = Date.now();

  const jobs = entries
    .filter((e) => e.isDirectory() && e.name !== "lost+found")
    .map((e) => {
      const dir = path.join(STORAGE_ROOT, e.name);
      let mtime = 0;
      try {
        const jj = path.join(dir, "job.json");
        mtime = fs.existsSync(jj) ? fs.statSync(jj).mtimeMs : fs.statSync(dir).mtimeMs;
      } catch {
        mtime = 0;
      }
      return { dir, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime); // newest first

  for (let i = 0; i < jobs.length; i++) {
    const tooMany = i >= keep;
    const tooOld = ttl > 0 && now - jobs[i].mtime > ttl;
    if (tooMany || tooOld) {
      try {
        fs.rmSync(jobs[i].dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    sweepStorage();

    const form = await req.formData();
    const file = form.get("video");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "no video" }, { status: 400 });
    }

    const jobId = newJobId();
    const ext = path.extname((file as File).name) || ".mp4";
    const videoFile = jobPath(jobId, `source${ext}`);
    fs.writeFileSync(videoFile, Buffer.from(await (file as File).arrayBuffer()));

    setStatus(jobId, { state: "queued", progress: 0, step: "เข้าคิว" });

    // Run in the background; client polls /api/status/<jobId>.
    getQueue()
      .enqueue(() =>
        transcribeJob(jobId, videoFile, (pct, step) =>
          setStatus(jobId, { state: "processing", progress: pct, step })
        )
      )
      .then((t) =>
        setStatus(jobId, {
          state: "done",
          progress: 100,
          step: "เสร็จแล้ว",
          result: { segments: t.segments.length },
        })
      )
      .catch((e) =>
        setStatus(jobId, {
          state: "error",
          step: "เกิดข้อผิดพลาด",
          error: String(e?.message ?? e),
        })
      );

    return NextResponse.json({ jobId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "transcription failed" },
      { status: 500 }
    );
  }
}
